import type {
  AdversarialCheck,
  AnalysisResult,
  AnomalyCandidate,
  CoreJudgment,
  DebateStance,
  DebateTurn,
  GameAndAnalogy,
  MaterialItem,
  MechanismPenetration,
  NeutralSkeleton,
  PipelineStep,
  RevisionEntry,
  RootStructure,
  ScenarioBranch,
  SearchSource,
  SourceGrade,
  StepKind,
  StepOverlay,
  StructureSkeleton,
  WalkHook,
} from "@/lib/analysis/types";
import { STEP_ORDER } from "@/lib/analysis/types";

const ROOTS: RootStructure[] = ["extraction", "delegation", "power"];
const STANCES: DebateStance[] = ["absorb", "compromise", "hold"];

function normalizeStance(v: unknown): DebateStance {
  return STANCES.includes(v as DebateStance) ? (v as DebateStance) : "hold";
}
const GRADES: SourceGrade[] = ["strong", "medium", "weak", "unverifiable"];

function clampConf(v: unknown, fallback = 60): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function clampLeverage(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 3;
  return Math.max(1, Math.min(5, Math.round(n)));
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

function strArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => str(x)).filter(Boolean);
}

function obj(v: unknown): Record<string, unknown> {
  return (v ?? {}) as Record<string, unknown>;
}

function grade(v: unknown): SourceGrade {
  return GRADES.includes(v as SourceGrade) ? (v as SourceGrade) : "unverifiable";
}

/** 把 AI 返回的单个步骤规整为严格的 PipelineStep；结构缺失则兜底 */
function normalizeStep(kind: StepKind, raw: unknown): PipelineStep | null {
  const o = obj(raw);
  const title = str(o.title, kind);
  switch (kind) {
    case "materials": {
      const materials: MaterialItem[] = Array.isArray(o.materials)
        ? o.materials
            .map((m) => {
              const mm = obj(m);
              const fact = str(mm.fact);
              if (!fact) return null;
              const url = str(mm.url);
              return { fact, grade: grade(mm.grade), ...(url ? { url } : {}) };
            })
            .filter((x): x is MaterialItem => Boolean(x))
        : [];
      return { kind, title, materials, note: str(o.note) };
    }
    case "anomaly": {
      const candidates: AnomalyCandidate[] = Array.isArray(o.candidates)
        ? o.candidates
            .map((c, i) => {
              const cc = obj(c);
              const content = str(cc.content);
              if (!content) return null;
              return {
                id: str(cc.id, String.fromCharCode(65 + i)),
                content,
                leverage: clampLeverage(cc.leverage),
              };
            })
            .filter((x): x is AnomalyCandidate => Boolean(x))
        : [];
      const selectedId =
        str(o.selectedId) && candidates.some((c) => c.id === str(o.selectedId))
          ? str(o.selectedId)
          : (candidates[0]?.id ?? "A");
      return {
        kind,
        title,
        baseline: str(o.baseline),
        candidates,
        selectedId,
        reason: str(o.reason),
      };
    }
    case "skeleton": {
      const s = obj(o.skeleton);
      const skeleton: NeutralSkeleton = {
        subject: str(s.subject, "—"),
        object: str(s.object, "—"),
        mechanism: str(s.mechanism, "—"),
        harmed: str(s.harmed, "—"),
        benefited: str(s.benefited, "—"),
        naming: str(s.naming, "—"),
      };
      return { kind, title, skeleton };
    }
    case "mechanism": {
      const m = obj(o.mechanism);
      const mechanism: MechanismPenetration = {
        surface: str(m.surface, "—"),
        deep: str(m.deep, "—"),
        bottom: str(m.bottom, "—"),
        interestFlow: strArray(m.interestFlow),
        renaming: str(m.renaming, "—"),
      };
      return { kind, title, mechanism };
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
            .filter((x): x is { title: string; isomorphism: string } => Boolean(x))
        : [];
      const game: GameAndAnalogy = {
        gameSummary: str(g.gameSummary, "—"),
        analogs,
        variableParameter: str(g.variableParameter, "—"),
      };
      return { kind, title, game };
    }
    case "scenario": {
      const branches: ScenarioBranch[] = Array.isArray(o.branches)
        ? o.branches
            .map((b) => {
              const bb = obj(b);
              const label = str(bb.label);
              const narrative = str(bb.narrative);
              if (!label && !narrative) return null;
              return {
                label: label || "分支",
                narrative,
                probability: clampConf(bb.probability, 0),
                warningSignals: str(bb.warningSignals),
              };
            })
            .filter((x): x is ScenarioBranch => Boolean(x))
        : [];
      return { kind, title, variables: strArray(o.variables), branches };
    }
    case "judgment": {
      const judgments: CoreJudgment[] = Array.isArray(o.judgments)
        ? o.judgments
            .map((j) => {
              const jj = obj(j);
              const claim = str(jj.claim);
              if (!claim) return null;
              return {
                claim,
                confidence: clampConf(jj.confidence),
                falsifiable: str(jj.falsifiable, "（本次未给出可证伪条件）"),
              };
            })
            .filter((x): x is CoreJudgment => Boolean(x))
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
            .filter((x): x is { challenge: string; response: string } => Boolean(x))
        : [];
      const metacognition = Array.isArray(c.metacognition)
        ? c.metacognition
            .map((m) => {
              const mm = obj(m);
              const bias = str(mm.bias);
              if (!bias) return null;
              return { bias, check: str(mm.check) };
            })
            .filter((x): x is { bias: string; check: string } => Boolean(x))
        : [];
      const check: AdversarialCheck = { devilsAdvocate, metacognition };
      return { kind, title, check };
    }
    default:
      return null;
  }
}

