// 分析结果规范化（从 validate.ts 移植，CommonJS）
// 把 AI 返回的杂乱对象规整为严格结构；各种字段兜底，保证前端渲染不崩。

const ROOTS = ["extraction", "delegation", "power"];
const STANCES = ["absorb", "compromise", "hold"];
const GRADES = ["strong", "medium", "weak", "unverifiable"];
const BEDROCKS = ["human_nature", "incentive", "power", "information", "scarcity"];
const STEP_ORDER = [
  "materials",
  "anomaly",
  "skeleton",
  "mechanism",
  "game",
  "scenario",
  "judgment",
  "adversarial",
];

function str(v, fallback = "") {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}
function strArray(v) {
  if (!Array.isArray(v)) return [];
  return v.map((x) => str(x)).filter(Boolean);
}
function obj(v) {
  return (v ?? {}) || {};
}
function clampConf(v, fallback = 60) {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}
function clampLeverage(v) {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 3;
  return Math.max(1, Math.min(5, Math.round(n)));
}
function grade(v) {
  return GRADES.includes(v) ? v : "unverifiable";
}

/** 把 AI 返回的单个步骤规整为严格的 PipelineStep */
function normalizeStep(kind, raw) {
  const o = obj(raw);
  const title = str(o.title, kind);
  switch (kind) {
    case "materials": {
      const materials = Array.isArray(o.materials)
        ? o.materials
            .map((m) => {
              const mm = obj(m);
              const fact = str(mm.fact);
              if (!fact) return null;
              const url = str(mm.url);
              return { fact, grade: grade(mm.grade), ...(url ? { url } : {}) };
            })
            .filter(Boolean)
        : [];
      return { kind, title, materials, note: str(o.note) };
    }
    case "anomaly": {
      const candidates = Array.isArray(o.candidates)
        ? o.candidates
            .map((c, i) => {
              const cc = obj(c);
              const content = str(cc.content);
              if (!content) return null;
              return { id: str(cc.id, "ABCDEFGHI"[i] ?? String.fromCharCode(65 + i)), content, leverage: clampLeverage(cc.leverage) };
            })
            .filter(Boolean)
        : [];
      const selectedId =
        str(o.selectedId) && candidates.some((c) => c.id === str(o.selectedId))
          ? str(o.selectedId)
          : (candidates[0]?.id ?? "A");
      return { kind, title, baseline: str(o.baseline), candidates, selectedId, reason: str(o.reason) };
    }
    case "skeleton": {
      const s = obj(o.skeleton);
      return {
        kind,
        title,
        skeleton: {
          subject: str(s.subject, "—"),
          object: str(s.object, "—"),
          mechanism: str(s.mechanism, "—"),
          harmed: str(s.harmed, "—"),
          benefited: str(s.benefited, "—"),
          naming: str(s.naming, "—"),
        },
      };
    }
    case "mechanism": {
      const m = obj(o.mechanism);
      let layers = Array.isArray(m.layers)
        ? m.layers
            .map((it) => {
              const l = obj(it);
              return { ask: str(l.ask), finding: str(l.finding), breakthrough: str(l.breakthrough) };
            })
            .filter((l) => l.finding || l.ask || l.breakthrough)
        : [];
      if (layers.length === 0 && (m.surface || m.deep || m.bottom)) {
        layers = [
          { ask: "表面看到什么", finding: str(m.surface, "—"), breakthrough: "" },
          { ask: "再往深追问", finding: str(m.deep, "—"), breakthrough: "" },
          { ask: "钻到底层", finding: str(m.bottom, "—"), breakthrough: "" },
        ].filter((l) => l.finding !== "—");
      }
      if (layers.length === 0) layers = [{ ask: "—", finding: "—", breakthrough: "" }];
      const bedrockKind = BEDROCKS.includes(m.bedrockKind) ? m.bedrockKind : "incentive";
      const sideAnomalies = Array.isArray(m.sideAnomalies)
        ? m.sideAnomalies
            .map((it) => {
              const s = obj(it);
              return { anomaly: str(s.anomaly), whyDig: str(s.whyDig) };
            })
            .filter((s) => s.anomaly)
        : [];
      return {
        kind,
        title,
        mechanism: {
          anchorAnomaly: str(m.anchorAnomaly, ""),
          layers,
          sideAnomalies,
          bedrockKind,
          bedrock: str(m.bedrock, str(m.bottom, "—")),
          interestFlow: strArray(m.interestFlow),
          renaming: str(m.renaming, "—"),
        },
      };
    }
    case "game": {
      const g = obj(o.game);
      const analogs = Array.isArray(g.analogs)
        ? g.analogs
            .map((a) => {
              const aa = obj(a);
              const t = str(aa.title);
              if (!t) return null;
              return { title: t, isomorphism: str(aa.isomorphism) };
            })
            .filter(Boolean)
        : [];
      return { kind, title, game: { gameSummary: str(g.gameSummary, "—"), analogs, variableParameter: str(g.variableParameter, "—") } };
    }
    case "scenario": {
      const branches = Array.isArray(o.branches)
        ? o.branches
            .map((b) => {
              const bb = obj(b);
              const label = str(bb.label);
              const narrative = str(bb.narrative);
              if (!label && !narrative) return null;
              return { label: label || "分支", narrative, probability: clampConf(bb.probability, 0), warningSignals: str(bb.warningSignals) };
            })
            .filter(Boolean)
        : [];
      return { kind, title, variables: strArray(o.variables), branches };
    }
    case "judgment": {
      const judgments = Array.isArray(o.judgments)
        ? o.judgments
            .map((j) => {
              const jj = obj(j);
              const claim = str(jj.claim);
              if (!claim) return null;
              return { claim, confidence: clampConf(jj.confidence), falsifiable: str(jj.falsifiable, "（本次未给出可证伪条件）") };
            })
            .filter(Boolean)
        : [];
      return { kind, title, judgments };
    }
    case "adversarial": {
      const c = obj(o.check);
      const devilsAdvocate = Array.isArray(c.devilsAdvocate)
        ? c.devilsAdvocate
            .map((d) => {
              const dd = obj(d);
              const challenge = str(dd.challenge);
              if (!challenge) return null;
              return { challenge, response: str(dd.response) };
            })
            .filter(Boolean)
        : [];
      const metacognition = Array.isArray(c.metacognition)
        ? c.metacognition
            .map((m) => {
              const mm = obj(m);
              const bias = str(mm.bias);
              if (!bias) return null;
              return { bias, check: str(mm.check) };
            })
            .filter(Boolean)
        : [];
      return { kind, title, check: { devilsAdvocate, metacognition } };
    }
    default:
      return null;
  }
}

