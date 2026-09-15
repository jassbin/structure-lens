// 分析类路由：precheck / analyze / drill / recompute / walk-focus / analyses
// 全部免登录（getOptionalUser 语义）：有 openid 落库；无则前端本地存。

const express = require("express");
const { randomUUID } = require("crypto");

const { getOptionalUser } = require("../auth");
const { chatText } = require("../ai-client");
const {
  ANALYSIS_SYSTEM_PROMPT,
  ALIGN_SUMMARY_SYSTEM_PROMPT,
  recomputeSystemPrompt,
  serializeStepsForContext,
  WALK_FOCUS_SYSTEM_PROMPT,
  drillSystemPrompt,
  extractJson,
} = require("../prompt");
const { normalizeAnalysis, applyRecompute, STEP_ORDER, emptyStepKinds } = require("../validate");
const { triageInput } = require("../triage");
const { ddgSearch, formatSearchContext } = require("../search");
const {
  upsertUser,
  insertAnalysis,
  mergeStructure,
  updateAnalysis,
  getAnalysisById,
  listRecentAnalyses,
} = require("../store");

const router = express.Router();

const STEP_LABELS_ZH = {
  materials: "材料与信源分级",
  anomaly: "异常锁定",
  skeleton: "中性骨架",
  mechanism: "机制穿透",
  game: "博弈与类比",
  scenario: "情景分支",
  judgment: "核心判断",
  adversarial: "对抗质检",
};

function makeId() {
  return randomUUID().slice(0, 16);
}

// ---------------------------------------------------------------
// 长任务异步化 —— 关键约束：wx.cloud.callContainer 的 timeout 硬上限 15s，
// 而 /api/analyze 走 AI 结构分析可达 30s+，绝不能同步等它。
// 做法：POST /api/analyze 立即返回 {taskId}，后台跑推理；前端轮询
// GET /api/analyses/:taskId/poll 取结果。任务表仅在进程内（单实例云托管够用）。
// ---------------------------------------------------------------
const TASKS = new Map(); // taskId -> {status: pending|done|error, result?, error?, createdAt}

function createTask() {
  const id = `at_${Date.now().toString(36)}_${randomUUID().slice(0, 6)}`;
  const now = Date.now();
  for (const [k, v] of TASKS) {
    if (now - v.createdAt > 30 * 60 * 1000) TASKS.delete(k);
  }
  TASKS.set(id, { status: "pending", createdAt: now });
  return id;
}
function finishTaskOk(id, result) {
  const t = TASKS.get(id);
  if (t && t.status === "pending") t.status = "done", (t.result = result);
}
function finishTaskErr(id, error) {
  const t = TASKS.get(id);
  if (t && t.status === "pending") t.status = "error", (t.error = error);
}

// ---------- POST /api/precheck ----------
router.post("/precheck", async (req, res) => {
  const user = getOptionalUser(req);
  const input = String(req.body?.input ?? "").trim();
  if (!input) {
    return res.json({
      status: "too_shallow",
      triage: {
        verdict: "too_shallow",
        probes: [
          "这件事里，最让你觉得'不对劲'的具体决定或动作是什么？",
          "涉及哪些主体？他们各自想要什么？",
        ],
      },
    });
  }
  const triage = triageInput(input);
  if (triage.verdict === "diggable") {
    return res.json({ status: "diggable" });
  }
  const SEARCH_BUDGET_MS = 3000; // precheck 整体预算：搜索 3s + 摘要 2.5s，防止单请求逼近 15s 容器上限
  const SUMMARY_BUDGET_MS = 2500;
  let searchResults = [];
  try {
    searchResults = await Promise.race([
      ddgSearch(input, 6).catch(() => []),
      new Promise((r) => setTimeout(() => r([]), SEARCH_BUDGET_MS)),
    ]);
  } catch {}
  if (searchResults.length === 0) {
    return res.json({ status: triage.verdict, triage });
  }
  const sources = searchResults.slice(0, 4).map((r) => ({ title: r.title, url: r.url }));
  let summary = "";
  try {
    summary = await Promise.race([
      chatText({
        messages: [
          { role: "system", content: ALIGN_SUMMARY_SYSTEM_PROMPT },
          { role: "user", content: `用户输入：${input}

【检索资料】
${formatSearchContext(searchResults)}` },
        ],
        temperature: 0.3,
        max_tokens: 512,
      }),
      new Promise((r) => setTimeout(() => r(""), SUMMARY_BUDGET_MS)),
    ]);
  } catch (e) {
    console.error("[precheck] summary failed", e && e.message);
    return res.json({ status: triage.verdict, triage });
  }
  summary = (summary || "").trim();
  if (!summary) return res.json({ status: triage.verdict, triage });
  return res.json({ status: "align", input, summary, sources });
});

