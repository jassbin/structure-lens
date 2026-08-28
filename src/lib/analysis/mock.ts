import type {
  AnalysisResult,
  DeepTopic,
  StructureMap,
} from "@/lib/analysis/types";

/** 首屏深度题库：极深的现成选题，一键体验"能挖这么深" */
export const DEEP_TOPICS: DeepTopic[] = [
  {
    id: "wang-anshi",
    category: "history",
    title: "王安石变法为什么越改越乱",
    prompt:
      "王安石变法本意是富国强兵、抑制兼并，但推行过程中青苗法、免役法层层加码，地方执行走样，最终民怨沸腾、党争激化，改革失败。",
  },
  {
    id: "free-opensource",
    category: "business",
    title: "某大厂突然把核心产品免费开源，图什么",
    prompt:
      "一家占据市场优势的大厂，突然把原本收费的核心产品宣布永久免费并开源，社区一片叫好，竞品措手不及。",
  },
  {
    id: "housing-limit",
    category: "policy",
    title: "限购政策真正在重新分配什么",
    prompt:
      "某城市出台严格的房产限购政策，官方叙事是抑制投机、保障刚需，但二手房价格与购房资格的稀缺性同时被推高。",
  },
  {
    id: "esg-pledge",
    category: "business",
    title: "某公司高调宣布 ESG 承诺的背后",
    prompt:
      "一家长期被批评污染与用工问题的公司，突然高调发布宏大的 ESG 可持续承诺并大力宣传，股价短期上扬。",
  },
];

/** 一个完整的示例分析结果（用于 preview_route / 首次演示） */
export const DEMO_ANALYSIS: AnalysisResult = {
  id: "demo-reform",
  input: DEEP_TOPICS[0].prompt,
  verdict: "用来改革中间层的工具，本身就是中间层。",
  layers: [
    {
      kind: "skeleton",
      title: "事件骨架（中性）",
      points: [
        "主体：中央改革者试图绕过既得利益、直达基层。",
        "机制：设计新政策工具（青苗、免役）自上而下推行。",
        "结果：工具的执行权仍落在它本想改造的中间层手里。",
      ],
      confidence: 82,
    },
    {
      kind: "drill",
      title: "三层下钻",
      points: [
        "表面：法令设计不周、执行走样。",
        "深层：改革者与执行者的激励不一致。",
        "底层：改造中间层的工具，必须经由中间层执行——工具与对象同体。",
      ],
      confidence: 76,
    },
    {
      kind: "dark",
      title: "谁获益",
      points: [
        "地方执行层获得新的加码与寻租空间。",
        "改革者获得'已推行改革'的政治叙事。",
        "真正被提取的是基层，其负担在层层加码中被放大。",
      ],
      confidence: 70,
    },
    {
      kind: "game",
      title: "多方博弈均衡",
      points: [
        "中央要绩效、地方要空间、基层无议价权。",
        "均衡点落在'名义执行、实质加码'——各方都能交差。",
      ],
      confidence: 68,
    },
    {
      kind: "probability",
      title: "概率判断",
      points: [
        "在'工具经由被改造对象执行'的结构下，改革走样的概率很高。",
        "该判断可迁移到现代组织的中层改革。",
      ],
      confidence: 74,
    },
  ],
  skeleton: {
    name: "用来改革中间层的工具本身就是中间层",
    root: "delegation",
    subject: "自上而下的改革者",
    mechanism: "设计新政策工具并交由既有中间层执行",
    extracted: "基层的资源与议价空间，在层层加码中被提取",
    confidence: 72,
  },
  strongestRebuttal:
    "最强反驳：失败也可能主要源于具体法条设计缺陷与财政时机，而非结构必然——若换一套执行监督机制，未必走样。",
  blindSpot:
    "这个结论最可能错在：把'历史叙事中的失败'当成'结构的必然'，可能高估了结构、低估了偶然与人事。",
  walkHooks: [
    {
      id: "modern-mid-reform",
      title: "现代大公司的中层改革为何屡屡失效",
      reason: "同样是'改造中间层的工具必须由中间层执行'的委托-执行结构。",
    },
    {
      id: "tax-farming",
      title: "历史上的包税制为何总走向盘剥",
      reason: "提取权被下放给执行者，激励与委托目标背离。",
    },
  ],
  createdAt: "2026-01-01T00:00:00.000Z",
};

/** 示例结构地图（假设 + 已点亮） */
export const DEMO_MAP: StructureMap = {
  nodes: [
    {
      id: "n1",
      name: "用来改革中间层的工具本身就是中间层",
      root: "delegation",
      state: "verified",
      confidence: 78,
      events: ["王安石变法", "现代中层改革", "历史包税制"],
    },
    {
      id: "n2",
      name: "把稀缺性伪装成公平的再分配",
      root: "extraction",
      state: "hypothesis",
      confidence: 55,
      events: ["房产限购"],
    },
    {
      id: "n3",
      name: "用叙事赎买合法性",
      root: "power",
      state: "hypothesis",
      confidence: 48,
      events: ["ESG 承诺"],
    },
  ],
  edges: [
    { from: "n1", to: "n2", relation: "parallel" },
    { from: "n2", to: "n3", relation: "cause" },
  ],
};
