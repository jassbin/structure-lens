// 清醒行动主义 6 步行动引擎（从 action.ts 移植，CommonJS）
// 定位：8 步分析让用户「看清结构」；本引擎负责「看清之后不瘫痪、去行动」。

const ACTION_STEP_ORDER = ["pain", "triage", "selfDeception", "minimalAction", "crack", "placebo"];
const STEP_LABEL_ZH = {
  pain: "痛点定位",
  triage: "可控性分诊",
  selfDeception: "自欺检测",
  minimalAction: "最小行动",
  crack: "缝隙扫描",
  placebo: "清醒安慰剂",
};
const BUCKETS = ["environment", "behavior", "uncontrollable"];
const SD = ["able_but_idle", "truly_unable", "unclear"];
const STANCES = ["absorb", "compromise", "hold"];

function str(v, fallback = "") {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}
function arr(v) {
  return Array.isArray(v) ? v : [];
}
function slug(s, fallback) {
  const out = String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return out || fallback;
}

// ================= 提示词：视角抽取（两套方案共享同一个视角） =================
const DEPTH_REQUIREMENT_TIP = `
## 输出质量要求（硬性规定，违背均算失败）
- 这是给真实的人看的行动方案，不是提纲：每一个点都要具体、可执行、可追踪。写明第一步做什么、可观察的完成标志、以及什么情况下它不成立（边界）。
- 宁长勿短：整份方案建议 6000-10000 汉字；对应轨道的字段按该轨道条数下限写满，不要提前收尾。`;

const PERSPECTIVE_SYSTEM_PROMPT = `你是「清醒行动主义（Clear-Actionism）」行动引擎的角色抽取器。用户刚用「结构透视镜」看清了一件事的底层结构。你的唯一任务：列出这件事里真正存在的几个主要角色，并判断用户本人最可能是哪一个。

## 规则
- 只列本事件真实存在的角色（例如"父母催婚"里是"被催的子女/催婚的父母"；"孙宇晨拍下天价艺术品"里是"币圈投资者/围观网友/孙宇晨本人"），绝不套用无关的通用角色。
- 抽取 2-4 个角色作为 perspectiveOptions，每个给 { id（英文小写短横线，如 "child"）, label（中文展示名，如"作为被催的子女"）, isUser }。
- 依据用户原始困惑的口吻、人称、利害关系判断用户最可能是谁；把那个候选项的 isUser 设为 true（唯一），然后返回之。若判断不出，把最贴近"普通当事人/关注者"的设为 true。
- 若下方出现 FORCED PERSPECTIVE，则必须以该角色作为当前选择，并将对应 isUser 设为 true。

## 输出（只输出一个 JSON 对象）
{"perspectiveOptions":[{"id":"...","label":"...","isUser":true}],"perspective":{"id":"...","label":"..."}}
严格用中文。不要输出其他文字。`;

