"use client";

import { request } from "@/lib/api/request";
import type {
  AnalysisResult,
  StepKind,
  StructureNode,
  TriageResult,
} from "@/lib/analysis/types";

export type AnalyzeResponse =
  | { status: "diggable"; result: AnalysisResult; persisted?: boolean }
  | { status: "too_shallow" | "not_applicable"; triage: TriageResult };

/** 提交事件做深度分析。服务端会对“具体事件”后台静默联网搜索（搜到才用）。免登录。 */
export async function analyze(input: string): Promise<AnalyzeResponse> {
  const res = await request("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input }),
  });
  if (!res.ok) throw new Error(`analyze failed: ${res.status}`);
  return (await res.json()) as AnalyzeResponse;
}

export type DrillMode = "challenge" | "deeper" | "counter";

/** 对某一条判断继续深挖 / 质疑 / 反驳。免登录。 */
export async function drill(payload: {
  verdict: string;
  layerTitle: string;
  point: string;
  mode: DrillMode;
}): Promise<string> {
  const res = await request("/api/drill", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`drill failed: ${res.status}`);
  const data = (await res.json()) as { text: string };
  return data.text;
}

/** 读取某次分析 */(id: string): Promise<AnalysisResult | null> {
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

/** 后置登录：把本地分析并入云端结构地图 */
export async function importLocalToCloud(
  analyses: AnalysisResult[],
): Promise<number> {
  const res = await request("/api/structure-map/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ analyses }),
  });
  if (!res.ok) throw new Error(`import failed: ${res.status}`);
  const data = (await res.json()) as { imported: number };
  return data.imported;
}
