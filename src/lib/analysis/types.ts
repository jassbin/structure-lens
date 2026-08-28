// 结构透镜 —— 分析领域类型定义（前后端共享契约）

/** 三类根结构 */
export type RootStructure = "extraction" | "delegation" | "power";

/** 一次分析中每个可展开层的类型 */
export type LayerKind =
  | "skeleton" // 事件抽象骨架
  | "drill" // 三层下钻
  | "dark" // 谁获益 / 暗黑逻辑
  | "game" // 多方博弈均衡
  | "probability"; // 概率判断

export interface AnalysisLayer {
  kind: LayerKind;
  /** 该层小标题 */
  title: string;
  /** 主体内容，若干要点 */
  points: string[];
  /** 0-100 置信度；概率层则表示该判断概率 */
  confidence: number;
}

/** 结构骨架卡：主体→机制→被提取方 的拓扑 */
export interface StructureSkeleton {
  /** 命名式结构名，可迁移 */
  name: string;
  root: RootStructure;
  subject: string; // 主体
  mechanism: string; // 通过什么机制
  extracted: string; // 提取了谁的什么
  /** 单次分析给出的是"假设"，置信度诚实标注 */
  confidence: number;
}

/** 游走钩子：结构同构的候选事件 */
export interface WalkHook {
  id: string;
  title: string;
  /** 为什么它可能同构 */
  reason: string;
}

/** 联网搜索出的来源 */
export interface SearchSource {
  title: string;
  url: string;
}

/** 事实对齐结果：搜索后整理的事件概要，供用户确认/修正 */
export interface AlignResult {
  summary: string;
  confident: boolean;
  sources: SearchSource[];
  questions: string[];
}

/** 一次完整的分析结果 */
export interface AnalysisResult {
  id: string;
  /** 用户输入的原始事件 */
  input: string;
  /** 对齐后使用的事件概要（若走了搜索对齐） */
  alignedSummary?: string;
  /** 分析所依据的来源 */
  sources?: SearchSource[];
  /** 一句命名式金句暴击 */
  verdict: string;
  /** 逐层展开 */
  layers: AnalysisLayer[];
  /** 结构骨架卡（结构假设） */
  skeleton: StructureSkeleton;
  /** 反噬保护：最强反驳 + 这个结论最可能错在哪 */
  strongestRebuttal: string;
  blindSpot: string;
  /** 游走钩子：同构候选事件 */
  walkHooks: WalkHook[];
  createdAt: string;
}

/** 首屏深度题库条目 */
export interface DeepTopic {
  id: string;
  category: "policy" | "business" | "history";
  title: string;
  prompt: string; // 点选后送入分析的完整事件描述
}

/** 可挖掘性判断结果 */
export type DiggableVerdict = "diggable" | "too_shallow" | "not_applicable";

export interface TriageResult {
  verdict: DiggableVerdict;
  /** too_shallow 时的反问，用于对话探井 */
  probes?: string[];
  /** not_applicable 时的温和建议 */
  suggestion?: string;
}

// ---- 结构地图 ----

export type StructureNodeState = "hypothesis" | "verified";

export interface StructureNode {
  id: string;
  name: string;
  root: RootStructure;
  state: StructureNodeState;
  /** 置信度随碰撞提升 */
  confidence: number;
  /** 它出现过的事件标题 */
  events: string[];
  /** 碰撞次数（本地地图使用；云端由 events 推导） */
  hits?: number;
}

export interface StructureEdge {
  from: string;
  to: string;
  relation: "cause" | "parallel" | "hierarchy";
}

export interface StructureMap {
  nodes: StructureNode[];
  edges: StructureEdge[];
}

export const ROOT_LABELS: Record<RootStructure, { zh: string; en: string }> = {
  extraction: { zh: "提取-分配", en: "Extraction" },
  delegation: { zh: "委托-执行", en: "Delegation" },
  power: { zh: "权力竞争-均衡", en: "Power" },
};

export const LAYER_ORDER: LayerKind[] = [
  "skeleton",
  "drill",
  "dark",
  "game",
  "probability",
];