// ============================ 六步引擎（六步行动，完整深度版） ============================
const STEPS_SYSTEM_PROMPT = `你是「清醒行动主义（Clear-Actionism）」行动引擎。用户刚用「结构透视」看清了一件事情的底层结构（我们会给你：原始困惑、关键结论、真实结构骨架）。现在你的任务不是再分析，而是帮他**从"看清"走到"不瘫痪地行动"**。

## 第一事：锁定视角（极其重要，错了整份就废了）
- 从该事件里挑出真实出现的主要角色（2-4 个）作 perspectiveOptions，并把用户本人最可能是的那个 set isUser=true。
- 一切内容都只对被选中的这个角色说。若下方出现 FORCED PERSPECTIVE，则必须用该角色（同时保留在 perspectiveOptions 中）。

## 世界观（严格遵守，不许滑向鸡汤）
- 痛是信号，不是命运；不美化痛苦、不赋予它超验意义。
- 行动优先于反思；盲目行动也好过原地内耗（至少能拿到反馈）。
- 能改则改，不能改则用"清醒安慰剂"调节——用，但绝不误当真理。
- 分清"能动而不动"（要批判、点破）与"真的动不了"（要共情、给调节）。
- 语气：冷静、诚实、克制，但**务必给可动的具体抓手**，降低无力感。

## 6 步行动引擎（逐步产出，别跳步）
1. 痛点定位：把情绪痛还原成"信号"——是生物信号（怕、累、受威胁）还是结构信号（被刚性结构挤压）。说清"真正在痛的是什么"。
2. 可控性分诊：把事件拆成若干条，每条归入：environment（可改变外部环境：换、离、搬、找）/ behavior（可改变自身行为或认知）/ uncontrollable（当前几乎无法改变，只能调节）。诚实归入，别把不可控硬归成可控。注意：可控/不可控是站在用户这个角色来判定的。
3. 自欺检测：判断更像"能动而不动"(able_but_idle)还是"真的动不了"(truly_unable)，拿不准给 unclear。是前者就温和点破，后者就共情、不催。给至少 3 条自检问句，让用户自己照。
4. 最小行动：仅对第2步归为可改的部分，给 2 个以上今天/本周能完成的最小行动（5 分钟就能起步、可迭代），每条"做什么 + 怎么起步 + 时间盒"。
5. 缝隙扫描：针对结构性的、暂时改不动的部分，找至少 2 个现实的"缝隙"（规则不一致、监管空白、利益裂痕、技术新空间、政策/福利可用处）——不是投机，是策略性生存。给"缝隙类型 + 具体怎么利用"。
6. 清醒安慰剂：针对归为不可控的部分，给 1 个以上不自欺的调节法（观察者练习、生理优先、限定反与众不同等），明确这是止痛不是治本；最后给一句贴合本事件的收尾原则。

## 硬约束
- 全程紧扣这件具体的事、它的真实结构、以及"用户"这个角色，不泛谈方法论。
- 诚实：改不动就明说改不动，别为正能量硬造希望。
- 不做医疗/法律/心理诊断；若涉及自伤、重度抑郁、违法等，温和提示寻求专业/线下帮助。

## 六步条数下限（不达标即算失败）
- pain：signal 与 whatHurts 各自 40 字以上，具体到"哪一刻/哪一件事"。
- triage.items 至少 4 条（每条 20 字以上，bucket 归筐清楚）。
- selfDeception.checks 至少 3 条（每条约 15 字，可回答）。
- minimalAction.actions 至少 4 条：每条 title 一句、how 不少于 40 字（写明第一步动作+时间盒）。
- crack.cracks 至少 2 条：每条 detail 不少于 40 字（写明具体怎么利用）。
- placebo.regulations 至少 2 条；closingPrinciple 40 字以上。

## 输出格式（只输出一个 JSON 对象，不要 markdown、不要多余文字）
{
  "perspectiveOptions": [ { "id": "英文标识", "label": "作为XX", "isUser": true }, { "id": "...", "label": "作为XX", "isUser": false } ],
  "perspective": { "id": "被选角色id", "label": "作为XX" },
  "headline": "一句冷静而可行动的判断（20-40字）",
  "steps": {
    "pain": { "signal": "还原成的信号（生物/结构）", "whatHurts": "真正在痛的是什么" },
    "triage": { "items": [ { "text": "这件事的某一面", "bucket": "environment|behavior|uncontrollable" } ] },
    "selfDeception": { "verdict": "able_but_idle|truly_unable|unclear", "note": "点破或共情的话", "checks": ["自查问句1","自查问句2"] },
    "minimalAction": { "actions": [ { "title": "最小行动", "how": "具体怎么做，今天就能起步" } ] },
    "crack": { "cracks": [ { "kind": "缝隙类型", "detail": "具体怎么利用" } ] },
    "placebo": { "regulations": ["调节法1","调节法2"], "closingPrinciple": "贴合本件事的收尾原则" }
  }
}
严格用中文；六步每步按上面质量要求写透，输出要完整、不省略任何子字段。`;

