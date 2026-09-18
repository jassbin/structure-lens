// 行动方案路由（异步任务版，根治 callContainer 15s 硬超时）
// getActionPlan 与 recompute 都走 AI，单次可达 20s+，必须秒回 taskId + 轮询。
// 路由：
//   GET  /api/action?id=           读缓存方案（快，不需轮询）
//   GET  /api/action/list          已存方案摘要
//   POST /api/action               提交生成任务 -> {taskId}
//   GET  /api/action/:taskId/poll  轮询 -> {done, plan?|error?}
//   POST /api/action/recompute     提交重算任务 -> {taskId}
//   GET  /api/action/recompute/:taskId/poll  轮询重算结果

const express = require("express");
const { randomUUID } = require("crypto");
const { getOptionalUser } = require("../auth");
const { chatText } = require("../ai-client");
const { extractJson } = require("../prompt");
const {
  PERSPECTIVE_SYSTEM_PROMPT,
  STEPS_SYSTEM_PROMPT,
  MODULES_SYSTEM_PROMPT,
  forcedPerspectiveNote,
  normalizeActionPlan,
  normalizeActionRecompute,
  actionRecomputeSystemPrompt,
  ACTION_STEP_ORDER,
  downstreamStaleKeys,
  downstreamCascadePrompt,
  mergeStepDraft,
} = require("../action");
const {
  getActionPlanById,
  saveActionPlan,
  listActionPlans,
} = require("../store");

const router = express.Router();

function makeId() {
  return randomUUID().slice(0, 16);
}

// ---------------- 后台任务表（进程内存，单实例云托管够用） ----------------
const TASKS = new Map(); // taskId -> {status: pending|done|error, plan?, result?, error?, createdAt}
function createTask() {
  const id = `ac_${Date.now().toString(36)}_${randomUUID().slice(0, 6)}`;
  const now = Date.now();
  for (const [k, v] of TASKS) {
    if (now - v.createdAt > 30 * 60 * 1000) TASKS.delete(k);
  }
  TASKS.set(id, { status: "pending", createdAt: now });
  TASKS.get(id).stage = "queued";
  TASKS.get(id).progress = 0;
  return id;
}
function finishTaskOk(id, planRes) {
  const t = TASKS.get(id);
  if (t && t.status === "pending") { t.status = "done"; t.plan = planRes; }
}
function finishTaskErr(id, error) {
  const t = TASKS.get(id);
  if (t && t.status === "pending") { t.status = "done"; t.error = error || "ai_failed"; }
}
// [v21.6] poll returns real stage/progress. No analysis logic change.
function setTaskStage(id, stage, progress) {
  const t = TASKS.get(id);
  if (t && t.status === "pending") {
    t.stage = stage;
    if (typeof progress === "number") t.progress = progress;
  }
}

// ---------- GET /api/action?id= ----------
router.get("/", async (req, res) => {
  const user = getOptionalUser(req);
  const id = String(req.query.id ?? "").trim();
  if (!user || !id) return res.json({ plan: null });
  const plan = await getActionPlanById(user.id, id).catch(() => null);
  return res.json({ plan });
});

// ---------- GET /api/action/list ----------
router.get("/list", async (req, res) => {
  const user = getOptionalUser(req);
  if (!user) return res.json({ items: [] });
  const items = await listActionPlans(user.id, 200).catch(() => []);
  return res.json({ items });
});

// ---------- POST /api/action ----------
router.post("/", (req, res) => {
  const user = getOptionalUser(req);
  const body = req.body || {};
  const id = String(body.id ?? "").trim() || makeId();
  const input = String(body.input ?? "").trim();
  const verdict = String(body.verdict ?? "").trim();
  const sk = body.skeleton;
  if (!input && !verdict) {
    return res.status(400).json({ error: "empty" });
  }
  const forcedLabel = String(body.perspectiveLabel ?? "").trim() || null;
  const mustRegenerate = Boolean(body.regenerate || forcedLabel);

  // 命中缓存键（非强制重生成）直接返回，秒级，无需任务。
  // ★★★ 根因修复（v9）：缓存查询走数据库（wx-server-sdk 连内网 169.254.x.x），
  //     挂起时 getActionPlanById 可能永不 settle → 整个 POST 不返回 → 前端 15s 撞 102002。
  //     解决：给缓存查询包 3s 硬超时，超时按 cache-miss 直接提交任务返回 taskId。
  console.log(`[action] POST /api/action accepted id=${id} regenerate=${mustRegenerate} hasUser=${!!user}`);
  const submit = (note) => {
    const taskId = createTaskFor({ user, id, input, verdict, sk, forcedLabel });
    console.log(`[action] submit taskId=${taskId} (${note})`);
    res.json({ status: "accepted", taskId });
  };
  if (user && !mustRegenerate) {
    Promise.race([
      getActionPlanById(user.id, id),
      new Promise((resolve) => setTimeout(resolve, 3000)), // 3s 拿不到就当 miss，绝不阻塞 POST
    ])
      .then((existing) => {
        if (existing) {
          console.log(`[action] cache hit id=${id}`);
          return res.json({ status: "done", result: { plan: existing, cached: true } });
        }
        submit("cache-miss");
      })
      .catch(() => submit("err-fallback"));
  } else {
    submit("no-cache-check");
  }
});

