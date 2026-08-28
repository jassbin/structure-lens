"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Network, CheckCircle2, CircleDashed } from "lucide-react";
import { RootBadge } from "@/components/shared/root-badge";
import { ConfidenceBar } from "@/components/shared/confidence-bar";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/utils";
import { getStructureMap } from "@/lib/api/analysis";
import type { StructureNode } from "@/lib/analysis/types";

export function MapScreen() {
  const { t } = useTranslation();
  const [nodes, setNodes] = useState<StructureNode[] | null>(null);

  useEffect(() => {
    let alive = true;
    getStructureMap()
      .then((n) => alive && setNodes(n))
      .catch(() => alive && setNodes([]));
    return () => {
      alive = false;
    };
  }, []);

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