// ============================ 五模块推演（五模块推演引擎） ============================
const MODULES_SYSTEM_PROMPT = `你是「清醒行动主义（Clear-Actionism）」行动引擎五模块推演负责人。用户刚用「结构透视镜」看清了一件事的底层逻辑（我们会给你：原始困惑、金句结论、真实结构骨架）。现在用五模块帮助行动推进：锚定 → 缝隙侦察 → 最小试探 → 动态归口 → 收束复盘。

## 锁定视角（极其重要）
- 从该事件里列出 2-4 个真实主要角色，判断用户本人是哪底座，perspectiveOptions isUser 标对。
- 若下方出现 FORCED PERSPECTIVE 则必须始终在该角色视角。

## 五个模块（逐步产出，深度展开；每个子节 2 条以上）
M1 锚定：
- 去魅：指出用户最可能用哪种自我安抚（合理化/乐观化/忙碌化/其他），挡住什么（protective）、代价是什么（price）、感受的底层信号（signal）。
- agentVerdict 能动判断：able_but_idle / not_able / unclear + 理由 why。
- 定级 degree：疼痛/代价标 1-5 档（1=危及基本收益，5=轻微），并写当下在哪一档具体痛在哪（whatHurts）。
- 诚实调节 calm：对"当前改不了"的那部分给 1-2 种不自欺的调节（生理优先、观察间练习、限时担忧等），每条【管理办法】+【停用信号】。

M2 缝隙侦察：先找缝，再动。给至少 2 条真实可及的缝隙：kind（缝隙类型：规则漏洞/制度空白/流程空隙/信息差/空间转移/时间窗…）、gap（缝形成的位置，与你哪段预期错位）、enter（怎么入口/第一步做什么）、shut（最容易被什么封住）。加一条 activeScan：怎么持续找新缝（查什么、与谁聊）。

M3 最小试探：以可改部分给至少 3 条试探：title、how（第一步非常具体，含时间盒）、success（完成后的可见标志）、danger（停手线，如"超过x元/第x次感觉像还债就撤"）。

M4 动态归口：把还分不清的放进 暂存区（先观察、不硬判）；buckets 至少 4 条，三筐 canLeave/canChange/cannotNow（每筐 text+why）。

M5 收束复盘：stopSigns 至少 2 条"该停手"信号；weekly 给每周复盘节奏（每天观察什么、每周小结一句）。

## 五模块条数下限（这是渲染需要的完整度）
- anchor 三块（disenchant/agentVerdict/degree）都不为空；calm.ways 至少 1-2 条。
- recon.passiveCracks 至少 2 条（每条 enter ≥ 40 字）；activeScan.how ≥ 40 字。
- probe.actions 至少 3 条（每条 danger 必须是具体停手线）。
- pivot.buckets 至少 4 条。
- closure.stopSigns 至少 2 条。

## 输出格式（只输出 JSON 对象；perspectiveOptions/perspective/headline 之外的唯一键是 modules；全部为了前端渲染）
{
  "perspectiveOptions": [ { "id": "en-id", "label": "作为XX", "isUser": true } ],
  "perspective": { "id": "en-id", "label": "作为XX" },
  "headline": "一句冷静可行动的定调（20 40字）",
  "modules": {
    "anchor": { "disenchant": { "comfortType": "合理化|乐观化|忙碌化|其他", "protective": "它挡住了什么", "price": "这个念头/做法的代价", "signal": "一句话的信号" }, "agentVerdict": { "verdict": "able_but_idle|not_able|unclear", "why": "理由一句话" }, "degree": { "level": "1|2|3|4|5", "whatHurts": "具体痛在哪" }, "calm": { "ways": [ { "doing": "方法做法，含具体怎么做", "until": "什么信号该放" } ] } },
    "recon": { "passiveCracks": [ { "kind": "缝隙类型", "gap": "缝在哪，怎么形成", "enter": "怎么进入/第一步", "shut": "最容易被什么封住" } ], "activeScan": { "how": "主动扫描怎么做" } },
    "probe": { "actions": [ { "title": "试探标题", "how": "第一步怎么做（含时间盒）", "success": "做完看得见的标志", "danger": "停手线" } ] },
    "pivot": { "pending": [ "先观察的、现在的问题" ], "buckets": [ { "text": "一句描述", "bucket": "canLeave|canChange|cannotNow", "why": "归这里的原因" } ] },
    "closure": { "stopSigns": [ "该停手的信号 1", "信号 2" ], "weekly": "复盘节奏一句话" }
  }
}
严格用中文。只输出这一个 JSON 对象。`;

function forcedPerspectiveNote(label) {
  return `\n\n## FORCED PERSPECTIVE（用户已手动指定视角，必须严格遵守）\n用户要求**只从「${label}」这个角色的视角**给建议：所有痛点、分诊、行动都只对"作为${label}的用户"说，绝不给本事件里的其他角色出主意。当前 perspective 必须是这个角色（label 用「${label}」），且 isUser 标记在 perspectiveOptions 里对应到它。`;
}

