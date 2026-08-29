"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { auth } from "@eazo/sdk";
import { useEazo } from "@eazo/sdk/react";
import { Network, CheckCircle2, CircleDashed, CloudUpload, Loader2 } from "lucide-react";
import { RootBadge } from "@/components/shared/root-badge";
import { ConfidenceBar } from "@/components/shared/confidence-bar";
import { cn } from "@/utils/utils";
import { getStructureMap, syncStructureMap } from "@/lib/api/analysis";
import {
  getLocalStructureMap,
  getAllLocalAnalyses,
  rebuildLocalMapFrom,
  saveLocalAnalyses,
} from "@/lib/analysis/local-map";
import type { StructureNode } from "@/lib/analysis/types";

export function MapScreen() {
  const { t } = useTranslation();
  const user = useEazo((s) => s.auth.user);
  const [nodes, setNodes] = useState<StructureNode[] | null>(() =>
    getLocalStructureMap(),
  );
  const [localCount, setLocalCount] = useState(() => getAllLocalAnalyses().length);
  const [syncing, setSyncing] = useState(false);

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
      toast.success(
        t("map.synced", { count: analyses.length, pushed }),
      );
    } catch {
      toast.error(t("map.syncFailed", "同步失败，请稍后重试"));
    } finally {
      setSyncing(false);
    }
  }

  const showSync = localCount > 0;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-6">
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
                    {node.events.map((ev) => (
                      <span
                        key={ev}
                        className="rounded-full border border-border bg-card px-2.5 py-0.5 text-xs font-medium text-foreground"
                      >
                        {ev}
                      </span>
                    ))}
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
