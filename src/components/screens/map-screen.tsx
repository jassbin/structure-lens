"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { auth } from "@eazo/sdk";
import { useEazo } from "@eazo/sdk/react";
import { Network, CheckCircle2, CircleDashed, CloudUpload, Loader2, ChevronRight } from "lucide-react";
import { RootBadge } from "@/components/shared/root-badge";
import { WalkOverlay } from "@/components/shared/walk-overlay";
import { ClusterView } from "@/components/map/cluster-view";
import { ConfidenceBar } from "@/components/shared/confidence-bar";
import { cn } from "@/utils/utils";
import { getStructureMap, syncStructureMap, analyze } from "@/lib/api/analysis";
import { cacheAnalysis } from "@/lib/analysis/store";
import {
  getLocalStructureMap,
  getAllLocalAnalyses,
  rebuildLocalMapFrom,
  saveLocalAnalyses,
  saveLocalAnalysis,
  mergeLocalStructure,
} from "@/lib/analysis/local-map";
import { AppAIClientUnavailableError } from "@/lib/api/app-ai-request";
import type { StructureNode } from "@/lib/analysis/types";

/** 从本地全部分析构建「事件标题 → 分析 id」索引 */
function buildIndex(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const a of getAllLocalAnalyses()) {
    const title = a.verdict || a.input;
    if (title) map[title] = a.id;
  }
  return map;
}