function parsePerspective(r) {
  let options = arr(r.perspectiveOptions)
    .map((o, i) => {
      const ob = o ?? {};
      const label = str(ob.label);
      if (!label) return null;
      return { id: slug(str(ob.id) || label, `role-${i + 1}`), label, isUser: ob.isUser === true };
    })
    .filter(Boolean);
  const seen = new Set();
  options = options.filter((o) => (seen.has(o.id) ? false : (seen.add(o.id), true)));
  if (options.length === 0) options = [{ id: "self", label: "作为当事人的你", isUser: true }];
  if (!options.some((o) => o.isUser)) options[0].isUser = true;
  let firstUser = false;
  options = options.map((o) =>
    o.isUser && !firstUser ? ((firstUser = true), o) : { ...o, isUser: false },
  );
  const cur = r.perspective ?? {};
  const curLabel = str(cur.label);
  const curId = str(cur.id) ? slug(str(cur.id), "") : "";
  const matched =
    options.find((o) => curId && o.id === curId) ||
    options.find((o) => curLabel && o.label === curLabel) ||
    options.find((o) => o.isUser);
  const m = matched || options[0];
  return { perspective: { id: m.id, label: m.label, isUser: true }, perspectiveOptions: options };
}

/** 规整为安全 ActionPlan */
/** 原六步全字段规整（原版六步：含自检问句、三筐分诊、行动/缝隙/安慰剂全字段） */
function normalizeSteps(raw) {
  const r = (raw && typeof raw === 'object') ? raw : {};
  const pain = r.pain || {};
  const triage = r.triage || {};
  const sd = r.selfDeception || {};
  const ma = r.minimalAction || {};
  const crack = r.crack || {};
  const placebo = r.placebo || {};
  return {
    pain: { signal: str(pain.signal), whatHurts: str(pain.whatHurts) },
    triage: { items: Array.isArray(triage.items) ? triage.items.map((it) => ({ text: str(it.text), bucket: BUCKETS.includes(it.bucket) ? it.bucket : 'uncontrollable' })).filter((it) => it.text) : [] },
    selfDeception: { verdict: SD.includes(sd.verdict) ? sd.verdict : 'unclear', note: str(sd.note), checks: Array.isArray(sd.checks) ? sd.checks.map((c) => str(c)).filter(Boolean) : [] },
    minimalAction: { actions: Array.isArray(ma.actions) ? ma.actions.map((x) => ({ title: str(x.title), how: str(x.how) })).filter((x) => x.title || x.how) : [] },
    crack: { cracks: Array.isArray(crack.cracks) ? crack.cracks.map((c) => ({ kind: str(c.kind), detail: str(c.detail) })).filter((c) => c.detail) : [] },
    placebo: { regulations: Array.isArray(placebo.regulations) ? placebo.regulations.map((x) => str(x)).filter(Boolean) : [], closingPrinciple: str(placebo.closingPrinciple, '你不是你的结构，但结构是你不快乐的根源。') },
  };
}
function normalizeModules(rawMod, legacySteps) {
  const m = rawMod && typeof rawMod === "object" ? rawMod : {};
  const L = legacySteps && typeof legacySteps === "object" ? legacySteps : {};
  const Lp = (L.pain && typeof L.pain === "object") ? L.pain : {};
  const Lt = (L.triage && typeof L.triage === "object") ? L.triage : {};
  const Ls = (L.selfDeception && typeof L.selfDeception === "object") ? L.selfDeception : {};
  const Lma = (L.minimalAction && typeof L.minimalAction === "object") ? L.minimalAction : {};
  const Lc = (L.crack && typeof L.crack === "object") ? L.crack : {};
  const Lpl = (L.placebo && typeof L.placebo === "object") ? L.placebo : {};

  const a = m.anchor && typeof m.anchor === "object" ? m.anchor : {};
  const dis = a.disenchant && typeof a.disenchant === "object" ? a.disenchant : {};
  const av = a.agentVerdict && typeof a.agentVerdict === "object" ? a.agentVerdict : {};
  const deg = a.degree && typeof a.degree === "object" ? a.degree : {};
  const calm = a.calm && typeof a.calm === "object" ? a.calm : {};

  const verdictRaw = av.verdict || "";
  const verdict = SD.includes(verdictRaw) ? verdictRaw : (verdictRaw === "not_able" ? "truly_unable" : "unclear");

  // anchor
  const anchor = {
    disenchant: {
      comfortType: str(dis.comfortType) || "未识别",
      protected: str(dis.protective),
      price: str(dis.price) || "",
      signal: str(dis.signal) || str(dis.reminder) || str(Lp.signal),
    },
    agentVerdict: {
      verdict,
      note: str(av.note) || str(av.why) || str(Ls.note),
    },
    degree: {
      level: String(/^[1-5]$/.test(deg.level) ? deg.level : "3"),
      whatHurts: str(deg.whatHurts) || str(Lp.whatHurts),
    },
    calm: {
      ways: (Array.isArray(calm.ways) ? calm.ways : []).map((w) => ({ doing: str(w && (w.doing || w.way)), until: str(w && w.until) })).filter((w) => w.doing)
        .concat(arr(Lpl.regulations).map((r) => ({ doing: r, until: "" }))),
    },
  };

  // recon：裂缝（AI 可能叫 passiveCracks / passiveOpening）
  const r0 = m.recon && typeof m.recon === "object" ? m.recon : {};
  let c0 = Array.isArray(r0.passiveCracks) ? r0.passiveCracks : Array.isArray(r0.passiveOpening) ? r0.passiveOpening : [];
  if (!c0.length && Array.isArray(Lc.cracks)) {
    c0 = Lc.cracks.map((x) => ({ kind: str(x.kind), gap: "", enter: str(x.detail), shut: "", status: "unchecked" }));
  }
  const passiveCracks = c0.map((c) => ({
    kind: str(c.kind) || "未知缝",
    gap: str(c.gap) || str(c.inner) || str(c.derivedFrom) || str(c.loss),
    enter: str(c.enter) || str(c.crack) || str(c.detail) || str(c.how) || str(c.yourLoss),
    shut: str(c.shut) || str(c.defense),
    status: ["unchecked", "probing", "verified", "closed"].includes(c.status) ? c.status : "unchecked",
    cost: ["low", "mid", "high"].includes(c.cost) ? c.cost : "low",
    reversible: c.reversible !== false,
  })).filter((x) => x.enter);

  // probe
  const p0 = m.probe && typeof m.probe === "object" ? m.probe : {};
  let a0 = Array.isArray(p0.actions) ? p0.actions : Array.isArray(p0.steps) ? p0.steps : [];
  if (!a0.length && Array.isArray(Lma.actions)) {
    a0 = Lma.actions.map((x) => ({ title: str(x.title), how: str(x.how), success: "", danger: "" }));
  }
  const probes = a0.map((x) => ({
    title: str(x.title) || str(x.first),
    how: str(x.how) || str(x.step),
    success: str(x.success),
    danger: str(x.danger) || str(x.maxCost) || str(x.fail),
  })).filter((x) => x.title || x.how);

  // pivot
  const pv = m.pivot && typeof m.pivot === "object" ? m.pivot : {};
  const pending = (Array.isArray(pv.pending) ? pv.pending : []).map((x) => str(x)).filter(Boolean);
  let bs = Array.isArray(pv.buckets) ? pv.buckets : Array.isArray(pv.split) ? pv.split : [];
  if (!bs.length && Array.isArray(Lt.items)) {
    bs = Lt.items.map((x) => ({ text: str(x.text), bucket: { environment: "canLeave", behavior: "canChange", uncontrollable: "cannotNow" }[x.bucket] || "cannotNow", why: "" }));
  }
  const KEYS = ["canLeave", "canChange", "cannotNow"];
  const bucketsMap = { canLeave: [], canChange: [], cannotNow: [] };
  for (const b of bs) {
    const key = KEYS.includes(b && b.bucket) ? b.bucket : "cannotNow";
    const text = str(b && (b.text || b.part));
    if (!text) continue;
    bucketsMap[key].push({ text, why: str(b.why) });
  }

  // closure
  const cl = m.closure && typeof m.closure === "object" ? m.closure : {};
  const stopSigns = (Array.isArray(cl.stop) ? cl.stop : Array.isArray(cl.stopSigns) ? cl.stopSigns : []).map((x) => str(x)).filter(Boolean);

  return {
    anchor,
    recon: {
      passiveCracks,
      activeScan: { how: str((r0.activeScan && (r0.activeScan.how || r0.activeScan.keyword)) || "") },
    },
    probe: { actions: probes },
    pivot: { pending, buckets: bucketsMap },
    closure: { stopSigns, review: str(cl.weekly || cl.review, "每周做两件事：扫一条新缝 + 结一笔旧账。") },
  };
}

