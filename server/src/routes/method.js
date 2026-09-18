// 复杂环境行动路由（异步任务版，根治 callContainer 15s 硬超时）
//   GET  /api/method?id=         读缓存结果（快）
//   POST /api/method             提交推演任务 -> {status:accepted,taskId} 或缓存命中 {status:done,result}
//   GET  /api/method/:taskId/poll  轮询 -> {done, result|error, stage, progress}
// 依赖：POST 体可选带 plan（行动方案全文）；不带则后端按 (user.id,id) 从库读行动方案。
// 缓存：进程内存 LRU（单实例云托管，重启后需重新点按钮重算）。

const express = require("express");
const { randomUUID } = require("crypto");
const { getOptionalUser } = require("../auth");
const { chatText } = require("../ai-client");
const { extractJson } = require("../prompt");
const { METHOD_SYSTEM_PROMPT, normalizeMethod } = require("../method");
const { getActionPlanById, getAnalysisById } = require("../store");

const router = express.Router();

const TASKS = new Map();
const CACHE = new Map();
const CACHE_TTL = 12 * 60 * 60 * 1000;
const CACHE_MAX = 800;

function cacheKey(uid, id) {
  return (uid || "anon") + ":" + (id || "");
}
function cacheGet(uid, id) {
  const it = CACHE.get(cacheKey(uid, id));
  if (!it) return null;
  if (Date.now() - it.at > CACHE_TTL) {
    CACHE.delete(cacheKey(uid, id));
    return null;
  }
  return it.result;
}
function cachePut(uid, id, result) {
  const key = cacheKey(uid, id);
  if (CACHE.size >= CACHE_MAX && !CACHE.has(key)) {
    const first = CACHE.keys().next();
    if (!first.done) CACHE.delete(first.value);
  }
  CACHE.set(key, { at: Date.now(), result });
}

function createTask() {
  const id = "md_" + Date.now().toString(36) + "_" + randomUUID().slice(0, 6);
  const now = Date.now();
  for (const [k, v] of TASKS) {
    if (now - v.createdAt > 30 * 60 * 1000) TASKS.delete(k);
  }
  TASKS.set(id, { status: "pending", stage: "queued", progress: 0, createdAt: now });
  return id;
}
function finishTaskOk(id, result) {
  const t = TASKS.get(id);
  if (t && t.status === "pending") { t.status = "done"; t.result = result; }
}
function finishTaskErr(id, error) {
  const t = TASKS.get(id);
  if (t && t.status === "pending") { t.status = "done"; t.error = error || "ai_failed"; }
}
function setTaskStage(id, stage, progress) {
  const t = TASKS.get(id);
  if (t && t.status === "pending") {
    t.stage = stage;
    if (typeof progress === "number") t.progress = progress;
  }
}
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

// ---------- GET /api/method?id= ----------
router.get("/", (req, res) => {
  const user = getOptionalUser(req);
  const id = String(req.query.id || "").trim();
  if (!id) return res.json({ result: null });
  const r = cacheGet(user ? user.id : null, id);
  return res.json({ result: r });
});

// ---------- POST /api/method ----------
router.post("/", (req, res) => {
  const user = getOptionalUser(req);
  const body = req.body || {};
  const id = String(body.id || "").trim();
  if (!id) return res.status(400).json({ error: "empty" });
  const regenerate = !!body.regenerate;
  const submit = () => {
    const taskId = createTask();
    const w = setTimeout(() => finishTaskErr(taskId, "ai_timeout"), 240000);
    runMethodTask(taskId, { user, id, plan: body.plan, analysis: body.analysis, question: body.question && String(body.question).slice(0, 400) })
      .then(() => clearTimeout(w))
      .catch((err) => {
        console.error("[method] task failed", err && err.message);
        finishTaskErr(taskId, (err && err.message) || "ai_failed");
        clearTimeout(w);
      });
    console.log("[method] POST accepted id=" + id + " regenerate=" + regenerate + " hasUser=" + !!user);
    return res.json({ status: "accepted", taskId });
  };
  if (!regenerate) {
    const hit = cacheGet(user ? user.id : null, id);
    if (hit) {
      console.log("[method] cache hit id=" + id);
      return res.json({ status: "done", result: hit });
    }
  }
  return submit();
});

// ---------- GET /api/method/:taskId/poll ----------
router.get("/:taskId/poll", (req, res) => {
  const t = TASKS.get(String(req.params.taskId || "").trim());
  if (!t) return res.status(404).json({ error: "task_not_found" });
  if (t.status === "pending") {
    return res.json({ done: false, stage: t.stage || "queued", progress: t.progress || 0 });
  }
  if (t.status === "done" && t.error) {
    return res.json({ done: true, error: t.error });
  }
  return res.json({ done: true, result: t.result || {} });
});

