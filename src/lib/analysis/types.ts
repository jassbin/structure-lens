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

/** 机制穿透（步骤3）—— 递归钻探链：锁定异常 → 逐层 why 追问 → 每层爆破 → 见底基岩 */
export type BedrockKind = "human_nature" | "incentive" | "power" | "information" | "scarcity";

/** 一钻：对上一层的追问 + 钻开后的发现 + 这一层的反直觉爆破点 */
export interface DrillLayer {
  ask: string; // 这一层要追问什么（对上一层结论的 why 追问）
  finding: string; // 钻开后看到的机制
  breakthrough: string; // 这一层的爆破/反直觉落点（颠覆了上一层的什么认知）
}

export interface MechanismPenetration {
  anchorAnomaly: string; // 锁定：这条钻探顺着哪个异常点往下（对应异常锁定选中的入口）
  layers: DrillLayer[]; // 递归钻探层（2-5 层，从表层往基岩逐层向下）
  bedrockKind: BedrockKind; // 见底基岩类别
  bedrock: string; // 触到基岩的一句话结构命题
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

/** AI 对用户反对的表态 */
export type DebateStance = "absorb" | "compromise" | "hold";

/** 一节内的一轮人机辩论（用户反对 → AI 表态+理由） */
export interface DebateTurn {
  /** 用户这一轮的反对/反驳 */
  objection: string;
  /** AI 的表态：吸收 / 折中 / 保持不变 */
  stance: DebateStance;
  /** AI 给出的理由（任何表态都必须有） */
  reason: string;
  at: string; // ISO
}

/**
 * 下游增量覆盖层：受某次调整影响的步骤不覆盖原内容，
 * 而是标注"原内容因何不再适用"，并把新内容追加展示。
 */
export interface StepOverlay {
  /** 触发这次调整的版本号 */
  version: string;
  /** 原内容为什么不再（完全）适用 */
  obsoleteReason: string;
  /** 追加/修订后的新内容（纯文本增量，按行展示） */
  addendum: string[];
  /** 仅骨架卡使用：本次调整若改动了根结构判定，记录前后（如 extraction → delegation） */
  rootChange?: { from: RootStructure; to: RootStructure };
  /** 仅骨架卡使用：本次骨架留痕是被哪个下游步骤的辩论带动的（步骤 kind）；直接反驳骨架本身时为空 */
  triggeredBy?: StepKind;
  at: string; // ISO
}

/** 每个步骤共有的可选元信息：辩论记录 + 增量覆盖层 */
export interface StepMeta {
  /** 这一节下面的人机辩论留痕（可多轮） */
  debate?: DebateTurn[];
  /** 下游受影响时的增量覆盖层（可叠加多次） */
  overlays?: StepOverlay[];
}

/** 7 步之一的判别式联合（每个成员都带可选 StepMeta） */
export type PipelineStep = StepMeta &
  (
    | { kind: "materials"; title: string; materials: MaterialItem[]; note: string }
    | {
        kind: "anomaly";
        title: string;
        baseline: string;
        candidates: AnomalyCandidate[];
        selectedId: string;
        reason: string;
      }
    | { kind: "skeleton"; title: string; skeleton: NeutralSkeleton }
    | { kind: "mechanism"; title: string; mechanism: MechanismPenetration }
    | { kind: "game"; title: string; game: GameAndAnalogy }
    | { kind: "scenario"; title: string; variables: string[]; branches: ScenarioBranch[] }
    | { kind: "judgment"; title: string; judgments: CoreJudgment[] }
    | { kind: "adversarial"; title: string; check: AdversarialCheck }
  );

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

/**
 * 结构骨架卡：既揭示"真实运作/可复用结构"，又用"动态零件"说清这个结构本身怎么运作。
 * 零件不写死——由 AI 根据具体结构决定列哪几个（提取型/委托型/权力型各不相同）。
 */
export interface StructureSkeleton {
  name: string; // 可迁移、可复用的命名式结构名
  /** 三段式揭示 —— 让用户看穿本质 */
  perceivedAs: string; // 原本以为是（表面叙事）
  actualStructure: string; // 真实运作是（底层真实、可迁移复用的结构）
  whySo: string; // 为什么是这样（结构成立的根本原因）
  /** 结构内部动态零件：由结构本身决定的 2-5 个关键零件（名称+内容） */
  parts: { label: string; value: string }[];
  /** 主判定 + 开放位 */
  root: RootStructure; // 主流根结构判定
  altStructure?: string; // 或许更准的结构（三分类都不够贴时）
  confidence: number;
  /** 骨架卡自身的辩论留痕（用户也可反驳骨架） */
  debate?: DebateTurn[];
  /** 骨架被吸收/折中调整时的增量记录（不覆盖，追加"本次调整改了什么"，含 root 变更） */
  overlays?: StepOverlay[];
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
  stepKind: StepKind | "skeleton-card"; // 被干预的步骤（skeleton-card 表示骨架卡本身）
  disagreement: string; // 用户的反对意见
  stance: DebateStance; // AI 的表态
  reason: string; // AI 的理由
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

export const STANCE_LABELS: Record<DebateStance, { zh: string; en: string }> = {
  absorb: { zh: "吸收调整", en: "Absorbed" },
  compromise: { zh: "折中处理", en: "Compromised" },
  hold: { zh: "保持不变", en: "Held" },
};

export const BEDROCK_LABELS: Record<BedrockKind, { zh: string; en: string }> = {
  human_nature: { zh: "人性", en: "Human nature" },
  incentive: { zh: "激励", en: "Incentive" },
  power: { zh: "权力", en: "Power" },
  information: { zh: "信息不对称", en: "Information asymmetry" },
  scarcity: { zh: "稀缺分配", en: "Scarcity allocation" },
};