/** modules → legacy 六步（保持旧页面/分享/辩论兼容） */
function deriveLegacySteps(mod) {
  const A = (mod && mod.anchor) || {};
  const R = (mod && mod.recon) || {};
  const P = (mod && mod.probe) || {};
  const V = (mod && mod.pivot) || {};
  const CL = (mod && mod.closure) || {};
  const dis = A.disenchant || {};
  const av = A.agentVerdict || {};
  const deg = A.degree || {};
  const cal = A.calm || {};
  const B_MAP = { canLeave: "environment", canChange: "behavior", cannotNow: "uncontrollable" };
  const triageItems = [];
  for (const k of ["canLeave", "canChange", "cannotNow"]) {
    for (const it of (V.buckets && V.buckets[k]) || []) {
      triageItems.push({ text: it.text, bucket: B_MAP[k] });
    }
  }
  return {
    pain: { signal: dis.signal || "", whatHurts: deg.whatHurts || "" },
    triage: { items: triageItems },
    selfDeception: { verdict: av.verdict || "unclear", note: av.note || "", checks: [] },
    minimalAction: { actions: (P.actions || []).map((x) => ({ title: x.title, how: x.how })) },
    crack: { cracks: (R.passiveCracks || []).map((x) => ({ kind: x.kind, detail: x.enter })) },
    placebo: {
      regulations: (cal.ways || []).map((x) => x.doing).filter(Boolean),
      closingPrinciple: str(CL.review) || (A.disenchant && A.disenchant.price) || "",
    },
  };
}