function createTaskFor(ctx) {
  const taskId = createTask();
  const w = setTimeout(() => finishTaskErr(taskId, "ai_timeout"), 240000);
  runActionTask(taskId, ctx)
    .then(() => clearTimeout(w))
    .catch((err) => {
      console.error("[action] task failed", err && err.message);
      finishTaskErr(taskId, (err && err.message) || "ai_failed");
      clearTimeout(w);
    });
  return taskId;
}

const STEP_KEYS_V21 = ["pain", "triage", "selfDeception", "minimalAction", "crack", "placebo"];
const MODULE_KEYS_V21 = ["anchor", "recon", "probe", "pivot", "closure"];

function parsedOrNull(text) {
  try { return extractJson(text); } catch (e) { return null; }
}
function stepsCompleteV21(obj) {
  if (!obj || typeof obj !== "object") return false;
  const s = obj.steps && typeof obj.steps === "object" ? obj.steps : null;
  if (!s) return false;
  return STEP_KEYS_V21.every((k) => s[k] && typeof s[k] === "object" && Object.keys(s[k]).length > 0);
}
function modulesCompleteV21(obj) {
  if (!obj || typeof obj !== "object") return false;
  const m = obj.modules && typeof obj.modules === "object" ? obj.modules : null;
  if (!m) return false;
  return MODULE_KEYS_V21.every((k) => m[k] && typeof m[k] === "object" && Object.keys(m[k]).length > 0);
}

/** 单轨独立生成：一次调用，失败或结构不完整时重试一次（temp 归零 + 提示完整） */
const RETRY_HINT_V21 = "\n\n（注意：上次输出不完整，请一次性输出完整 JSON，不要截断、不要省略任何字段。）";
async function genOnceV21(system, userMsg, check) {
  const run = (msg, temperature) =>
    chatText({
      messages: [{ role: "system", content: system }, { role: "user", content: msg }],
      temperature,
      max_tokens: 12000,
      json: true,
    });
  let text;
  try {
    text = await run(userMsg, 0.7);
  } catch (e) {
    throw new Error("ai_failed");
  }
  const first = parsedOrNull(text);
  if (first && check(first)) return first;
  const retryText = await run(userMsg + RETRY_HINT_V21, 0.2);
  const second = parsedOrNull(retryText);
  if (second && check(second)) return second;
  throw new Error("ai_parse_failed");
}

