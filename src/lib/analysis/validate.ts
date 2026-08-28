import type {
  AnalysisLayer,
  AnalysisResult,
  LayerKind,
  RootStructure,
  StructureSkeleton,
  WalkHook,
} from "@/lib/analysis/types";
import { LAYER_ORDER } from "@/lib/analysis/types";

const ROOTS: RootStructure[] = ["extraction", "delegation", "power"];

function clampConf(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 60;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

function strArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => str(x)).filter(Boolean);
}

/** 把 AI 返回的对象规整成严格的 AnalysisResult；缺字段兜底而非崩溃 */
export function normalizeAnalysis(
  raw: unknown,
  id: string,
  input: string,
  extra?: { alignedSummary?: string; sources?: import("@/lib/analysis/types").SearchSource[] },
): AnalysisResult {
  const o = (raw ?? {}) as Record<string, unknown>;

  const rawLayers = Array.isArray(o.layers) ? o.layers : [];
  const byKind = new Map<LayerKind, AnalysisLayer>();
  for (const item of rawLayers) {
    const l = (item ?? {}) as Record<string, unknown>;
    const kind = l.kind as LayerKind;
    if (!LAYER_ORDER.includes(kind)) continue;
    byKind.set(kind, {
      kind,
      title: str(l.title, kind),
      points: strArray(l.points),
      confidence: clampConf(l.confidence),
    });
  }
  // 按方法论顺序输出已存在的层
  const layers: AnalysisLayer[] = LAYER_ORDER.map((k) => byKind.get(k)).filter(
    (l): l is AnalysisLayer => Boolean(l && l.points.length > 0),
  );

  const sk = (o.skeleton ?? {}) as Record<string, unknown>;
  const root = ROOTS.includes(sk.root as RootStructure)
    ? (sk.root as RootStructure)
    : "extraction";
  const skeleton: StructureSkeleton = {
    name: str(sk.name, str(o.verdict, "未命名结构")),
    root,
    subject: str(sk.subject, "—"),
    mechanism: str(sk.mechanism, "—"),
    extracted: str(sk.extracted, "—"),
    confidence: clampConf(sk.confidence),
  };

  const rawHooks = Array.isArray(o.walkHooks) ? o.walkHooks : [];
  const walkHooks: WalkHook[] = rawHooks
    .slice(0, 3)
    .map((item, i) => {
      const h = (item ?? {}) as Record<string, unknown>;
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
    alignedSummary: extra?.alignedSummary,
    sources: extra?.sources,
    verdict: str(o.verdict, skeleton.name),
    layers,
    skeleton,
    strongestRebuttal: str(o.strongestRebuttal, "（本次未生成反驳）"),
    blindSpot: str(o.blindSpot, "（本次未生成盲点提示）"),
    walkHooks,
    createdAt: new Date().toISOString(),
  };
}
