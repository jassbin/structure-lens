"use client";

import { request } from "@/lib/api/request";
import type {
  AnalysisResult,
  SearchSource,
  StructureSkeleton,
  StepKind,
  StructureNode,
  TriageResult,
} from "@/lib/analysis/types";

export type AnalyzeResponse =
  | { status: "diggable"; result: AnalysisResult; persisted?: boolean }
  | { status: "too_shallow" | "not_applicable"; triage: TriageResult };

export type PrecheckResponse =
  | { status: "diggable" }
  | { status: "align"; input: string; summary: string; sources: SearchSource[] }
  | { status: "too_shallow" | "not_applicable"; triage: TriageResult };

/** 分诊预检：够具体直接放行；太短先静默搜——搜到走对齐、搜不到走反问。免登录。 */
export async function precheck(input: string): Promise<PrecheckResponse> {
  const res = await request("/api/precheck", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input }),
  });
  if (!res.ok) throw new Error(`precheck failed: ${res.status}`);
  return (await res.json()) as PrecheckResponse;
}

/** 提交事件做深度分析。可带对齐后的来源（跳过分诊与重复搜索）。免登录。 */
export async function analyze(
  input: string,
  opts?: { alignedSources?: SearchSource[]; aligned?: boolean },
): Promise<AnalyzeResponse> {
  const res = await request("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input, ...opts }),
  });
  if (!res.ok) throw new Error(`analyze failed: ${res.status}`);
  return (await res.json()) as AnalyzeResponse;
}

export type WalkFocusResponse = {
  picked: boolean;
  title: string;
  summary: string;
  hotness?: "hot" | "typical";
  reason?: string;
};

/** 游走事件筛选：给宽泛同构方向，联网锁定最火/最典型的具体真实事件。免登录。 */
export async function walkFocus(payload: {
  direction: string;
  reason?: string;
}): Promise<WalkFocusResponse> {
  const res = await request("/api/walk-focus", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`walkFocus failed: ${res.status}`);
  return (await res.json()) as WalkFocusResponse;
}

export type DrillMode = "challenge" | "deeper" | "counter";
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

/** 「我不同意」：从某步开始重算下游。免登录。 */
export async function recompute(payload: {
  result: AnalysisResult;
  fromStepKind: StepKind | "skeleton-card";
  disagreement: string;
}): Promise<{ result: AnalysisResult; changeNote: string; persisted: boolean }> {
  const res = await request("/api/recompute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`recompute failed: ${res.status}`);
  return (await res.json()) as {
    result: AnalysisResult;
    changeNote: string;
    persisted: boolean;
  };
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

/**
 * 双向同步：把本地分析发上云端（补齐云端缺失），并取回云端全量（供回流本地缺失）。
 * 返回 { pushed, analyses }，analyses 是合并后云端全量。
 */
export async function syncStructureMap(
  localAnalyses: AnalysisResult[],
): Promise<{ pushed: number; analyses: AnalysisResult[] }> {
  const res = await request("/api/structure-map/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ analyses: localAnalyses }),
  });
  if (!res.ok) throw new Error(`sync failed: ${res.status}`);
  const data = (await res.json()) as {
    pushed: number;
    analyses: AnalysisResult[];
  };
  return data;
}

export interface ShareRecord {
  code: string;
  input: string;
  verdict: string;
  skeleton: StructureSkeleton;
  createdAt: string;
}

/** 生成一份只读分享快照，返回短码。免登录。 */
export async function createShare(payload: {
  input: string;
  verdict: string;
  skeleton: StructureSkeleton;
}): Promise<string> {
  const res = await request("/api/share", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`createShare failed: ${res.status}`);
  const data = (await res.json()) as { code: string };
  return data.code;
}

/** 读取只读分享快照 */
export async function getShare(code: string): Promise<ShareRecord | null> {
  const res = await request(`/api/share/${code}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`getShare failed: ${res.status}`);
  const data = (await res.json()) as { share: ShareRecord };
  return data.share;
}