// ---------- POST /api/analyze ----------
// 异步任务版：立即返回 task_id，后台跑完整分析；前端轮询 poll。
router.post("/analyze", async (req, res) => {
  const user = getOptionalUser(req);
  const body = req.body || {};
  const input = String(body.input ?? "").trim();
  const aligned = Boolean(body.aligned);
  const alignedSources = Array.isArray(body.alignedSources) ? body.alignedSources : [];

  const triage = triageInput(input);
  if (!aligned && triage.verdict !== "diggable") {
    return res.json({ status: triage.verdict, triage });
  }

  const preAligned = alignedSources.length > 0;
  const taskId = createTask();
  const uid = user ? user.id : null;

  // 后台异步执行，不阻塞本请求响应（避免云调用 15s 硬超时）
  const w = setTimeout(() => finishTaskErr(taskId, "ai_timeout"), 240000);
  runAnalysisTask(taskId, { input, aligned, alignedSources, pre: preAligned, uid })
    .then(() => clearTimeout(w))
    .catch((err) => {
      console.error("[analyze] task failed", err && err.message);
      finishTaskErr(taskId, (err && err.message) || "ai_failed");
      clearTimeout(w);
    });

  // 毫秒级返回，给前端 task_id 去轮询
  return res.json({ status: "accepted", taskId });
});

