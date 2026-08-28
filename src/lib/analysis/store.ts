"use client";

import type { AnalysisResult } from "@/lib/analysis/types";

/**
 * 会话内缓存：入口页拿到 AI 分析结果后暂存，报告页可秒开。
 * 真实持久化在数据库（按 userId），报告页缓存未命中时回退到 API。
 */
const KEY = "structure-lens:cache";

function readAll(): Record<string, AnalysisResult> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, AnalysisResult>) : {};
  } catch {
    return {};
  }
}

export function cacheAnalysis(result: AnalysisResult): void {
  if (typeof window === "undefined") return;
  const all = readAll();
  all[result.id] = result;
  window.sessionStorage.setItem(KEY, JSON.stringify(all));
}

export function getCachedAnalysis(id: string): AnalysisResult | null {
  return readAll()[id] ?? null;
}
