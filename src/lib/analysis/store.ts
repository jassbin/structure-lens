"use client";

import type { AnalysisResult } from "@/lib/analysis/types";
import { DEMO_ANALYSIS } from "@/lib/analysis/mock";

/**
 * 前端演示阶段：用 sessionStorage 在入口页与报告页之间传递分析结果。
 * 后端阶段会替换为数据库读写（按 userId 归属）。
 */
const KEY = "structure-lens:analyses";

function readAll(): Record<string, AnalysisResult> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, AnalysisResult>) : {};
  } catch {
    return {};
  }
}

export function saveAnalysis(result: AnalysisResult): void {
  if (typeof window === "undefined") return;
  const all = readAll();
  all[result.id] = result;
  window.sessionStorage.setItem(KEY, JSON.stringify(all));
}

export function getAnalysis(id: string): AnalysisResult | null {
  if (id === DEMO_ANALYSIS.id) {
    const all = readAll();
    return all[id] ?? DEMO_ANALYSIS;
  }
  return readAll()[id] ?? null;
}