function normalizeActionPlan(raw, id) {
  const r = raw ?? {};
  const rawSteps = (r.steps && typeof r.steps === 'object') ? r.steps : {};
  const modules = normalizeModules(r.modules, rawSteps);
  const steps = Object.keys(rawSteps).length ? normalizeSteps(rawSteps) : deriveLegacySteps(modules);
  const hasBoth = !!(r.modules && Object.keys(rawSteps).length);
  const { perspective, perspectiveOptions } = parsePerspective(r);
  return {
    id,
    perspective,
    perspectiveOptions,
    headline: str(r.headline, '看清后，先从一个可动的小处开始。'),
    modules,
    steps,
    debates: parseDebates(r.debates),
    actionFormat: hasBoth ? 'duel-v2' : 'duel-v1',
  };
}
function syncModulesFromSteps(baseModules, steps) {
  const base = baseModules && typeof baseModules === "object" ? baseModules : {};
  const s = steps && typeof steps === "object" ? steps : {};
  const sP = (s.pain && typeof s.pain === "object") ? s.pain : {};
  const sT = (s.triage && typeof s.triage === "object") ? s.triage : {};
  const sS = (s.selfDeception && typeof s.selfDeception === "object") ? s.selfDeception : {};
  const sM = (s.minimalAction && typeof s.minimalAction === "object") ? s.minimalAction : {};
  const sC = (s.crack && typeof s.crack === "object") ? s.crack : {};
  const sB = (s.placebo && typeof s.placebo === "object") ? s.placebo : {};

  const a0 = (base.anchor && typeof base.anchor === "object") ? base.anchor : {};
  const merged = {
    anchor: {
      disenchant: Object.assign({}, a0.disenchant, { signal: str(sP.signal) || (a0.disenchant && a0.disenchant.signal) || "" }),
      agentVerdict: Object.assign({}, a0.agentVerdict, {
        verdict: SD.includes(sS.verdict) ? sS.verdict : (a0.agentVerdict && a0.agentVerdict.verdict) || "unclear",
        note: str(sS.note) || (a0.agentVerdict && a0.agentVerdict.note) || "",
      }),
      degree: Object.assign({}, a0.degree, { whatHurts: str(sP.whatHurts) || (a0.degree && a0.degree.whatHurts) || "" }),
      calm: { ways: arr(sB.regulations).map((r) => ({ doing: r, until: "", source: "recompute" })).concat((a0.calm && a0.calm.ways || []).filter((w) => w.source !== "recompute")) },
    },
    recon: Object.assign({}, base.recon, {
      passiveCracks: (sC.cracks || []).map((c, i) => Object.assign({}, ((base.recon && base.recon.passiveCracks || [])[i] || {}), { kind: c.kind, gap: str(base.recon && base.recon.passiveCracks && base.recon.passiveCracks[i] && base.recon.passiveCracks[i].gap) || "", enter: c.detail })).filter((x) => x.enter),
    }),
    probe: Object.assign({}, base.probe, {
      actions: (sM.actions || []).map((x, i) => Object.assign({}, ((base.probe && base.probe.actions || [])[i] || {}), { title: x.title, how: x.how })),
    }),
    pivot: Object.assign({}, base.pivot, {
      pending: (base.pivot && base.pivot.pending) || [],
      buckets: { canLeave: [], canChange: [], cannotNow: [] },
    }),
    closure: base.closure || {},
  };
  const L2B = { environment: "canLeave", behavior: "canChange", uncontrollable: "cannotNow" };
  const nBuckets = {};
  for (const it of sT.items || []) {
    const k = L2B[it.bucket] || "cannotNow";
    if (!nBuckets[k]) nBuckets[k] = [];
    nBuckets[k].push({ text: it.text, why: "" });
  }
  merged.pivot.buckets = nBuckets;
  return merged;
}

