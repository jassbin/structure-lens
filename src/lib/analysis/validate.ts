import type {
  AdversarialCheck,
  AnalysisResult,
  AnomalyCandidate,
  CoreJudgment,
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
  StructureSkeleton,
  WalkHook,
} from "@/lib/analysis/types";
import { STEP_ORDER } from "@/lib/analysis/types";

const ROOTS: RootStructure[] = ["extraction", "delegation", "power"];
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
  return {
    name: str(sk.name, fallbackName),
    perceivedAs: str(sk.perceivedAs, "—"),
    actualStructure: str(sk.actualStructure, str(sk.name, "—")),
    whySo: str(sk.whySo, "—"),
    subject: str(sk.subject, "—"),
    object: str(sk.object, "—"),
    mechanism: str(sk.mechanism, "—"),
    extracted: str(sk.extracted, "—"),
    interestFlow: strArray(sk.interestFlow),
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
 * 把重算返回的部分步骤合并进已有结果，产出新版本。
 * revisedSteps 只含被重算的步骤，按 kind 覆盖原步骤。
 */
export function applyRecompute(
  base: AnalysisResult,
  raw: unknown,
  fromStepKind: StepKind,
  disagreement: string,
): AnalysisResult {
  const o = obj(raw);
  const rawRevised = Array.isArray(o.revisedSteps) ? o.revisedSteps : [];
  const fromIdx = STEP_ORDER.indexOf(fromStepKind);

  const revisedByKind = new Map<StepKind, PipelineStep>();
  for (const kind of STEP_ORDER) {
    if (STEP_ORDER.indexOf(kind) < fromIdx) continue;
    const rawStep = pickRawStep(rawRevised, kind);
    if (!rawStep) continue;
    const norm = normalizeStep(kind, rawStep);
    if (norm) revisedByKind.set(kind, norm);
  }

  const steps: PipelineStep[] = base.steps.map((s) => revisedByKind.get(s.kind) ?? s);

  const parts = base.version.split(".");
  const minor = (parseInt(parts[1] ?? "0", 10) || 0) + 1;
  const version = `${parts[0] ?? "1"}.${minor}`;

  const sk = obj(o.skeleton);
  const skeleton = sk.name
    ? normalizeSkeletonCard(sk, base.skeleton.name)
    : base.skeleton;

  const revision: RevisionEntry = {
    version,
    stepKind: fromStepKind,
    disagreement,
    at: new Date().toISOString(),
  };

  return {
    ...base,
    version,
    verdict: str(o.verdict, base.verdict),
    steps,
    skeleton,
    revisions: [...(base.revisions ?? []), revision],
  };
}
