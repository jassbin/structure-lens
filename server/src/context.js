// [v21.7] 今日拆解内容模块
// - 数据源：公开热榜（微博/百度/知乎）仅抓取「标题 + 平台名」，不抓正文、不采链接正文
// - 每日生成 1 条结构拆解，滚动保留近 7 天，day_key 为 Asia/Shanghai 日期，保证日日不同
// - 全部界面文案不使用 AI / 资讯 / 新闻 字样（前端负责，本模块不产出营销文案）
const { randomUUID } = require("crypto");
const { mysqlEnabled, query } = require("./db");
const { chatText } = require("./ai-client");
const { ANALYSIS_SYSTEM_PROMPT, extractJson } = require("./prompt");
const { normalizeAnalysis } = require("./validate");

const TZ_MS = 8 * 3600 * 1000; // Asia/Shanghai offset
const DAILY_HOUR = 6;
const DAILY_MINUTE = 35;
const KEEP_DAYS = 7;

const memContents = []; // mysql 未配置时的内存兜底
let tableEnsured = false;
let generating = false;
let timer = null;

function dayKeyOf(ms) {
  return new Date((ms || Date.now()) + TZ_MS).toISOString().slice(0, 10);
}

function norm(s) {
  return String(s || "").replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "");
}
// 标题相似度：bigram 重叠率，用于去重（不同平台同话题）
function sim(a, b) {
  const A = norm(a), B = norm(b);
  if (!A || !B) return 0;
  if (A === B) return 1;
  const grams = new Set();
  for (let i = 0; i < A.length - 1; i++) grams.add(A.slice(i, i + 2));
  let hit = 0;
  for (let i = 0; i < B.length - 1; i++) if (grams.has(B.slice(i, i + 2))) hit++;
  const denominator = Math.max(1, A.length - 1, B.length - 1);
  return hit / denominator;
}

async function ensureTable() {
  if (!mysqlEnabled() || tableReady) return;
  try {
    await query(
      "CREATE TABLE IF NOT EXISTS contents (id VARCHAR(64) PRIMARY KEY, title VARCHAR(255) NOT NULL, platform VARCHAR(32) DEFAULT '', hook TEXT, payload TEXT, day_key VARCHAR(10), created_at BIGINT, KEY idx_contents_day (day_key))",
      [],
    );
    tableReady = true;
  } catch (e) {
    console.error("[contents] table create failed", e && e.message);
  }
}

