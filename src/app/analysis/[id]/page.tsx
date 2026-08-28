"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ShieldAlert, Compass, ArrowRight, Check } from "lucide-react";
import { AppShell } from "@/components/shared/app-shell";
import { BottomTabs } from "@/components/shared/bottom-tabs";
import { LayerAccordion } from "@/components/analysis/layer-accordion";
import { SkeletonCard } from "@/components/analysis/skeleton-card";
import { Button } from "@/components/ui/button";
import { getAnalysis, saveAnalysis } from "@/lib/analysis/store";
import { analyzeLocally, makeId } from "@/lib/analysis/engine";
import type { AnalysisResult } from "@/lib/analysis/types";

export default function AnalysisPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { t } = useTranslation();
  const router = useRouter();
  const [result, setResult] = useState<AnalysisResult | null | undefined>(undefined);

  useEffect(() => {
    setResult(getAnalysis(id));
  }, [id]);

  function digHook(title: string) {
    const newId = makeId();
    const r = analyzeLocally(title, newId);
    saveAnalysis(r);
    router.push(`/analysis/${newId}`);
  }

  if (result === undefined) {
    return (
      <AppShell tab={<BottomTabs />}>
        <div className="p-6 text-center text-sm text-muted-foreground">
          {t("common.loading")}
        </div>
      </AppShell>
    );
  }

  if (result === null) {
    return (
      <AppShell tab={<BottomTabs />}>
        <div className="flex flex-col items-center gap-3 p-10 text-center">
          <p className="text-sm text-muted-foreground">{t("analysis.notFound")}</p>
          <Button asChild variant="outline" className="rounded-xl">
            <Link href="/">{t("analysis.back")}</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell tab={<BottomTabs />}>
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-4">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="flex items-center gap-1 self-start text-sm font-semibold text-muted-foreground"
          data-el="analysis-back"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("analysis.back")}
        </button>

        {/* 第一重震撼：金句暴击 */}
        <div
          className="rounded-3xl border border-primary/20 bg-primary p-5 text-primary-foreground shadow-[0_18px_44px_rgba(12,95,253,0.28)]"
          data-el="verdict-hero"
        >
          <span className="text-[11px] font-bold uppercase tracking-widest text-primary-foreground/70">
            {t("analysis.verdictLabel")}
          </span>
          <p className="mt-2 font-heading text-2xl font-black leading-tight">
            {result.verdict}
          </p>
        </div>

        {/* 逐层展开 */}
        <LayerAccordion layers={result.layers} />

        {/* 结构骨架卡 */}
        <SkeletonCard skeleton={result.skeleton} />

        {/* 反噬保护 */}
        <div
          className="rounded-2xl border border-destructive/25 bg-destructive/[0.04] p-4"
          data-el="backfire-guard"
        >
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-destructive" aria-hidden />
            <span className="font-heading text-sm font-extrabold text-foreground">
              {t("analysis.rebuttal.title")}
            </span>
          </div>
          <div className="mt-3 space-y-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-destructive">
                {t("analysis.rebuttal.strongest")}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-foreground">
                {result.strongestRebuttal}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-destructive">
                {t("analysis.rebuttal.blindSpot")}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-foreground">
                {result.blindSpot}
              </p>
            </div>
          </div>
        </div>

        {/* 承接：已存入结构地图 */}
        <div
          className="flex items-center gap-2 rounded-xl border border-secondary/20 bg-secondary/[0.06] px-4 py-2.5 text-sm font-semibold text-secondary"
          data-el="saved-to-map"
        >
          <Check className="h-4 w-4" />
          {t("analysis.savedToMap")}
        </div>

        {/* 游走钩子 */}
        <div className="flex flex-col gap-3" data-el="walk-hooks">
          <div className="flex items-center gap-2">
            <Compass className="h-4 w-4 text-primary" aria-hidden />
            <span className="font-heading text-sm font-extrabold text-foreground">
              {t("analysis.walk.title")}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{t("analysis.walk.intro")}</p>
          <div className="grid gap-2.5">
            {result.walkHooks.map((hook) => (
              <button
                key={hook.id}
                type="button"
                onClick={() => digHook(hook.title)}
                data-el="walk-hook"
                className="group flex items-start gap-3 rounded-2xl border border-border bg-card p-3.5 text-left shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-foreground">{hook.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {hook.reason}
                  </p>
                </div>
                <span className="mt-0.5 inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-2 py-1 text-[11px] font-bold text-primary">
                  {t("analysis.walk.dig")}
                  <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