export function MapScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const user = useEazo((s) => s.auth.user);
  const [nodes, setNodes] = useState<StructureNode[] | null>(() =>
    getLocalStructureMap(),
  );
  const [localCount, setLocalCount] = useState(() => getAllLocalAnalyses().length);
  const [syncing, setSyncing] = useState(false);
  // 正在当场分析的游走事件标题（点击库里没有的事件时，跑完整 8 步再跳转）
  const [analyzingEvent, setAnalyzingEvent] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "cluster">("list");
  // 事件标题 → 分析 id，用于把地图节点里的历史事件做成可点击入口（复用现有分析，不新增数据）
  const [titleToId, setTitleToId] = useState<Record<string, string>>(buildIndex);

  function rebuildIndex() {
    setTitleToId(buildIndex());
  }

  useEffect(() => {
    if (!user) return;
    let alive = true;
    // 登录后自动做一次双向同步：本地缺的从云端拉回、云端缺的推上去
    (async () => {
      try {
        const local = getAllLocalAnalyses();
        const { analyses } = await syncStructureMap(local);
        if (!alive) return;
        saveLocalAnalyses(analyses);
        setNodes(rebuildLocalMapFrom(analyses));
        setLocalCount(getAllLocalAnalyses().length);
        rebuildIndex();
      } catch {
        // 同步失败则退回云端只读展示，不影响本地已有数据
        getStructureMap()
          .then((n) => alive && setNodes(n))
          .catch(() => {});
      }
    })();
    return () => {
      alive = false;
    };
  }, [user]);

  async function handleSync() {
    if (!user) {
      auth.login().catch(() => undefined);
      return;
    }
    setSyncing(true);
    try {
      const local = getAllLocalAnalyses();
      const { pushed, analyses } = await syncStructureMap(local);
      saveLocalAnalyses(analyses);
      setNodes(rebuildLocalMapFrom(analyses));
      setLocalCount(getAllLocalAnalyses().length);
      rebuildIndex();
      toast.success(
        t("map.synced", { count: analyses.length, pushed }),
      );
    } catch {
      toast.error(t("map.syncFailed", "同步失败，请稍后重试"));
    } finally {
      setSyncing(false);
    }
  }

  /** 点击库里没有的游走事件：当场把它当新输入跑完整 8 步，生成报告后跳转 */
  async function analyzeEvent(title: string) {
    if (analyzingEvent) return;
    setAnalyzingEvent(title);
    try {
      // 该事件已是结构地图里的具体事件，无需再筛选，直接跑完整分析。
      // aligned:true —— 跳过"太模糊"分诊拦截（仍会照常联网对齐事实）
      const res = await analyze(title, { aligned: true });
      if (res.status === "diggable") {
        cacheAnalysis(res.result);
        saveLocalAnalysis(res.result);
        if (!res.persisted) mergeLocalStructure(res.result.skeleton, res.result.verdict);
        router.push(`/analysis/${res.result.id}`);
        // 保持遮罩直到路由切走
      } else {
        toast.message(
          res.triage.suggestion ?? t("home.tooShallow", "这个方向还需要更具体一些"),
        );
        setAnalyzingEvent(null);
      }
    } catch (error) {
      if (!(error instanceof AppAIClientUnavailableError)) {
        toast.error(t("home.failed", "分析失败，请稍后重试"));
      }
      setAnalyzingEvent(null);
    }
  }

  const showSync = localCount > 0 || Boolean(user);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-6">
      <WalkOverlay
        open={analyzingEvent !== null}
        phase="analyze"
        lockedTitle={analyzingEvent ?? undefined}
      />
      <div data-el="map-header">
        <div className="flex items-center gap-2">
          <Network className="h-5 w-5 text-primary" aria-hidden />
          <h1 className="font-heading text-xl font-black tracking-tight text-foreground">
            {t("map.title")}
          </h1>
        </div>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {t("map.intro")}
        </p>
      </div>

      {showSync && (
        <button
          type="button"
          onClick={handleSync}
          disabled={syncing}
          data-el="map-sync"
          className="flex items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/[0.06] px-4 py-3 text-left"
        >
          <div className="min-w-0">
            <p className="text-sm font-bold text-primary">
              {user
                ? t("map.syncCloud", "同步到云端")
                : t("map.loginToSync", "登录后把结构地图存到云端")}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("map.localCount", { count: localCount })}
            </p>
          </div>
          {syncing ? (
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
          ) : (
            <CloudUpload className="h-5 w-5 shrink-0 text-primary" />
          )}
        </button>
      )}

      {nodes === null ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          {t("common.loading")}
        </div>
      ) : nodes.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card py-12 text-center">
          <p className="px-8 text-sm text-muted-foreground">{t("map.empty")}</p>
          <Link
            href="/"
            className="inline-flex h-10 items-center rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground"
          >
            {t("map.goAnalyze")}
          </Link>
        </div>
      ) : (
        <>
          {/* 视图切换：列表 / 套路聚类 */}
          <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1" data-el="map-view-toggle">
            {(["list", "cluster"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={cn(
                  "flex-1 rounded-full px-3 py-1.5 text-xs font-bold transition-colors",
                  view === v
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t(`map.view.${v}`, v === "list" ? "列表" : "套路聚类")}
              </button>
            ))}
          </div>

          {view === "cluster" ? (
            <ClusterView
              nodes={nodes}
              titleToId={titleToId}
              analyzingEvent={analyzingEvent}
              onAnalyzeEvent={analyzeEvent}
            />
          ) : (
        <div className="flex flex-col gap-3" data-el="map-nodes">
          {nodes.map((node) => {
            const verified = node.state === "verified";
            return (
              <div
                key={node.id}
                data-el="map-node"
                className={cn(
                  "rounded-2xl border p-4 transition-colors",
                  verified
                    ? "border-primary/50 bg-primary/[0.05] shadow-sm"
                    : "border-dashed border-border bg-card",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p
                    className={cn(
                      "font-heading text-[15px] font-black leading-snug",
                      verified ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {node.name}
                  </p>
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold",
                      verified
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {verified ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <CircleDashed className="h-3 w-3" />
                    )}
                    {t(`map.state.${node.state}`)}
                  </span>
                </div>

                <div className="mt-2.5">
                  <RootBadge root={node.root} />
                </div>

                <ConfidenceBar
                  className="mt-3"
                  value={node.confidence}
                  label={t("analysis.confidence")}
                />

                <div className="mt-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    {t("map.appearsIn")}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {node.events.map((ev) => {
                      const id = titleToId[ev];
                      if (id) {
                        return (
                          <Link
                            key={ev}
                            href={`/analysis/${id}`}
                            data-el="map-event-link"
                            className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/[0.06] px-2.5 py-0.5 text-xs font-medium text-primary transition-colors hover:bg-primary/15"
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
                          onClick={() => analyzeEvent(ev)}
                          data-el="map-event-analyze"
                          className="inline-flex items-center gap-1 rounded-full border border-dashed border-border bg-card px-2.5 py-0.5 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-60"
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