function pickRawStep(rawSteps: unknown[], kind: StepKind): unknown {
  return rawSteps.find((s) => obj(s).kind === kind);
}

function normalizeSkeletonCard(
  sk: Record<string, unknown>,
  fallbackName: string,
): StructureSkeleton {
  const root = ROOTS.includes(sk.root as RootStructure)
    ? (sk.root as RootStructure)
    : "extraction";
  const alt = str(sk.altStructure);

  // 动态零件：优先用 AI 返回的 parts；否则从旧固定字段回退映射，保证老数据仍可读
  let parts: { label: string; value: string }[] = [];
  if (Array.isArray(sk.parts)) {
    parts = sk.parts
      .map((p) => {
        const pp = obj(p);
        const label = str(pp.label);
        const value = str(pp.value);
        if (!label && !value) return null;
        return { label: label || "零件", value };
      })
      .filter((x): x is { label: string; value: string } => Boolean(x))
      .slice(0, 6);
  }
  if (parts.length === 0) {
    // 兼容旧结构：把曾经写死的字段映射为零件
    const legacy: Array<[string, unknown]> = [
      ["主体", sk.subject],
      ["对象", sk.object],
      ["机制", sk.mechanism],
      ["被提取", sk.extracted],
    ];
    parts = legacy
      .map(([label, v]) => ({ label, value: str(v) }))
      .filter((p) => p.value);
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
export function normalizeAnalysis(
  raw: unknown,
  id: string,
  input: string,
  extra?: { sources?: SearchSource[] },
): AnalysisResult {
  const o = obj(raw);
  const rawSteps = Array.isArray(o.steps) ? o.steps : [];

  const steps: PipelineStep[] = STEP_ORDER.map((kind) =>
    normalizeStep(kind, pickRawStep(rawSteps, kind)),
  ).filter((s): s is PipelineStep => Boolean(s));

  const skeleton = normalizeSkeletonCard(
    obj(o.skeleton),
    str(o.verdict, "未命名结构"),
  );

  const rawHooks = Array.isArray(o.walkHooks) ? o.walkHooks : [];
  const walkHooks: WalkHook[] = rawHooks
    .slice(0, 3)
    .map((item, i) => {
      const h = obj(item);
      return {
        id: str(h.id, `hook-${i + 1}`),
        title: str(h.title),
        reason: str(h.reason),
      };
    })
    .filter((h) => h.title);

  return {
    id,
    input,
    version: "1.0",
    verdict: str(o.verdict, skeleton.name),
    steps,
    skeleton,
    walkHooks,
    sources: extra?.sources,
    revisions: [],
    createdAt: new Date().toISOString(),
  };
}

/**
 * 应用一次「我不同意」的结果（人机共同推演）：
 * - AI 先给 stance(吸收/折中/保持) + reason，追加为该节的一轮辩论留痕。
 * - absorb/compromise：修订被反对的这一节（revisedStep），下游受影响步骤以"增量覆盖层"追加
 *   （不覆盖原内容，标注原内容为何不再适用 + 新增内容）。
 * - hold：不动任何内容，只留辩论记录。
 * fromStepKind 可为某个 StepKind，或 "skeleton-card"（表示反驳的是结构骨架卡本身）。
 */
export function applyRecompute(
  base: AnalysisResult,
  raw: unknown,
  fromStepKind: StepKind | "skeleton-card",
  disagreement: string,
): AnalysisResult {
  const o = obj(raw);
  const stance = normalizeStance(o.stance);
  const reason = str(o.reason, "（未给出理由）");
  const at = new Date().toISOString();

  const parts = base.version.split(".");
  const minor = (parseInt(parts[1] ?? "0", 10) || 0) + 1;
  const version = `${parts[0] ?? "1"}.${minor}`;

  const turn: DebateTurn = { objection: disagreement, stance, reason, at };
  const willEdit = stance !== "hold";

  // 下游增量覆盖层（仅 absorb/compromise）
  const rawRevised =
    willEdit && Array.isArray(o.revisedSteps) ? o.revisedSteps : [];
  const overlayByKind = new Map<StepKind, StepOverlay>();
  const downstreamStart =
    fromStepKind === "skeleton-card" ? 0 : STEP_ORDER.indexOf(fromStepKind);
  for (const item of rawRevised) {
    const it = obj(item);
    const kind = it.kind as StepKind;
    if (!STEP_ORDER.includes(kind)) continue;
    // 只接受下游步骤（骨架卡反驳时允许影响所有步骤）
    if (fromStepKind !== "skeleton-card" && STEP_ORDER.indexOf(kind) <= downstreamStart)
      continue;
    const addendum = strArray(it.addendum);
    const obsoleteReason = str(it.obsoleteReason);
    if (addendum.length === 0 && !obsoleteReason) continue;
    overlayByKind.set(kind, { version, obsoleteReason, addendum, at });
  }

  // 被反对这一节的修订
  let steps = base.steps;
  let skeleton = base.skeleton;

  if (fromStepKind === "skeleton-card") {
    // 骨架卡被反对：附辩论；absorb/compromise 时用 revisedStep(skeleton) 更新
    const revised = willEdit ? obj(obj(o.revisedStep).skeleton ?? o.revisedStep) : null;
    skeleton = {
      ...(revised && (revised.name || revised.actualStructure)
        ? normalizeSkeletonCard(revised, base.skeleton.name)
        : base.skeleton),
      debate: [...(base.skeleton.debate ?? []), turn],
    };
  } else {
    const revisedRaw = willEdit ? o.revisedStep : null;
    const revisedStep =
      revisedRaw && obj(revisedRaw).kind === fromStepKind
        ? normalizeStep(fromStepKind, revisedRaw)
        : null;
    steps = base.steps.map((s) => {
      if (s.kind === fromStepKind) {
        const merged = revisedStep ? { ...revisedStep } : { ...s };
        return {
          ...merged,
          debate: [...(s.debate ?? []), turn],
          overlays: s.overlays,
        } as PipelineStep;
      }
      return s;
    });
  }

  // 把下游覆盖层叠加到对应步骤（不覆盖原内容）
  if (overlayByKind.size > 0) {
    steps = steps.map((s) => {
      const ov = overlayByKind.get(s.kind);
      if (!ov) return s;
      return { ...s, overlays: [...(s.overlays ?? []), ov] } as PipelineStep;
    });
  }

  const revision: RevisionEntry = {
    version: willEdit ? version : base.version,
    stepKind: fromStepKind,
    disagreement,
    stance,
    reason,
    at,
  };

  return {
    ...base,
    version: willEdit ? version : base.version,
    verdict: willEdit ? str(o.verdict, base.verdict) : base.verdict,
    steps,
    skeleton,
    revisions: [...(base.revisions ?? []), revision],
  };
}