// ---------- 热榜抓取 ----------
const BAD_WORDS = ["广告", "推广", "推荐", "干货", "热搜"];
function cleanTitle(s) {
  const t = String(s || "").trim();
  if (t.length < 4) return "";
  for (const w of BAD_WORDS) if (t.indexOf(w) >= 0) return "";
  return t;
}
async function fetchJson(url, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs || 8000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", accept: "application/json,text/plain,*/*" },
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
    return Array.isArray(data) ? data.map((x) => ({ title: cleanTopic(x.title || x.word || ""), platform: x.platform || "热榜" })).filter((x) => x.title) : [];
  }
  const jobs = [
    { platform: "微博", url: "https://weibo.com/ajax/side/hotSearch" },
    { platform: "百度", url: "https://top.baidu.com/api/board?platform=wise&tab=realtime" },
    { platform: "知乎", url: "https://www.zhihu.com/api/v3/feed/topstory/hot-lists/total?limit=50" },
  ];
  const out = [];
  for (const job of jobs) {
    try {
      const data = await fetchJson(job.url, 8000);
      let list = [];
      if (job.id === "weibo") {
        const realtime = data && data.data && Array.isArray(data.data.realtime) ? data.data.realtime : [];
        list = realtime.map((r) => ({ topic: r.word || r.note || "" }));
      } else if (job.id === "baidu") {
        const content = data && data.data && Array.isArray(data.data.cards) ? data.data.cards : [];
        list = [];
        for (const card of content) if (card && Array.isArray(card.result)) for (const it of card.result) list.push({ topic: it.word || it.query || "" });
      } else if (job.id === "zhihu") {
        list = (data && Array.isArray(data.data) ? data.data : []).map((it) => ({ topic: it.target && (it.target.title || it.target.question && it.target.question.title) || "" }));
      }
      for (const it of list) {
        const t = cleanTopic(it.topic);
        if (t) out.push({ topic: t, platform: job.platform });
      }
    } catch (e) {
      console.error("[contents] fetch failed " + job.id + " " + (e && e.message));
    }
  }
  return out;
}

// ---------- 生成 ----------
async function generateContent(topic) {
  const id = "ct_" + randomUUID().slice(0, 10);
  const userContent = "请对最近这个热议话题做一次结构拆解（只用公开标题信息，不编造事实）：\n主题：" + topic.topic + "（来源：" + topic.platform + "）。";
  const content = await chatText({
    messages: [{ role: "system", content: ANALYSIS_SYSTEM_PROMPT }, { role: "user", content: userContent }],
    temperature: 0.6,
    max_tokens: 5600,
    json: true,
  });
  return normalizeAnalysis(extractJson(content) || {}, id, topic.topic, undefined);
}

// ---------- 存储 ----------
function fmtRow(r) {
  let payload = {};
  try { payload = r.payload ? JSON.parse(r.payload) : {}; } catch (e) { /* ignore */ }
  return {
    id: r.id,
    title: r.title,
    platform: r.platform || "",
    hook: payload.hook || "",
    day: r.day_key,
    result: payload.result || null,
    createdAt: r.created_at,
  };
}
async function insertEntry(entry) {
  await ensureTable();
  const [rows] = entryPayload = null;
  if (mysqlEnabled()) {
    await query(
      "INSERT INTO contents (id,title,platform,payload,day_key,created_at) VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE title=VALUES(title),platform=VALUES(platform),payload=VALUES(payload)",
      [entry.id, entry.title, entry.platform, entry.payload, entry.dayKey, entry.createdAt],
    );
    // 滚动清理：只保留近 KEEP_DAYS
    await query("DELETE FROM contents WHERE created_at < ?", [Date.now() - KEEP_DAYS * 86400000]).catch(() => {});
  } else {
    mem.push(entry);
    while (mem.length && Date.now() - mem[0].createdAt > KEEP_DAYS * 86400000) mem.shift();
  }
}
async function listContents() {
  await ensureTable();
  const minDay = dayKeyOf(Date.now() - (KEEP_DAYS - 1) * 86400000);
  if (!mysqlEnabled()) {
    return mem
      .filter((e) => e.dayKey >= minDay)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((e) => ({ id: e.id, title: e.title, platform: e.platform, hook: e.hook, day: e.dayKey }));
  }
  const [rows] = await query("SELECT id,title,platform,payload,day_key,created_at FROM contents WHERE day_key >= ? ORDER BY created_at DESC LIMIT 30", [minDay]).catch(() => [[], []]);
  return (rows || []).map((r) => ({ id: r.id, title: r.title, platform: r.platform, hook: (fmtRow(r)).hook, day: r.day_key }));
}
async function getContent(id) {
  await ensureTable();
  if (!mysqlEnabled()) {
    const e = mem.find((x) => x.id === id);
    return e ? { id: e.id, title: e.title, platform: e.platform, hook: e.hook, day: e.dayKey, result: e.result } : null;
  }
  const [rows] = await query("SELECT id,title,platform,payload,day_key,created_at FROM contents WHERE id=? LIMIT 1", [id]).catch(() => [[], []]);
  if (!rows || !rows.length) return null;
  const r = rows[0];
  const p = (() => { try { return r.payload ? JSON.parse(r.payload) : {}; } catch (e2) { return {}; } })();
  return { id: r.id, title: r.title, platform: r.platform, hook: p.hook || "", day: r.day_key, result: p.result || null, createdAt: r.created_at };
}
async function hasDay(dayKey) {
  await ensureTable();
  if (!mysqlEnabled()) return mem.some((e) => e.dayKey === dayKey);
  const [rows] = await query("SELECT id FROM contents WHERE day_key=? LIMIT 1", [dayKey]).catch(() => [[], []]);
  return !!(rows && rows.length);
}
async function ensureTodayContent() {
  const today = dayKeyOf(Date.now());
  const exists = await hasDay(today).catch(() => false);
  if (exists || generating) return;
  generating = true;
  try {
    const recent = await listContents().catch(() => []);
    const topics = await collectHotTopics().catch(() => []);
    console.log("[contents] today=" + today + " topics=" + topics.length);
    for (const t of topics) {
      if (recent.some((r) => sim(r.title, t.topic) >= 0.55)) continue;
      try {
        const result = await generateContent(t);
        const hook = (result && result.verdict) || "";
        await insertEntry({
          id: (result && result.id) || "ct_" + randomUUID().slice(0, 10),
          title: t.topic,
          platform: t.platform,
          hook,
          payload: JSON.stringify({ hook, result }),
          dayKey: today,
          createdAt: Date.now(),
        });
        console.log("[contents] generated title=" + t.topic.slice(0, 40));
        return;
      } catch (e) {
        console.error("[contents] gen failed " + (e && e.message));
      }
    }
    console.error("[contents] no topic generated today");
  } finally {
    generating = false;
  }
}
function nextRunDelayMs() {
  const now = Date.now();
  const d = new Date(now + TZ_MS);
  const target = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), DAILY_TIME, DAILY_MINUTE) - TZ_MS;
  let t = target;
  if (t <= now) t += 86400000;
  return t - now;
}
function startDaily() {
  if (timer) return;
  // 启动后 8s 先补当日（若缺失），再按 07:35 定时
  setTimeout(() => ensureTodayDone().catch(() => {}), 8000);
  const arm = () => {
    timer = setTimeout(() => {
      ensureTodayDone().catch(() => {});
      arm();
    }, nextRunDelayMs());
  };
  arm();
}

module.exports = { startDaily, ensureTodayDone, listContents, getContent, collectHotTopics, }