async function runAnalysisTask(taskId, ctx) {
  const { input, uid } = ctx;
  const alignedSources = Array.isArray(ctx.alignedSources) ? ctx.alignedSources : [];
  const pre = alignedSources.length > 0;
  console.log(`[analyze] run started taskId=${taskId} pre=${pre} input=${(input || "").slice(0, 30)}`);

  let searchResults = [];
  if (!pre) {
    try {
      searchResults = await ddgSearch(input, 6).catch(() => []);
    } catch {}
  }
  const sources = pre
    ? alignedSources
    : searchResults.length > 0
      ? searchResults.slice(0, 4).map((r) => ({ title: r.title, url: r.url }))
      : undefined;

  let sourceContext = "";
  if (searchResults.length > 0) {
    sourceContext = formatSearchContext(searchResults);
  } else if (pre && sources && sources.length) {
    sourceContext = sources.map((s, i) => `[${i + 1}] ${s.title}\n来源：${s.url}`).join("\n\n");
  }

  const analysisTarget = sourceContext
    ? `用户输入（已与用户确认）：${input}\n\n【相关来源，仅供对齐事实，与输入无关请忽略】\n${sourceContext}`
    : input;

  let content = "";
  content = await chatText({
    messages: [
      { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
      { role: "user", content: analysisTarget },
    ],
    temperature: 0.6,
    max_tokens: 5600,
    json: true, // 强制 JSON 输出，根治 ai_parse_failed
  });

  let result;
  try {
    result = normalizeAnalysis(extractJson(content), makeId(), input, sources ? { sources } : undefined);
  } catch (e) {
    console.error("[analyze] parse failed", e && e.message, (content || "").slice(0, 400), "len=" + (content || "").length);
    // 首次解析失败：截断是头号嫌疑。重试一次，把 temperature 归零 + 更大 token 上限，
    // 并命令模型"只输出 JSON、不得截断"。多数情况下第二次能拿到完整 JSON。
    try {
      const retryContent = await chatText({
        messages: [
          { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
          { role: "user", content: analysisTarget + "\n\n（注意：上次输出不完整。请一次性输出完整 JSON，不要截断、不要省略任何字段。）" },
        ],
        temperature: 0.2,
        max_tokens: 7600,
        json: true,
      });
      result = normalizeAnalysis(extractJson(retryContent), makeId(), input, sources ? { sources } : undefined);
    } catch (e2) {
      console.error("[analyze] retry parse failed", e2 && e2.message);
      throw new Error("ai_parse_failed");
    }
  }

  // v17: 空节自修复——模型偶尔漏输出某节（空数组/空串），触发一次补全重生成
  const emptyKinds = emptyStepKinds(result.steps);
  if (emptyKinds.length > 0) {
    console.error("[analyze] empty steps detected, repairing: " + emptyKinds.join(","));
    try {
      const repairPrompt =
        analysisTarget +
        "\n\n（注意：你上次输出的 JSON 缺少或留空了这几节：" +
        emptyKinds.join("、") +
        "。请重新输出一份完整 JSON，保证 materials/anomaly/skeleton/mechanism/game/scenario/judgment/adversarial 每一节都有充实内容，禁止省略、禁止留空数组、禁止截断。）";
      const repairContent = await chatText({
        messages: [
          { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
          { role: "user", content: repairPrompt },
        ],
        temperature: 0.2,
        max_tokens: 7600,
        json: true,
      });
      const repaired = normalizeAnalysis(extractJson(repairContent), result.id, input, sources ? { sources } : undefined);
      if (emptyStepKinds(repaired.steps).length < emptyKinds.length) {
        result = repaired;
        console.error("[analyze] empty steps repaired, still: " + emptyStepKinds(repaired.steps).join(","));
      }
    } catch (e) {
      console.error("[analyze] repair failed", e && e.message);
    }
  }

  if (uid) {
    // 入库是有时效性的"锦上添花"：云数据库可能没配/连不上（ETIMEDOUT 169.254.x.x），
    // 绝不能让它挂死阻塞 finishTaskOk，否则前端轮询 90s 一到就报"分析超时"。
    // 用一个 Promise.race 给整段入库设硬超时，超时就跳过入库直接出结果。
    try {
      await Promise.race([
        (async () => {
          try {
            await upsertUser({ id: uid });
            await insertAnalysis(uid, result);
            await mergeStructure(uid, result.skeleton, result.verdict);
          } catch (e) {
            console.error("[analyze] persist failed", e && e.message);
          }
        })(),
        new Promise((res) => setTimeout(res, 8000)), // 入库最多等 8s，绝不阻塞分析结果
      ]);
    } catch (e) {
      console.error("[analyze] persist race failed", e && e.message);
    }
  }
  console.log(`[analyze] run done taskId=${taskId} steps=${(result && result.steps && result.steps.length) || 0} verdictLen=${((result && result.verdict) || "").length}`);
  finishTaskOk(taskId, result);
}

// ---------- GET /api/analyses/:taskId/poll ----------
router.get("/analyses/:taskId/poll", (req, res) => {
  const t = TASKS.get(String(req.params.taskId || "").trim());
  if (!t) {
    return res.status(404).json({ error: "task_not_found" });
  }
  if (t.status === "pending") {
    return res.json({ done: false });
  }
  if (t.status === "error") {
    return res.json({ done: true, error: t.error || "ai_failed" });
  }
  return res.json({ done: true, result: t.result });
});

// ---------- POST /api/recompute ----------
// 「我不同意」从某步重算下游。同步 await AI（20s+）会撞 wx.cloud.callContainer
// 15s 硬超时 → 102002 → 前端"重算失败"。因此改为异步任务版：POST 秒回 taskId，
// 后台跑 runRecomputeTask，前端轮询 GET /api/analyses/:taskId/poll 取结果。
router.post("/recompute", async (req, res) => {
  const user = getOptionalUser(req);
  const body = req.body || {};
  const base = body.result;
  const fromStepKind = body.fromStepKind;
  const disagreement = String(body.disagreement ?? "").trim();

  const isSkeletonCard = fromStepKind === "skeleton-card";
  const validTarget =
    isSkeletonCard || (fromStepKind && STEP_ORDER.includes(fromStepKind));
  if (!base || !fromStepKind || !validTarget) {
    return res.status(400).json({ error: "参数不完整" });
  }
  if (!disagreement) {
    return res.status(400).json({ error: "请先写下你的反对意见" });
  }

  const taskId = createTask();
  const uid = user ? user.id : null;
  console.log(`[recompute] POST accepted taskId=${taskId} fromStep=${fromStepKind} disagree=${disagreement.slice(0, 20)}`);

  const w = setTimeout(() => finishTaskErr(taskId, "ai_timeout"), 240000);
  runRecomputeTask(taskId, { base, fromStepKind, disagreement, uid, isSkeletonCard })
    .then(() => clearTimeout(w))
    .catch((err) => {
      console.error("[recompute] task failed", err && err.message);
      finishTaskErr(taskId, (err && err.message) || "ai_failed");
      clearTimeout(w);
    });

  // 毫秒级返回 taskId，前端去轮询，绝不阻塞（杜绝 15s 超时 102002）
  return res.json({ status: "accepted", taskId });
});

async function runRecomputeTask(taskId, ctx) {
  const { base, fromStepKind, disagreement, uid, isSkeletonCard } = ctx;
  console.log(`[recompute] run started taskId=${taskId} fromStep=${fromStepKind}`);

  const fromIdx = isSkeletonCard ? -1 : STEP_ORDER.indexOf(fromStepKind);
  const upstream = isSkeletonCard
    ? []
    : (base.steps || []).filter((s) => STEP_ORDER.indexOf(s.kind) < fromIdx);
  const downstream = isSkeletonCard
    ? base.steps || []
    : (base.steps || []).filter((s) => STEP_ORDER.indexOf(s.kind) >= fromIdx);

  const stepLabel = isSkeletonCard
    ? "结构骨架卡"
    : (STEP_LABELS_ZH[fromStepKind] ?? String(fromStepKind));

  const targetContent = isSkeletonCard
    ? `\n【被反对的这一节：结构骨架卡（当前内容）】\n${serializeStepsForContext([base.skeleton])}`
    : `\n【被反对的这一节及其下游（当前内容，供参考）】\n${serializeStepsForContext(downstream)}`;

  const userContent = [
    `原始输入：${base.input}`,
    `\n【已确定的上游（保持不变，作为约束）】\n${serializeStepsForContext(upstream)}`,
    targetContent,
    `\n【用户对「${stepLabel}」这一节的反对意见】\n${disagreement}`,
    `\n请先对「${stepLabel}」表态（absorb/compromise/hold）并给理由，再按约定输出 JSON。`,
  ].join("\n");

  let content = "";
  try {
    content = await chatText({
      messages: [
        { role: "system", content: recomputeSystemPrompt(fromStepKind, stepLabel) },
        { role: "user", content: userContent },
      ],
      temperature: 0.6,
      max_tokens: 5600,
      json: true,
    });
  } catch (e) {
    console.error("[recompute] AI failed", e && e.message);
    throw new Error("ai_failed");
  }

  let result;
  let changeNote = "";
  try {
    const parsed = extractJson(content) || {};
    changeNote = typeof parsed.changeNote === "string" ? parsed.changeNote : "";
    result = applyRecompute(base, parsed, fromStepKind, disagreement);
  } catch (e) {
    console.error("[recompute] parse failed", e && e.message, (content || "").slice(0, 300));
    throw new Error("ai_parse_failed");
  }

  if (uid) {
    try {
      await Promise.race([
        (async () => {
          try {
            await updateAnalysis(uid, result);
            await mergeStructure(uid, result.skeleton, result.verdict);
          } catch (e) {
            console.error("[recompute] persist failed", e);
          }
        })(),
        new Promise((res) => setTimeout(res, 8000)), // 入库 8s 兜底，不阻塞结果
      ]);
    } catch (e) {
      console.error("[recompute] persist race failed", e);
    }
  }

  console.log(`[recompute] run done taskId=${taskId}`);
  finishTaskOk(taskId, { result, changeNote, persisted: Boolean(uid) });
}

// ---------- POST /api/walk-focus ----------
router.post("/walk-focus", async (req, res) => {
  const user = getOptionalUser(req);
  const body = req.body || {};
  const direction = String(body.direction ?? "").trim();
  if (!direction) {
    return res.status(400).json({ error: "缺少方向" });
  }
  const query = body.reason ? `${direction} ${String(body.reason)}` : direction;
  let searchResults = [];
  try {
    searchResults = await ddgSearch(query, 8).catch(() => []);
  } catch {}
  if (searchResults.length === 0) {
    return res.json({ picked: false, title: direction, summary: "" });
  }
  try {
    const content = await chatText({
      messages: [
        { role: "system", content: WALK_FOCUS_SYSTEM_PROMPT },
        {
          role: "user",
          content: `同构方向：${direction}${body.reason ? `\n同构理由：${body.reason}` : ""}\n\n【检索资料】\n${formatSearchContext(searchResults)}`,
        },
      ],
      temperature: 0.4,
      max_tokens: 512,
    });
    const parsed = extractJson(content) || {};
    const title = String(parsed.title ?? "").trim();
    if (!parsed.picked || !title) {
      return res.json({ picked: false, title: direction, summary: "" });
    }
    return res.json({
      picked: true,
      title,
      summary: String(parsed.summary ?? "").trim(),
      hotness: parsed.hotness === "typical" ? "typical" : "hot",
      reason: String(parsed.reason ?? "").trim(),
    });
  } catch (e) {
    console.error("[walk-focus] failed", e && e.message);
    return res.json({ picked: false, title: direction, summary: "" });
  }
});

// ---------- GET /api/analyses/:id ----------
router.get("/analyses/:id", async (req, res) => {
  const user = getOptionalUser(req);
  if (!user) return res.status(401).json({ error: "login_required" });
  const result = await getAnalysisById(user.id, req.params.id).catch(() => null);
  if (!result) return res.status(404).json({ error: "not_found" });
  return res.json({ result });
});

// ---------- GET /api/analyses (recent) ----------
router.get("/analyses", async (req, res) => {
  const user = getOptionalUser(req);
  if (!user) return res.status(401).json({ error: "login_required" });
  const items = await listRecentAnalyses(user.id, 20).catch(() => []);
  return res.json({ items });
});

// ---------- POST /api/drill ----------
const DRILL_MODES = ["challenge", "deeper", "counter"];
router.post("/drill", async (req, res) => {
  const user = getOptionalUser(req);
  const body = req.body || {};
  const point = String(body.point ?? "").trim();
  const mode = DRILL_MODES.includes(body.mode) ? body.mode : "deeper";
  if (!point) return res.status(400).json({ error: "empty" });
  const userMsg = [
    body.verdict ? `本次分析的核心结论：${body.verdict}` : "",
    body.layerTitle ? `所在维度：${body.layerTitle}` : "",
    `用户点中的那一则判断：${point}`,
  ].filter(Boolean).join("\n");
  let text = "";
  try {
    text = await chatText({
      messages: [
        { role: "system", content: drillSystemPrompt(mode) },
        { role: "user", content: userMsg },
      ],
      temperature: 0.6,
      max_tokens: 512,
    });
  } catch (e) {
    console.error("[drill] AI failed", e && e.message);
    return res.status(502).json({ error: "ai_failed" });
  }
  return res.json({ text: String(text || "").trim(), mode });
});

// ---------- POST /api/client-log ----------
// frontend error report (preview/survey style): print to backend log for diagnosis
router.post("/client-log", (req, res) => {
  const body = req.body || {};
  const diag = Array.isArray(body.diag) ? body.diag.slice(0, 8) : [];
  const entry = {
    t: new Date().toISOString(),
    type: String(body.type || "frontend").slice(0, 40),
    msg: String(body.msg || "").slice(0, 200),
    diag,
  };
  console.error("[client-log]", JSON.stringify(entry));
  res.json({ ok: true });
});

module.exports = router;