function pickRawStep(rawSteps, kind) {
  return rawSteps.find((s) => obj(s).kind === kind);
}

function normalizeSkeletonCard(sk, fallbackName) {
  const root = ROOTS.includes(sk.root) ? sk.root : "extraction";
  const alt = str(sk.altStructure);
  let parts = [];
  if (Array.isArray(sk.parts)) {
    parts = sk.parts
      .map((p) => {
        const pp = obj(p);
        const label = str(pp.label);
        const value = str(pp.value);
        if (!label && !value) return null;
        return { label: label || "零件", value };
      })
      .filter(Boolean)
      .slice(0, 6);
  }
  if (parts.length === 0) {
    const legacy = [
      ["主体", sk.subject],
      ["对象", sk.object],
      ["机制", sk.mechanism],
      ["被提取", sk.extracted],
    ];
    parts = legacy.map(([label, v]) => ({ label, value: str(v) })).filter((p) => p.value);
    const flow = strArray(sk.interestFlow);
    if (flow.length > 0) parts.push({ label: "利益流向", value: flow.join("；") });
  }
  return {
    name: str(sk.name, fallbackName),
    perceivedAs: str(sk.perceivedAs, "—"),
    actualStructure: str(sk.actualStructure, str(sk.name, "—")),
    whySo: str(sk.whySo, "—"),
    parts,
    root,
    ...(alt ? { altStructure: alt } : {}),
    confidence: clampConf(sk.confidence),
  };
}

/** 把 AI 返回的完整对象规整成严格的 AnalysisResult */
function normalizeAnalysis(raw, id, input, extra) {
  const o = obj(raw);
  const rawSteps = Array.isArray(o.steps) ? o.steps : [];
  const steps = STEP_ORDER.map((kind) => normalizeStep(kind, pickRawStep(rawSteps, kind))).filter(Boolean);
  const skeleton = normalizeSkeletonCard(obj(o.skeleton), str(o.verdict, "未命名结构"));
  const rawHooks = Array.isArray(o.walkHooks) ? o.walkHooks : [];
  const walkHooks = rawHooks.slice(0, 3).map((item, i) => {
    const h = obj(item);
    return { id: str(h.id, `hook-${i + 1}`), title: str(h.title), reason: str(h.reason) };
  }).filter((h) => h.title);
  return {
    id,
    input,
    version: "1.0",
    verdict: str(o.verdict, skeleton.name),
    steps,
    skeleton,
    walkHooks,
    sources: extra?.sources ?? null,
    revisions: [],
    createdAt: new Date().toISOString(),
  };
}

