// 结构透镜 —— 分析领域类型定义（前后端共享契约）
// v2：7 步推理流水线（材料分级 → 异常锁定 → 中性骨架 → 机制穿透 → 博弈类比 → 情景分支 → 核心判断+可证伪 → 对抗质检）

/** 三类根结构 */
export type RootStructure = "extraction" | "delegation" | "power";

/** 信源可信度分级 */
export type SourceGrade = "strong" | "medium" | "weak" | "unverifiable";

/** 一条材料 + 信源分级 */
export interface MaterialItem {
  fact: string;
  grade: SourceGrade;
  /** 可选来源链接 */
  url?: string;
}

/** 异常候选（步骤1） */
export interface AnomalyCandidate {
  id: string; // "A" | "B" | "C" ...
  content: string;
  /** 杠杆率 1-5：解释力越强越高 */
  leverage: number;
}

/** 中性骨架五要素（步骤2） */
export interface NeutralSkeleton {
  subject: string; // 主体
  object: string; // 对象
  mechanism: string; // 机制
  harmed: string; // 受损方
  benefited: string; // 受益方
  naming: string; // 中性命名
}

/** 机制穿透（步骤3） */
export interface MechanismPenetration {
  surface: string; // 表面
  deep: string; // 深层
  bottom: string; // 底层（可迁移的通用结构）
  interestFlow: string[]; // 利益流向，每条一行
  renaming: string; // 骨架重命名（结构事实）
}

/** 博弈与类比（步骤4） */
export interface GameAndAnalogy {
  gameSummary: string; // 博弈均衡推演
  /** 跨域同构候选 */
  analogs: { title: string; isomorphism: string }[];
  /** 提炼出的可变结构参数（胜负手） */
  variableParameter: string;
}

/** 情景分支（步骤5） */
export interface ScenarioBranch {
  label: string; // 分支名
  narrative: string; // 叙事
  probability: number; // 0-100
  warningSignals: string; // 预警信号
}

/** 核心判断 + 可证伪条件（步骤6） */
export interface CoreJudgment {
  claim: string;
  confidence: number; // 0-100
  /** 可证伪条件：出现什么就说明这条判断错了 */
  falsifiable: string;
}

/** 对抗质检（步骤7） */
export interface AdversarialCheck {
  /** 魔鬼代言人：最强反方 + 回应 */
  devilsAdvocate: { challenge: string; response: string }[];
  /** 元认知审计：偏差 + 检查结果 */
  metacognition: { bias: string; check: string }[];
}

/** 7 步之一的判别式联合 */
export type PipelineStep =
  | { kind: "materials"; title: string; materials: MaterialItem[]; note: string }
  | {
      kind: "anomaly";
      title: string;
      baseline: string; // 预期基线
      candidates: AnomalyCandidate[];
      selectedId: string; // 当前选中的入口
      reason: string; // 选它的理由
    }
  | { kind: "skeleton"; title: string; skeleton: NeutralSkeleton }
  | { kind: "mechanism"; title: string; mechanism: MechanismPenetration }
  | { kind: "game"; title: string; game: GameAndAnalogy }
  | { kind: "scenario"; title: string; variables: string[]; branches: ScenarioBranch[] }
  | { kind: "judgment"; title: string; judgments: CoreJudgment[] }
  | { kind: "adversarial"; title: string; check: AdversarialCheck };

export type StepKind = PipelineStep["kind"];

/** 步骤顺序（固定） */
export const STEP_ORDER: StepKind[] = [
  "materials",
  "anomaly",
  "skeleton",
  "mechanism",
  "game",
  "scenario",
  "judgment",
  "adversarial",
];

/** 结构骨架卡（供结构地图沉淀，从步骤3底层结构提炼） */
export interface StructureSkeleton {
  name: string; // 可迁移的命名式结构名
  root: RootStructure;
  subject: string;
  mechanism: string;
  extracted: string;
  confidence: number;
}

/** 游走钩子：结构同构候选事件 */
export interface WalkHook {
  id: string;
  title: string;
  reason: string;
}

/** 联网搜索出的来源 */
export interface SearchSource {
  title: string;
  url: string;
}

/** 一次完整分析（7 步流水线） */
export interface AnalysisResult {
  id: string;
  input: string;
  /** 报告版本，随「我不同意」重算递增：1.0 → 1.1 … */
  version: string;
  /** 一句命名式金句结论 */
  verdict: string;
  /** 7 步流水线 */
  steps: PipelineStep[];
  /** 结构骨架卡（沉淀进结构地图用） */
  skeleton: StructureSkeleton;
  /** 游走钩子 */
  walkHooks: WalkHook[];
  /** 分析所依据的来源 */
  sources?: SearchSource[];
  /** 修订记录：用户「我不同意」触发的下游重算 */
  revisions?: RevisionEntry[];
  createdAt: string;
}

/** 一次修订记录 */
export interface RevisionEntry {
  version: string; // 修订后版本号
  stepKind: StepKind; // 被干预的步骤
  disagreement: string; // 用户的反对意见
  at: string; // ISO 时间
}

/** 首屏深度题库条目 */
export interface DeepTopic {
  id: string;
  category: "policy" | "business" | "history";
  title: string;
  prompt: string;
}

/** 可挖掘性判断结果 */
export type DiggableVerdict = "diggable" | "too_shallow" | "not_applicable";

export interface TriageResult {
  verdict: DiggableVerdict;
  probes?: string[];
  suggestion?: string;
}

// ---- 结构地图 ----

export type StructureNodeState = "hypothesis" | "verified";

export interface StructureNode {
  id: string;
  name: string;
  root: RootStructure;
  state: StructureNodeState;
  confidence: number;
  events: string[];
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

export const SOURCE_GRADE_LABELS: Record<SourceGrade, { zh: string; en: string }> = {
  strong: { zh: "强", en: "Strong" },
  medium: { zh: "中", en: "Medium" },
  weak: { zh: "弱", en: "Weak" },
  unverifiable: { zh: "无法核实", en: "Unverifiable" },
};

export const STEP_LABELS: Record<StepKind, { zh: string; en: string }> = {
  materials: { zh: "材料与信源分级", en: "Materials & Sourcing" },
  anomaly: { zh: "异常锁定", en: "Anomaly Lock" },
  skeleton: { zh: "中性骨架", en: "Neutral Skeleton" },
  mechanism: { zh: "机制穿透", en: "Mechanism" },
  game: { zh: "博弈与类比", en: "Game & Analogy" },
  scenario: { zh: "情景分支", en: "Scenarios" },
  judgment: { zh: "核心判断", en: "Core Judgment" },
  adversarial: { zh: "对抗质检", en: "Adversarial Audit" },
};
