"use client";

import { request } from "@/lib/api/request";
import type {
  AnalysisResult,
  StructureNode,
  TriageResult,
} from "@/lib/analysis/types";

export type AnalyzeResponse =
  | { status: "diggable"; result: AnalysisResult }
  | { status: "too_shallow" | "not_applicable"; triage: TriageResult };

/** 提交一个事件做深度分析；分诊不通过时返回引导 */
export async function analyze(input: string): Promise<AnalyzeResponse> {
  const res = await request("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input }),
  });
  if (!res.ok) throw new Error(`analyze failed: ${res.status}`);
  return (await res.json()) as AnalyzeResponse;
}

/** 读取某次分析 */
export async function getAnalysis(id: string): Promise<AnalysisResult | null> {
  const res = await request(`/api/analyses/${id}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`getAnalysis failed: ${res.status}`);
  const data = (await res.json()) as { result: AnalysisResult };
  return data.result;
}

/** 读取结构地图节点 */
export async function getStructureMap(): Promise<StructureNode[]> {
  const res = await request("/api/structure-map");
  if (!res.ok) throw new Error(`getStructureMap failed: ${res.status}`);
  const data = (await res.json()) as { nodes: StructureNode[] };
  return data.nodes;
}