function parseDebates(raw) {
  if (!raw || typeof raw !== "object") return undefined;
  const out = {};
  const now = new Date().toISOString();
  for (const key of ACTION_STEP_ORDER) {
    const turns = raw[key];
    if (!Array.isArray(turns)) continue;
    const list = turns
      .map((t) => ({
        objection: str(t.objection),
        stance: STANCES.includes(t.stance) ? t.stance : "hold",
        reason: str(t.reason),
        answer: str(t.answer) || undefined,
        at: str(t.at, now),
      }))
      .filter((t) => t.objection);
    if (list.length) out[key] = list;
  }
  return Object.keys(out).length ? out : undefined;
}

/** 单步「我不同意/追问」重算：应用到方案（双轨：steps 与 modules 同步更新） */
function normalizeActionRecompute(base, parsed, fromStepKey, objection) {
  const p = parsed ?? {};
  const stance = STANCES.includes(p.stance) ? p.stance : "hold";
  const answer = str(p.answer) || str(p.reason) || "已针对你这一点重想（见下方更新）。";
  const reason = str(p.reason, answer);
  const changeNote = str(p.changeNote);
  const turn = { objection, stance, reason, answer, at: new Date().toISOString() };
  let nextSteps = base.steps;
  if (stance !== "hold") {
    const fromIdx = ACTION_STEP_ORDER.indexOf(fromStepKey);
    const affected = ACTION_STEP_ORDER.slice(fromIdx);
    const normSteps = normalizeSteps(p.steps || {});
    const merged = Object.assign({}, base.steps);
    for (const key of affected) {
      const provided = p.steps && typeof p.steps === "object" ? p.steps[key] : undefined;
      if (provided && typeof provided === "object") merged[key] = normSteps[key] || merged[key];
    }
    nextSteps = merged;
  }
  const debates = Object.assign({}, base.debates || {});
  debates[fromStepKey] = (debates[fromStepKey] || []).concat([turn]);
  // 新五模块轨同步：优先采用模型回传的 modules，否则从新的 steps 派生，保证两套自洽
  let nextModules;
  const mods = p.modules && typeof p.modules === "object" && Object.keys(p.modules).length ? p.modules : null;
  if (mods) nextModules = normalizeModules(Object.assign({}, base.modules || {}, mods), nextSteps);
  else if (base.modules) nextModules = syncModulesFromSteps(base.modules, nextSteps);
  else nextModules = normalizeModules({}, nextSteps);
  return {
    plan: Object.assign({}, base, {
      steps: nextSteps,
      modules: nextModules,
      debates,
      actionFormat: base.actionFormat || (base.modules && base.steps ? "duel-v2" : "duel-v1"),
    }),
    stance,
    changeNote,
  };
}

/** 行动页单步重算的 system prompt（锁定视角 + 只重算下游，双轨都要求重写） */
function actionRecomputeSystemPrompt(fromStepKey, perspective) {
  const label = STEP_LABEL_ZH[fromStepKey];
  const downstream = ACTION_STEP_ORDER.slice(ACTION_STEP_ORDER.indexOf(fromStepKey) + 1);
  const downstreamLabels = downstream.map((k) => STEP_LABEL_ZH[k]).join("、") || "无下游步";
  const keys = ACTION_STEP_ORDER.slice(ACTION_STEP_ORDER.indexOf(fromStepKey)).map((k) => '"' + k + '": { ... }').join(", ");
  const baseLines = [
    "你是「清醒行动主义」行动引擎的共同推演模块。用户对已生成行动方案的某一步提出了「反驳/追问」。当前视角：" + perspective.label + "（id=" + perspective.id + "），一切回应都必须继续站在这个视角。",
    "任务（顺序不能乱）：",
    "1）【最重要】先写 answer：给用户一个有实质内容的直接回复，而不是只表态。追问型就正面回答那个为什么、给更深的机制或更具体的做法；反驳型就给出完整推理——采纳要讲清哪点成立、为何改；维持要讲清为何不成立、原建议为何站得住。禁止说「你说得有道理但…」「我会考虑」这类空话。",
    "2）再写 stance：absorb（采纳）/ compromise（部分采纳）/ hold（维持）。判定标准只有一个：用户的反驳或追问有没有客观依据，追问通常应被判 absorb 或部分采纳；只有基于误解才 hold。",
    "3）若 stance 是 absorb 或 compromise（不可偷懒）：",
    "   - 重写「" + label + "」这一节，把新东西落进去；",
    "   - 重新审视每个下游步（" + downstreamLabels + "）：只要受影响就必须一并重写（如痛点变了→分诊、行动、缝隙都要变）。",
    "   - 同时把对应的【五模块方案】也同步更新，保持两套自洽：步骤输出到 steps（旧六步完整结构，含自检问句等原字段），模块输出到 modules（新方案五模块结构）。",
    "   - 若 hold：steps 与 modules 都留空对象 {}（但 answer 仍要把道理讲透）。",
    "输出格式：只输出一个 JSON，不要 markdown：{\"answer\":\"...\",\"stance\":\"absorb|compromise|hold\",\"reason\":\"简短归档\",\"changeNote\":\"一句话说改了什么\",\"steps\":{ " + keys + " },\"modules\":{ ... }}。所有 content 用中文。",
  ];
  return baseLines.join("\n");
}