/** 应用一次「我不同意」结果（人机共同推演） */
function applyRecompute(base, raw, fromStepKind, disagreement) {
  const o = obj(raw);
  const stance = STANCES.includes(o.stance) ? o.stance : "hold";
  const reason = str(o.reason, "（未给出理由）");
  const answer = str(o.answer, "");
  const at = new Date().toISOString();
  const parts = base.version.split(".");
  const minor = (parseInt(parts[1] ?? "0", 10) || 0) + 1;
  const version = `${parts[0] ?? "1"}.${minor}`;
  const turn = { objection: disagreement, stance, reason, ...(answer ? { answer } : {}), at };
  const willEdit = stance !== "hold";

  const rawRevised = willEdit && Array.isArray(o.revisedSteps) ? o.revisedSteps : [];
  const overlayByKind = new Map();
  const downstreamStart = fromStepKind === "skeleton-card" ? 0 : STEP_ORDER.indexOf(fromStepKind);
  for (const item of rawRevised) {
    const it = obj(item);
    const kind = it.kind;
    if (!STEP_ORDER.includes(kind)) continue;
    if (fromStepKind !== "skeleton-card" && STEP_ORDER.indexOf(kind) <= downstreamStart) continue;
    const addendum = strArray(it.addendum);
    const obsoleteReason = str(it.obsoleteReason);
    if (addendum.length === 0 && !obsoleteReason) continue;
    overlayByKind.set(kind, { version, obsoleteReason, addendum, at });
  }

  let steps = base.steps;
  let skeleton = base.skeleton;
  const rootChangeFromRoots = (so) => {
    const rc = obj(so.rootChange);
    const from = ROOTS.includes(rc.from) ? rc.from : undefined;
    const to = ROOTS.includes(rc.to) ? rc.to : undefined;
    return from && to && from !== to ? { rootChange: { from, to } } : {};
  };

  if (fromStepKind === "skeleton-card") {
    let skeletonOverlay;
    if (willEdit) {
      const so = obj(o.skeletonOverlay);
      const addendum = strArray(so.addendum);
      const obsoleteReason = str(so.obsoleteReason);
      if (addendum.length > 0 || obsoleteReason) {
        skeletonOverlay = { version, obsoleteReason, addendum, ...rootChangeFromRoots(so), at };
      }
    }
    skeleton = {
      ...base.skeleton,
      debate: [...(base.skeleton.debate ?? []), turn],
      overlays: skeletonOverlay ? [...(base.skeleton.overlays ?? []), skeletonOverlay] : base.skeleton.overlays,
    };
  } else {
    const revisedRaw = willEdit ? o.revisedStep : null;
    const revisedStep = revisedRaw && obj(revisedRaw).kind === fromStepKind ? normalizeStep(fromStepKind, revisedRaw) : null;
    steps = base.steps.map((s) => {
      if (s.kind === fromStepKind) {
        const merged = revisedStep ? { ...revisedStep } : { ...s };
        return { ...merged, debate: [...(s.debate ?? []), turn], overlays: s.overlays };
      }
      return s;
    });
    if (willEdit && o.skeletonImpact) {
      const si = obj(o.skeletonImpact);
      const addendum = strArray(si.addendum);
      const obsoleteReason = str(si.obsoleteReason);
      if (addendum.length > 0 || obsoleteReason) {
        const impactOverlay = { version, obsoleteReason, addendum, ...rootChangeFromRoots(si), triggeredBy: fromStepKind, at };
        skeleton = { ...skeleton, overlays: [...(skeleton.overlays ?? []), impactOverlay] };
      }
    }
  }

  if (overlayByKind.size > 0) {
    steps = steps.map((s) => {
      const ov = overlayByKind.get(s.kind);
      if (!ov) return s;
      return { ...s, overlays: [...(s.overlays ?? []), ov] };
    });
  }

  const revision = { version: willEdit ? version : base.version, stepKind: fromStepKind, disagreement, stance, reason, at };
  return {
    ...base,
    version: willEdit ? version : base.version,
    verdict: willEdit ? str(o.verdict, base.verdict) : base.verdict,
    steps,
    skeleton,
    revisions: [...(base.revisions ?? []), revision],
  };
}

/** 判断某一步的核心内容是否为空（模型常见漏输出导致空节） */
function stepIsEmpty(step) {
  const o = obj(step || {});
  switch (o.kind) {
    case "materials":
      return !str(o.note) && !(Array.isArray(o.materials) && o.materials.length);
    case "anomaly":
      return !str(o.baseline) && !(Array.isArray(o.candidates) && o.candidates.length);
    case "skeleton":
      return !(o.skeleton && (str(o.skeleton.naming) || str(o.skeleton.mechanism) || str(o.skeleton.subject)));
    case "mechanism": {
      const m = obj(o.mechanism);
      return !str(m.bedrock) && !(Array.isArray(m.layers) && m.layers.length);
    }
    case "game": {
      const g = obj(o.game);
      return !str(g.gameSummary) && !(Array.isArray(g.analogs) && g.analogs.length);
    }
    case "scenario":
      return !(Array.isArray(o.variables) && o.variables.length) && !(Array.isArray(o.branches) && o.branches.length);
    case "judgment":
      return !(Array.isArray(o.judgments) && o.judgments.length);
    case "adversarial": {
      const c = obj(o.check);
      return !(Array.isArray(c.devilsAdvocate) && c.devilsAdvocate.length) && !(Array.isArray(c.metacognition) && c.metacognition.length);
    }
    default:
      return !JSON.stringify(o) || JSON.stringify(o).length < 16;
  }
}

/** 返回所有“内容为空”的步骤 kind 列表（用于触发一次修复重生成） */
function emptyStepKinds(steps) {
  return (Array.isArray(steps) ? steps : []).filter(stepIsEmpty).map((s) => s && s.kind).filter(Boolean);
}

module.exports = { normalizeAnalysis, applyRecompute, STEP_ORDER, stepIsEmpty, emptyStepKinds };