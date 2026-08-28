import type { TriageResult } from "@/lib/analysis/types";

/**
 * 可挖掘性分诊（纯函数，前后端共用）。
 * - 情绪/关系类且短 → not_applicable（温和引导，不硬套结构分析）
 * - 太短/太模糊 → too_shallow（进入对话探井）
 * - 否则 → diggable
 */
export function triageInput(input: string): TriageResult {
  const text = input.trim();
  const notApplicable =
    /(心情|情绪|难受|喜欢|想他|想她|感觉自己|emo|mood|feel like)/i;
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
        "这件事里，最让你觉得‘不对劲’的具体决定或动作是什么？",
        "涉及哪些主体？他们各自想要什么？",
      ],
    };
  }
  return { verdict: "diggable" };
}
