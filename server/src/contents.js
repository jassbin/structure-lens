// [v21.7] 今日拆解内容模块
// 数据源：公开热榜（百度主源；微博/知乎常需登录，尽力而为）仅抓取 标题+平台名；每日1条，滚动近7天
const { randomUUID } = require("crypto");
const { mysqlEnabled, query } = require("./db");
const { chatText } = require("./ai-client");
const { ANALYSIS_SYSTEM_PROMPT, extractJson } = require("./prompt");
const { normalizeAnalysis } = require("./validate");

const TZ_MS = 8 * 3600 * 1000;
const DAILY_HOUR = 6;
const DAILY_MINUTE = 35;
const KEEP_DAYS = 7;
const DAILY_TARGET = 5; // 每天至少 5 条热榜事件，保证首页推荐多条

const mem = [];
let tableEnsured = false;
let generating = false;
let timer = null;

function dayKeyOf(ms) {
  return new Date((ms || Date.now()) + TZ_MS).toISOString().slice(0, 10);
}
function norm(s) {
  return String(s || "").replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "");
}
function sim(a, b) {
  const A = norm(a), B = norm(b);
  if (!A || !B) return 0;
  if (A === B) return 1;
  const grams = new Set();
  for (let i = 0; i < A.length - 1; i++) grams.add(A.slice(i, i + 2));
  let hit = 0;
  for (let i = 0; i < B.length - 1; i++) {
    if (grams.has(B.slice(i, i + 2))) hit++;
  }
  return hit / Math.max(1, A.length - 1, B.length - 1);
}

async function ensureTable() {
  if (!mysqlEnabled() || tableEnsured) return;
  try {
    await query(
      "CREATE TABLE IF NOT EXISTS contents (id VARCHAR(64) PRIMARY KEY, title VARCHAR(255) NOT NULL, platform VARCHAR(32) DEFAULT '', hook TEXT, payload TEXT, day_key VARCHAR(10), created_at BIGINT, KEY idx_contents_day (day_key))",
      []
    );
    tableEnsured = true;
  } catch (e) {
    console.error("[contents] table create failed", e && e.message);
  }
}

const BAD_WORDS = ["广告", "推广", "干货", "热搜"];
// 敏感过滤：现任国家领导人姓名 + 政治性/时政表述，一律不出现在选题里（红线）
const BLOCK_WORDS = [
  "习近平", "李强", "赵乐际", "王沪宁", "蔡奇", "丁薛祥", "李希", "韩正",
  "政治局", "国家主席", "国务院总理", "委员长", "政协主席", "中央军委",
  "中共中央", "总书记", "总理", "外长", "国防部长",
  "解放军", "外交部", "国防部", "军演", "导弹", "航母", "核武",
  "台海", "南海", "钓鱼岛", "台湾", "两岸", "香港", "澳门",
  "政权", "选举", "竞选", "政府工作报告", "人大", "政协", "党代会",
  "贺信", "贺电", "国庆阅兵", "建交", "战略伙伴", "一带一路",
  "反腐", "审查调查", "落马", "违纪",
];
// 悲剧/灾祸类话题直接跳过（产品定位：结构化生活/商业议题，不做情绪广场）
const LOW_WORDS = ["坠亡", "身亡", "遇害", "自杀", "跳楼", "枪击", "爆炸", "地震", "洪水", "疫情", "确诊", "坍塌", "失踪", "事故", "遗体", "绝笔", "遇难", "灾难", "大火", "中毒", "病房", "抢救"];
function isLow(s) {
  const t = String(s || "");
  return LOW_WORDS.some((w) => t.indexOf(w) >= 0);
}
function cleanTopic(s) {
  const t = String(s || "").trim();
  if (t.length < 4) return "";
  for (const w of BAD_WORDS) {
    if (t.indexOf(w) >= 0) return "";
  }
  for (const w of BLOCK_WORDS) {
    if (t.indexOf(w) >= 0) return "";
  }
  return t;
}
async function fetchJson(url, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs || 8000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        accept: "application/json,text/plain,*/*"
      }
    });
    if (!res.ok) throw new Error("http " + res.status);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}