// 找出要求联动但实际未变的下游步骤（供二次补算）
function downstreamStaleKeys(baseSteps, nextSteps, fromStepKey) {
  const idx = ACTION_STEP_ORDER.indexOf(fromStepKey);
  if (idx < 0) return [];
  const stale = [];
  for (let i = idx + 1; i < ACTION_STEP_ORDER.length; i++) {
    const key = ACTION_STEP_ORDER[i];
    const before = baseSteps && baseSteps[key];
    const after = nextSteps && nextSteps[key];
    if (!before || !after || JSON.stringify(before) === JSON.stringify(after)) stale.push(key);
  }
  return stale;
}

/** 下游补算提示词：要求 AI 重写未同步的下游章节，与已更新部分自洽 */
function downstreamCascadePrompt(staleKeys, perspective) {
  const labels = staleKeys.map((k) => STEP_LABEL_ZH[k] || k).join("、");
  const keysLine = staleKeys.map((k) => '"' + k + '"').join(", ");
  return (
    "你是「清醒行动主义」行动引擎的一致性修正模块。用户对方案的某一步提出了反馈并已被采纳，但以下下游章节没有跟着变，你必须重新计算它们：" + labels + ".\n" +
    "当前视角：" + perspective.label + "（id=" + perspective.id + "）。\n" +
    "要求：以上游新更新的内容为基准逐节重演；若受影响就必须写出与之一致的新内容，禁止整段照抄旧文；内容用中文，字段结构与原来一致。\n" +
    "输出格式：只输出一个 JSON（不要 markdown）：{ \"steps\": { " + keysLine + " } }。"
  );
}

/** 把某次补算的 steps 草稿覆盖合并进现有方案（不新增辩论轮次），并同步 modules */
function mergeStepDraft(base, draftParsed) {
  const draftSteps =
    draftParsed && typeof draftParsed === "object" && draftParsed.steps && typeof draftParsed.steps === "object"
      ? draftParsed.steps
      : null;
  if (!draftSteps) return null;
  const nextSteps = Object.assign({}, base.steps || {});
  const norm = normalizeSteps(draftSteps);
  let changed = false;
  for (const key of Object.keys(norm)) {
    if (norm[key] && typeof norm[key] === "object" && Object.keys(norm[key]).length) {
      if (JSON.stringify(norm[key]) !== JSON.stringify(nextSteps[key])) changed = true;
      nextSteps[key] = norm[key];
    }
  }
  if (!changed) return null;
  const nextModules =
    base.modules && typeof base.modules === "object"
      ? syncModulesFromSteps(base.modules, nextSteps)
      : normalizeModules({}, nextSteps);
  return { steps: nextSteps, modules: nextModules };
}

module.exports = {
  ACTION_STEP_ORDER,
  downstreamStaleKeys,
  downstreamCascadePrompt,
  mergeStepDraft,
  STEP_LABEL_ZH,
  PERSPECTIVE_SYSTEM_PROMPT,
  STEPS_SYSTEM_PROMPT,
  MODULES_SYSTEM_PROMPT,
  forcedPerspectiveNote,
  parsePerspective,
  normalizeActionPlan,
  normalizeActionRecompute,
  actionRecomputeSystemPrompt,
};
