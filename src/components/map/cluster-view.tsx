"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Loader2, ChevronRight, Layers } from "lucide-react";
import { ROOT_LABELS } from "@/lib/analysis/types";
import type { RootStructure, StructureNode } from "@/lib/analysis/types";
import { cn } from "@/utils/utils";

const ROOT_ORDER: RootStructure[] = ["extraction", "delegation", "power"];

const CLUSTER_STYLE: Record<RootStructure, { ring: string; dot: string; text: string }> = {
  extraction: { ring: "border-primary/30", dot: "bg-primary", text: "text-primary" },
  delegation: { ring: "border-secondary/30", dot: "bg-secondary", text: "text-secondary" },
  power: { ring: "border-[#6b5cff]/30", dot: "bg-[#6b5cff]", text: "text-[#5647d6]" },
};

/**
 * ② 套路聚类视图：把挖过的事件按 root 根结构聚成几团，
 * 一眼看到"挖了 N 件事，其实就 M 种套路"——把"同一副骨架"的 aha 变成可展示的一张图。
 */
export function ClusterView({
  nodes,
  titleToId,
  analyzingEvent,
  onAnalyzeEvent,
}: {
  nodes: StructureNode[];
  titleToId: Record<string, string>;
  analyzingEvent: string | null;
  onAnalyzeEvent: (title: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const zh = i18n.language?.startsWith("zh");

  const { clusters, eventCount } = useMemo(() => {
    const byRoot = new Map<RootStructure, StructureNode[]>();
    const events = new Set<string>();
    for (const n of nodes) {
      const arr = byRoot.get(n.root) ?? [];
      arr.push(n);
      byRoot.set(n.root, arr);
      for (const e of n.events) events.add(e);
    }
    const clusters = ROOT_ORDER.filter((r) => byRoot.has(r)).map((r) => ({
      root: r,
      nodes: byRoot.get(r)!,
    }));
    return { clusters, eventCount: events.size };
  }, [nodes]);

  return (
    <div className="flex flex-col gap-4" data-el="cluster-view">
      {/* 炸场标题：N 件事 → M 种套路 */}
      <div className="rounded-2xl bg-gradient-to-br from-primary to-secondary p-4 text-primary-foreground shadow-[0_14px_34px_rgba(12,95,253,0.3)]">
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-primary-foreground/70">
          <Layers className="h-3.5 w-3.5" aria-hidden />
          {t("map.cluster.badge", "套路聚类")}
        </div>
        <p className="mt-1.5 font-heading text-lg font-black leading-tight">
          {t("map.cluster.headline", {
            events: eventCount,
            kinds: clusters.length,
            defaultValue: `你挖了 ${eventCount} 件事，其实就 ${clusters.length} 种底层套路`,
          })}
        </p>
      </div>

      {clusters.map(({ root, nodes: group }) => {
        const style = CLUSTER_STYLE[root];
        const groupEvents = group.reduce((s, n) => s + n.events.length, 0);
        return (
          <div
            key={root}
            data-el="cluster"
            className={cn("rounded-2xl border bg-card p-4", style.ring)}
          >
            <div className="flex items-center justify-between">
              <span className={cn("flex items-center gap-2 font-heading text-base font-black", style.text)}>
                <span className={cn("h-2.5 w-2.5 rounded-full", style.dot)} />
                {ROOT_LABELS[root]?.[zh ? "zh" : "en"] ?? root}
              </span>
              <span className="text-[11px] font-bold text-muted-foreground">
                {t("map.cluster.count", {
                  nodes: group.length,
                  events: groupEvents,
                  defaultValue: `${group.length} 副骨架 · ${groupEvents} 件事`,
                })}
              </span>
            </div>

            <div className="mt-3 space-y-2.5">
              {group.map((node) => (
                <div key={node.id} className="rounded-xl border border-border/60 bg-background/40 p-2.5">
                  <p className={cn("text-[13px] font-bold", style.text)}>{node.name}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {node.events.map((ev) => {
                      const id = titleToId[ev];
                      if (id) {
                        return (
                          <Link
                            key={ev}
                            href={`/analysis/${id}`}
                            className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/[0.06] px-2.5 py-0.5 text-xs font-medium text-primary hover:bg-primary/15"
                          >
                            {ev}
                            <ChevronRight className="h-3 w-3 shrink-0" aria-hidden />
                          </Link>
                        );
                      }
                      return (
                        <button
                          key={ev}
                          type="button"
                          disabled={analyzingEvent !== null}
                          onClick={() => onAnalyzeEvent(ev)}
                          className="inline-flex items-center gap-1 rounded-full border border-dashed border-border bg-card px-2.5 py-0.5 text-xs font-medium text-foreground hover:border-primary/40 hover:text-primary disabled:opacity-60"
                        >
                          {ev}
                          {analyzingEvent === ev ? (
                            <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden />
                          ) : (
                            <ChevronRight className="h-3 w-3 shrink-0 opacity-50" aria-hidden />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
