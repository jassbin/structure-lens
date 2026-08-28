import type { DeepTopic } from "@/lib/analysis/types";

/** 首屏深度题库：极深的现成选题（真实产品内容） */
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