async function collectHotTopics() {
  const override = String(process.env.CONTENTS_HOT_URL || "").trim();
  if (override) {
    const data = await fetchJson(override, 8000);
    if (Array.isArray(data)) {
      return data
        .map((x) => ({ topic: cleanTopic(x.title || x.word || ""), platform: x.platform || "热榜" }))
        .filter((x) => x.topic);
    }
    return [];
  }
  const jobs = [
    { id: "weibo", platform: "微博", url: "https://weibo.com/ajax/side/hotSearch" },
    { id: "baidu", platform: "百度", url: "https://top.baidu.com/api/board?platform=wise&tab=realtime" },
    { id: "zhihu", platform: "知乎", url: "https://www.zhihu.com/api/v3/feed/topstory/hot-lists/total?limit=50" }
  ];
  const out = [];
  for (const job of jobs) {
    try {
      const data = await fetchJson(job.url, 8000);
      let list = [];
      if (job.id === "weibo") {
        const realtime = data && data.data && Array.isArray(data.data.realtime) ? data.data.realtime : [];
        list = realtime.map((r) => r.word || r.note || "");
      } else if (job.id === "baidu") {
        const cards = data && data.data && Array.isArray(data.data.cards) ? data.data.cards : [];
        for (const card of cards) {
          // 新版结构：cards[].content[].content[].word；兼容旧结构 cards[].result[]
          if (card && Array.isArray(card.result)) {
            for (const it of card.result) list.push(it.word || it.query || "");
          }
          if (card && Array.isArray(card.content)) {
            for (const grp of card.content) {
              if (!grp || !Array.isArray(grp.content)) continue;
              for (const it of grp.content) list.push(it.word || it.query || it.text || "");
            }
          }
        }
      } else if (job.id === "zhihu") {
        const arr = data && Array.isArray(data.data) ? data.data : [];
        for (const it of arr) {
          const tgt = it && it.target;
          const title = tgt && (tgt.title || (tgt.question && tgt.question.title) || "");
          if (title) list.push(title);
        }
      }
      for (const t of list) {
        const c = cleanTopic(t);
        // 热度优先：保持来源（百度热搜）原始顺序；只过滤敏感/悲剧，不按词频重排
        if (c && !isLow(c)) out.push({ topic: c, platform: job.platform });
      }
    } catch (e) {
      console.error("[contents] fetch failed " + job.id + " " + (e && e.message));
    }
  }
  return out;
}

async function generateContent(topic) {
  const id = "ct_" + randomUUID().slice(0, 10);
  const userMsg =
    "请对最近这个热议话题做一次结构拆解（仅基于公开标题，不编造事实；聚焦生活/职场/消费/兴趣等普通议题，不要出现现任国家领导人姓名或任何政治性表述）：\n主题：" + topic.topic + "（来源：" + topic.platform + "）。";
  const content = await chatText({
    messages: [{ role: "system", content: ANALYSIS_SYSTEM_PROMPT }, { role: "user", content: userMsg }],
    temperature: 0.6,
    max_tokens: 5600,
    json: true
  });
  return normalizeAnalysis(extractJson(content) || {}, id, topic.topic, undefined);
}

async function insertEntry(entry) {
  await ensureTable();
  if (mysqlEnabled()) {
    await query(
      "INSERT INTO contents (id,title,platform,hook,payload,day_key,created_at) VALUES (?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE title=VALUES(title),platform=VALUES(platform),hook=VALUES(hook),payload=VALUES(payload)",
      [entry.id, entry.title, entry.platform, entry.hook || "", entry.payload, entry.dayKey, entry.createdAt]
    );
    await query("DELETE FROM contents WHERE created_at < ?", [Date.now() - KEEP_DAYS * 86400000]).catch(() => {});
  } else {
    mem.push(entry);
    while (mem.length && Date.now() - mem[0].createdAt > KEEP_DAYS * 86400000) mem.shift();
  }
}
function parsePayload(r) {
  try {
    return r.payload ? JSON.parse(r.payload) : {};
  } catch (e) {
    return {};
  }
}
function snapshotDesc(row) {
  try {
    const p = typeof row.payload === "string" ? JSON.parse(row.payload) : (row.payload || {});
    const result = p && p.result;
    if (!result) return "";
    const mats = (result.steps || []).find((s) => s.kind === "materials");
    let d = "";
    if (mats && Array.isArray(mats.materials)) {
      d = mats.materials.slice(0, 2).map((m) => (m && m.fact) || "").filter(Boolean).join("；");
    }
    const s = (d || result.verdict || "").replace(/\s+/g, " ").trim();
    return s.slice(0, 120);
  } catch (e) { return ""; }
}

