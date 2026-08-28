import type {
  AnalysisResult,
  TriageResult,
} from "@/lib/analysis/types";
import { DEMO_ANALYSIS } from "@/lib/analysis/mock";

/** 生成一个稳定 id */
export function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * 本地可挖掘性判断（前端演示版，稍后由真实 AI 替换）。
 * 规则：太短/太模糊 -> too_shallow；情绪/关系类 -> not_applicable；否则 diggable。
 */
export function triageLocally(input: string): TriageResult {
  const text = input.trim();
  const notApplicable = /(心情|情绪|难受|喜欢|爱|想他|想她|感觉自己|emo|mood|feel like)/i;
  if (notApplicable.test(text) && text.length < 40) {
    return {
      verdict: "not_applicable",
      suggestion:
        "这更像是一种感受或关系状态，结构分析帮不上太多。它更适合体感式的复盘，而不是拆解利益结构。",
    };
  }
  if (text.length < 16) {
    return {
      verdict: "too_shallow",
      probes: [
        "这件事里，最让你觉得'不对劲'的具体决定或动作是什么？",
        "涉及哪些主体？他们各自想要什么？",
      ],
    };
  }
  return { verdict: "diggable" };
}

/**
 * 本地分析生成（前端演示版）。真实实现走 API -> ai.chat()。
 * 这里以 DEMO_ANALYSIS 为模板，替换输入与 id，让每次分析都可展示完整形态。
 */
export function analyzeLocally(input: string, id: string): AnalysisResult {
  return {
    ...DEMO_ANALYSIS,
    id,
    input,
    createdAt: new Date().toISOString(),
  };
}