async function runMethodTask(taskId, ctx) {
  const { id } = ctx;
  const user = ctx.user;
  const uid = user ? user.id : null;
  setTaskStage(taskId, "reading", 0.12);

    // 行动方案：优先前端传的 plan，否则去库里取；结构分析三样都进模型（v21.11）
  let plan = ctx.plan || null;
  let analysis = null;
  if (uid) {
    if (!plan) {
      plan = await withTimeout(getActionPlanById(uid, id), 3000);
    }
    analysis = await withTimeout(getAnalysisById(uid, id), 3000).catch(() => null);
  }
  if (!analysis || !(analysis.input || analysis.verdict)) {
    analysis = ctx.analysis && typeof ctx.analysis === "object" ? ctx.analysis : null;
  }
  if (!plan) {
    return finishTaskErr(taskId, "need_plan");
  }

  const inputText = (analysis && (analysis.input || analysis.verdict)) || (plan.headline || "");
  const qText = ctx.question ? "【你的追问/反对】\n" + String(ctx.question) : "";
  const qHint = ctx.question ? "（你正在回应上面的追问：结果 JSON 中必须额外带 qas 数组：[{\"question\":\"追问原话\",\"answer\":\"针对追问的回应，2~3 句，与全文自洽\"}]；没有追问时 qas 输出 []。）" : "";
  const userMsg = [
    analysis && analysis.input ? "【事件/困扰】\n" + String(analysis.input) : "",
    analysis && analysis.verdict ? "【结构分析关键结论】\n" + String(analysis.verdict) : "",
    plan.headline ? "【行动方案标题】\n" + String(plan.headline) : "",
    qText,
    "【行动方案全文】\n" + JSON.stringify(plan, null, 2),
    qHint,
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 24000);

  let content = "";
  try {
    setTaskStage(taskId, "generating", 0.4);
    content = await chatText({
      messages: [
        { role: "system", content: METHOD_SYSTEM_PROMPT },
        { role: "user", content: userMsg },
      ],
      temperature: 0.6,
      max_tokens: 12000,
      json: true,
    });
  } catch (e) {
    console.error("[method] AI failed", e && e.message);
    return finishTaskErr(taskId, "ai_failed");
  }

  setTaskStage(taskId, "parsing", 0.8);
  let method = null;
  try {
    const parsed = extractJson(content);
    method = normalizeMethod(parsed);
  } catch (e) {
    console.error("[method] parse failed", e && e.message, (content || "").slice(0, 300));
    try {
      setTaskStage(taskId, "generating", 0.5);
      const retry = await chatText({
        messages: [
          { role: "system", content: METHOD_SYSTEM_PROMPT },
          { role: "user", content: userMsg + "\n\n（请输出完整、合法的 JSON，不要截断。）" },
        ],
        temperature: 0.3,
        max_tokens: 12000,
        json: true,
      });
      const parsed = extractJson(retry);
      method = normalizeMethod(parsed);
    } catch (e2) {
      console.error("[method] retry parse failed", e2 && e2.message);
      return finishTaskErr(taskId, "ai_parse_failed");
    }
  }


  // 用户带问题重算时：若模型漏输出 qas，单补一轮对话只回 qas（不重排全文）
  if (ctx.question && !(method.qas || []).length) {
    try {
      setTaskStage(taskId, "answering", 0.9);
      const qaText = await chatText({
        messages: [
          { role: "system", content: METHOD_SYSTEM_PROMPT },
          { role: "user", content: userMsg + "\n\n（注意：上一轮你漏了 qas。现在只输出一个 JSON 对象：{\"qas\":[{\"question\":\"用户质问原话\",\"answer\":\"针对该质问的回应，2~3 句\"}]}，其它字段一概不要。）" },
        ],
        temperature: 0.3,
        max_tokens: 2000,
        json: true,
      });
      const qaParsed = extractJson(qaText);
      const rows = Array.isArray(qaParsed && (qaParsed.qas || qaParsed.qa)) ? (qaParsed.qas || qaParsed.qa) : [];
      const qas = rows.slice(0, 4).map((x) => ({
        q: String((x && (x.question || x.q)) || ctx.question || "").slice(0, 120),
        answer: String((x && (x.answer || x.a)) || "").slice(0, 260),
      })).filter((x) => x.answer);
      if (qas.length) method.qas = qas;
    } catch (e) { console.error("[method] qas fallback failed", e && e.message); }
  }

  if (!method.focus && !method.map.length) {
    return finishTaskErr(taskId, "ai_parse_failed");
  }
  method.id = id;
  method.generatedAt = new Date().toISOString();
  cachePut(uid, id, method);
  console.log("[method] done id=" + id + " variables=" + method.variables.length + " map=" + method.map.length);
  return finishTaskOk(taskId, { method });
}

module.exports = router;