async function runActionTask(taskId, ctx) {
  const { input, verdict, sk, forcedLabel } = ctx;
  const uid = ctx.user ? ctx.user.id : null;
  const id = ctx.id;
  console.log(`[action] run started taskId=${taskId} input=${(input || "").slice(0, 30)} forced=${forcedLabel || "无"}`);
  setTaskStage(taskId, "generating", 0.2);

  const userMsg = [
    `【用户的原始困惑/事件】\n${input || "(未提供)"}`,
    `【已看清的金句结论】\n${verdict || "(未提供)"}`,
    sk
      ? `【真实结构骨架】\n原本以为：${sk.perceivedAs || "（无）"}\n真实运作：${sk.actualStructure || "（无）"}\n为什么这样：${sk.whySo || "（无）"}\n根结构：${sk.root || "（无）"}`
      : "",
  ].filter(Boolean).join("\n\n");

  // ---- 第 1 步：锁定视角（两套生成共享，避免两套视角打架） ----
  let perspective = { id: "self", label: "作为当事人的你", isUser: true };
  let options = null;
  let note = "";
  if (forcedLabel) {
    perspective = { id: "forced", label: forcedLabel, isUser: true };
    options = [perspective];
    note = forcedPerspectiveNote(forcedLabel);
  } else {
    try {
      const pText = await chatText({
        messages: [{ role: "system", content: PERSPECTIVE_SYSTEM_PROMPT }, { role: "user", content: userMsg }],
        temperature: 0.3,
        max_tokens: 900,
        json: true,
      });
      const pj = parsedOrNull(pText);
      const parsed = pj && require("../action").parsePerspective(pj);
      if (parsed && parsed.perspective && parsed.perspective.label) {
        perspective = parsed.perspective;
        options = parsed.perspectiveOptions;
        note = forcedPerspectiveNote(perspective.label);
      }
    } catch (e) {
      console.warn("[action] perspective extract failed, fallback", e && e.message);
    }
  }
  if (!options) options = [perspective];
  const sysSteps = STEPS_SYSTEM_PROMPT + note;
  const sysModules = MODULES_SYSTEM_PROMPT + note;

  // ---- 第 2 步：六步与五模块**并行独立生成**，各自完整、深度，不再互相挤输出预算 ----
  let stepsRes = null;
  let modsRes = null;
  let firstErr = null;
  await Promise.all([
    (async () => {
      try { stepsRes = await genOnceV21(sysSteps, userMsg, stepsCompleteV21); }
      catch (e) { firstErr = firstErr || (e && e.message) || "steps_failed"; }
    })(),
    (async () => {
      try { modsRes = await genOnceV21(sysModules, userMsg, modulesCompleteV21); }
      catch (e) { firstErr = firstErr || (e && e.message) || "modules_failed"; }
    })(),
  ]);

  setTaskStage(taskId, "parsing", 0.75);
  if (!stepsRes && !modsRes) return finishTaskErr(taskId, firstErr || "ai_failed");

  const rawPlan = {
    perspectiveOptions: options,
    perspective,
    headline: (stepsRes && stepsRes.headline) || (modsRes && modsRes.headline) || "",
    steps: stepsRes ? stepsRes.steps : {},
    modules: modsRes ? modsRes.modules : {},
  };
  let plan;
  try {
    plan = normalizeActionPlan(rawPlan, id);
  } catch (e) {
    console.error("[action] normalize failed", e && e.message);
    return finishTaskErr(taskId, "ai_parse_failed");
  }

  setTaskStage(taskId, "saving", 0.9);
  if (uid) {
    try {
      await Promise.race([
        (async () => {
          try { await saveActionPlan(uid, id, plan).catch((e) => console.error("[action] persist failed", e)); }
          catch (e) { console.error("[action] persist err", e && e.message); }
        })(),
        new Promise((resolve) => setTimeout(resolve, 8000)),
      ]);
    } catch (e) {
      console.error("[action] persist race failed", e && e.message);
    }
  }
  console.log(`[action] run done taskId=${taskId} steps=${stepsRes ? "ok" : "derived"} modules=${modsRes ? "ok" : "derived"}`);
  finishTaskOk(taskId, { plan, persisted: Boolean(uid) });
}

// ---------- GET /api/action/:taskId/poll ----------
router.get("/:taskId/poll", (req, res) => {
  const t = TASKS.get(String(req.params.taskId || "").trim());
  if (!t) return res.status(404).json({ error: "task_not_found" });
  console.log(`[action] poll taskId=${req.params.taskId} status=${t.status}`);
  if (t.status === "pending") {
    return res.json({ done: false, stage: t.stage || "queued", progress: t.progress || 0 });
  }
  if (t.status === "error") return res.json({ done: true, error: t.error || "ai_failed" });
  return res.json({ done: true, result: t.plan });
});

// ---------- POST /api/action/recompute ----------
router.post("/recompute", (req, res) => {
  const user = getOptionalUser(req);
  const body = req.body || {};
  const base = body.plan;
  const fromStepKey = body.fromStepKey;
  const objection = String(body.objection ?? "").trim();
  if (!base || !fromStepKey || !ACTION_STEP_ORDER.includes(fromStepKey)) {
    return res.status(400).json({ error: "recompute 参数不完整" });
  }
  if (!objection) {
    return res.status(400).json({ error: "请先写下你的反驳或追问" });
  }
  const taskId = createTask();
  runRecomputeTask(taskId, { user, base, fromStepKey, objection }).catch((err) => {
    console.error("[action/recompute] task failed", err && err.message);
    finishTaskErr(taskId, (err && err.message) || "ai_failed");
  });
  res.json({ status: "accepted", taskId });
});

