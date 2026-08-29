"use client";

import type {
  AnalysisResult,
  StructureNode,
  StructureSkeleton,
} from "@/lib/analysis/types";

/**
 * 免登录本地结构地图 + 分析持久化（localStorage）。
 * 逻辑与服务端 mergeStructure 对齐：同名结构累积 hits，达阈值点亮为 verified。
 * 登录后可一次性上云（见 syncLocalToCloud）。
 */
const MAP_KEY = "structure-lens:local-map";
const ANALYSES_KEY = "structure-lens:local-analyses";
const VERIFY_HITS = 2;

function verifiedConfidence(hits: number, base: number): number {
  return Math.min(92, base + (hits - 1) * 8);
}

function readMap(): StructureNode[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(MAP_KEY);
    return raw ? (JSON.parse(raw) as StructureNode[]) : [];
  } catch {
    return [];
  }
}

function writeMap(nodes: StructureNode[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MAP_KEY, JSON.stringify(nodes));
}

export function getLocalStructureMap(): StructureNode[] {
  return readMap();
}

/** 把一次分析并入本地结构地图 */
export function mergeLocalStructure(
  skeleton: StructureSkeleton,
  eventTitle: string,
): void {
  const nodes = readMap();
  const idx = nodes.findIndex((n) => n.name === skeleton.name);
  if (idx >= 0) {
    const found = nodes[idx];
    const events = Array.from(new Set([...found.events, eventTitle]));
    const hits = (found.hits ?? found.events.length) + 1;
    const verified = hits >= VERIFY_HITS && events.length >= 2;
    nodes[idx] = {
      ...found,
      events,
      hits,
      state: verified ? "verified" : "hypothesis",
      confidence: verified
        ? verifiedConfidence(hits, skeleton.confidence)
        : skeleton.confidence,
    };
  } else {
    nodes.unshift({
      id: crypto.randomUUID().slice(0, 16),
      name: skeleton.name,
      root: skeleton.root,
      state: "hypothesis",
      confidence: skeleton.confidence,
      events: [eventTitle],
      hits: 1,
    });
  }
  writeMap(nodes);
}

/** 本地保存整份分析（免登录时报告页可回读） */
export function saveLocalAnalysis(result: AnalysisResult): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(ANALYSES_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, AnalysisResult>) : {};
    all[result.id] = result;
    window.localStorage.setItem(ANALYSES_KEY, JSON.stringify(all));
  } catch {
    /* ignore quota */
  }
}

export function getLocalAnalysis(id: string): AnalysisResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ANALYSES_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, AnalysisResult>) : {};
    return all[id] ?? null;
  } catch {
    return null;
  }
}

export function getAllLocalAnalyses(): AnalysisResult[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ANALYSES_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, AnalysisResult>) : {};
    return Object.values(all);
  } catch {
    return [];
  }
}

export function hasLocalData(): boolean {
  return readMap().length > 0;
}

/**
 * 用「全量分析」重建本地结构地图（幂等，不会重复累计 hits）。
 * 用于双向同步后：把合并后的分析集合确定性地折叠成结构节点。
 */
export function rebuildLocalMapFrom(analyses: AnalysisResult[]): StructureNode[] {
  const byName = new Map<string, StructureNode>();
  // 按时间正序，保证 events 顺序稳定
  const ordered = [...analyses].sort((a, b) =>
    (a.createdAt ?? "").localeCompare(b.createdAt ?? ""),
  );
  for (const a of ordered) {
    const sk = a.skeleton;
    const title = a.verdict || a.input;
    const found = byName.get(sk.name);
    if (found) {
      const events = Array.from(new Set([...found.events, title]));
      const hits = (found.hits ?? found.events.length) + 1;
      const verified = hits >= VERIFY_HITS && events.length >= 2;
      byName.set(sk.name, {
        ...found,
        events,
        hits,
        state: verified ? "verified" : "hypothesis",
        confidence: verified
          ? verifiedConfidence(hits, sk.confidence)
          : sk.confidence,
      });
    } else {
      byName.set(sk.name, {
        id: crypto.randomUUID().slice(0, 16),
        name: sk.name,
        root: sk.root,
        state: "hypothesis",
        confidence: sk.confidence,
        events: [title],
        hits: 1,
      });
    }
  }
  const nodes = Array.from(byName.values()).reverse();
  writeMap(nodes);
  return nodes;
}

/** 批量把分析写入本地存储（用于云端→本地回流） */
export function saveLocalAnalyses(analyses: AnalysisResult[]): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(ANALYSES_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, AnalysisResult>) : {};
    for (const a of analyses) if (a?.id) all[a.id] = a;
    window.localStorage.setItem(ANALYSES_KEY, JSON.stringify(all));
  } catch {
    /* ignore quota */
  }
}