async function listContents() {
  await ensureTable();
  const minDay = dayKeyOf(Date.now() - (KEEP_DAYS - 1) * 86400000);
  if (!mysqlEnabled()) {
    return mem
      .filter((e) => e.dayKey >= minDay)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((e) => ({ id: e.id, title: e.title, platform: e.platform, hook: e.hook || "", desc: snapshotDesc(e), day: e.dayKey }));
  }
  const [rows] = await query("SELECT id,title,platform,hook,payload,day_key FROM contents WHERE day_key >= ? ORDER BY created_at DESC LIMIT 30", [minDay]).catch(() => [[], []]);
  return (rows || []).map((r) => {
    const p = parsePayload(r);
    return { id: r.id, title: r.title, platform: r.platform, hook: p.hook || "", desc: snapshotDesc(r), day: r.day_key };
  });
}
async function getContent(id) {
  await ensureTable();
  if (!mysqlEnabled()) {
    const e = mem.find((x) => x.id === id);
    if (!e) return null;
    const p = parsePayload(e);
    return { id: e.id, title: e.title, platform: e.platform, hook: e.hook || p.hook || "", day: e.dayKey, result: p.result || null };
  }
  const [rows] = await query("SELECT * FROM contents WHERE id=? LIMIT 1", [id]).catch(() => [[], []]);
  if (!rows || !rows.length) return null;
  const r = rows[0];
  const p = parsePayload(r);
  return { id: r.id, title: r.title, platform: r.platform, hook: r.hook || p.hook || "", day: r.day_key, result: p.result || null, createdAt: r.created_at };
}
async function hasDay(dayKey) {
  await ensureTable();
  if (!mysqlEnabled()) return mem.some((e) => e.dayKey === dayKey);
  const [rows] = await query("SELECT id FROM contents WHERE day_key=? LIMIT 1", [dayKey]).catch(() => [[], []]);
  return !!(rows && rows.length);
}
async function purgeBlockedToday() {
  await ensureTable();
  const today = dayKeyOf(Date.now());
  if (!mysqlEnabled()) {
    for (let i = mem.length - 1; i >= 0; i--) {
      if (mem[i].dayKey === today && BLOCK_WORDS.some((w) => mem[i].title.indexOf(w) >= 0)) {
        mem.splice(i, 1);
      }
    }
    return;
  }
  const [rows] = await query("SELECT id,title FROM contents WHERE day_key=?", [today]).catch(() => [[], []]);
  for (const r of rows || []) {
    if (BLOCK_WORDS.some((w) => String(r.title || "").indexOf(w) >= 0)) {
      await query("DELETE FROM contents WHERE id=?", [r.id]).catch(() => {});
      console.log("[contents] purged blocked " + String(r.title || "").slice(0, 40));
    }
  }
}
async function ensureTodayContent() {
  const today = dayKeyOf(Date.now());
  await purgeBlockedToday().catch(() => {});
  const existing = await listContents().catch(() => []);
  const todayCount = (existing || []).filter((e) => e.day === today).length;
  if (todayCount >= DAILY_TARGET || generating) return;
  generating = true;
  try {
    const recent = existing;
    const topics = await collectHotTopics().catch(() => []);
    console.log("[contents] today=" + today + " have=" + todayCount + " topics=" + topics.length);
    let made = 0;
    for (const t of topics) {
      if (made + todayCount >= DAILY_TARGET) break;
      if (recent.some((r) => sim(r.title, t.topic) >= 0.55)) continue;
      try {
        const result = await generateContent(t);
        const hook = (result && result.verdict) || "";
        await insertEntry({
          id: (result && result.id) || "ct_" + randomUUID().slice(0, 10),
          title: t.topic,
          platform: t.platform,
          hook: hook,
          payload: JSON.stringify({ hook: hook, result: result }),
          dayKey: today,
          createdAt: Date.now()
        });
        made++;
        recent.push({ title: t.topic, day: today });
        console.log("[contents] generated " + (todayCount + made) + "/" + DAILY_TARGET + " " + t.topic.slice(0, 40));
      } catch (e) {
        console.error("[contents] gen failed " + (e && e.message));
      }
    }
    if (!made) console.error("[contents] no topic generated today");
    else console.log("[contents] day done made=" + made + " total=" + (todayCount + made));
  } finally {
    generating = false;
  }
}

function nextRunDelayMs() {
  const now = Date.now();
  const d = new Date(now + TZ_MS);
  const target = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), DAILY_HOUR, DAILY_MINUTE) - TZ_MS;
  let t = target;
  if (t <= now) t += 86400000;
  return t - now;
}
function startDaily() {
  if (timer) return;
  setTimeout(() => ensureTodayContent().catch(() => {}), 8000);
  const arm = function () {
    timer = setTimeout(function () {
      ensureTodayContent().catch(function () {});
      arm();
    }, nextRunDelayMs());
  };
  arm();
}

module.exports = { startDaily, ensureTodayContent, listContents, getContent, collectHotTopics };