async function runRecomputeTask(taskId, ctx) {
  const { base, fromStepKey, objection } = ctx;
  const uid = ctx.user ? ctx.user.id : null;
  const t0 = Date.now();
  setTaskStage(taskId, "generating", 0.5);

  const userMsg = [
    `【行动方案的视角】${base.perspective.label}（id=${base.perspective.id}）`,
    `【被质疑这一节及下游的当前内容（供参考）】\n${JSON.stringify(base.steps, null, 2)}`,
    `【用户对这一节的反驳/追问】\n${objection}`,
  ].join("\n\n");

  let content = "";
  try {
    content = await chatText({
      messages: [
        { role: "system", content: actionRecomputeSystemPrompt(fromStepKey, base.perspective) },
        { role: "user", content: userMsg },
      ],
      temperature: 0.6,
      max_tokens: 8192,
      json: true,
    });
  } catch (e) {
    console.error("[action/recompute] AI failed", e && e.message);
    return finishTaskErr(taskId, "ai_failed");
  }

  setTaskStage(taskId, "parsing", 0.75);
  let plan, stance, changeNote;
  try {
    const parsed = extractJson(content);
    const out = normalizeActionRecompute(base, parsed, fromStepKey, objection);
    plan = out.plan; stance = out.stance; changeNote = out.changeNote;
  } catch (e) {
    console.error("[action/recompute] parse failed", e && e.message, (content || "").slice(0, 300));
    // 重试一次
    try {
      setTaskStage(taskId, "generating", 0.55);
      const retry = await chatText({
        messages: [
          { role: "system", content: actionRecomputeSystemPrompt(fromStepKey, base.perspective) },
          { role: "user", content: userMsg + "\n\n（请输出完整、合法的 JSON，不要截断。）" },
        ],
        temperature: 0.2,
        max_tokens: 8000,
        json: true,
      });
      const parsed = extractJson(retry);
      const out = normalizeActionRecompute(base, parsed, fromStepKey, objection);
      plan = out.plan; stance = out.stance; changeNote = out.changeNote;
    } catch (e2) {
      console.error("[action/recompute] retry parse failed", e2 && e2.message);
      return finishTaskErr(taskId, "ai_parse_failed");
    }
  }

  // 增量联动：模型若只让当前节变化，补一轮专门重写未同步的下游章节
  if (plan && stance && stance !== "hold" && Date.now() - t0 < 30000) {
    try {
      const stale = downstreamStaleKeys(base.steps, plan.steps, fromStepKey);
      if (stale.length) {
        const fixUserMsg = [
          "【用户引发本次重算的反馈】\n" + objection,
          "【当前方案全文（含已更新的那一节）】\n" + JSON.stringify(plan.steps, null, 2),
          "【仍未同步、必须联动重写的下游节】\n" + stale.join("、"),
        ].join("\n\n");
        setTaskStage(taskId, "cascading", 0.85);
        const fixText = await chatText({
          messages: [
            { role: "system", content: downstreamCascadePrompt(stale, base.perspective) },
            { role: "user", content: fixUserMsg },
          ],
          temperature: 0.6,
          max_tokens: 8192,
          json: true,
        });
        const fixParsed = extractJson(fixText);
        const merged = mergeStepDraft(plan, fixParsed);
        if (merged) {
          plan = Object.assign({}, plan, { steps: merged.steps, modules: merged.modules });
          const note = "后续关联章节已联动更新（" + stale.join("、") + "）";
          changeNote = changeNote ? changeNote + "；" + note : note;
          console.log("[action/recompute] downstream cascade ok keys=" + stale.join(","));
        }
      }
    } catch (e) {
      console.error("[action/recompute] downstream cascade failed", e && e.message);
    }
  }

  setTaskStage(taskId, "saving", 0.93);
  if (uid) {
    try {
      await Promise.race([
        (async () => {
          try { await saveActionPlan(uid, plan.id, plan).catch((e) => console.error("[action/recompute] persist failed", e)); }
          catch (e) { console.error("[action/recompute] persist failed", e && e.message); }
        })(),
        new Promise((resolve) => setTimeout(resolve, 8000)),
      ]);
    } catch (e) {
      console.error("[action/recompute] persist race failed", e && e.message);
    }
  }
  finishTaskOk(taskId, { plan, stance, changeNote, persisted: Boolean(uid) });
}

module.exports = router;
