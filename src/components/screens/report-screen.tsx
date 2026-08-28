"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ArrowLeft, ShieldAlert, Compass, ArrowRight, Check } from "lucide-react";
import { LayerAccordion } from "@/components/analysis/layer-accordion";
import { SkeletonCard } from "@/components/analysis/skeleton-card";
import { Button } from "@/components/ui/button";
import { getCachedAnalysis, cacheAnalysis } from "@/lib/analysis/store";
import { analyze, getAnalysis } from "@/lib/api/analysis";
import { AppAIClientUnavailableError } from "@/lib/api/app-ai-request";
import type { AnalysisResult } from "@/lib/analysis/types";

export function ReportScreen({ id }: { id: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [result, setResult] = useState<AnalysisResult | null | undefined>(
    () => getCachedAnalysis(id) ?? undefined,
  );
  const [digging, setDigging] = useState(false);

  useEffect(() => {
    if (result !== undefined) return;
    let alive = true;
    getAnalysis(id)
      .then((r) => alive && setResult(r))
      .catch(() => alive && setResult(null));
    return () => {
      alive = false;
    };
  }, [id, result]);

  async function digHook(title: string) {
    if (digging) return;
    setDigging(true);
    try {
      const res = await analyze(title);
      if (res.status === "diggable") {
        cacheAnalysis(res.result);
        router.push(`/analysis/${res.result.id}`);
      } else {
        toast.message(res.triage.suggestion ?? "这个方向还需要更具体一些");
        setDigging(false);
      }
    } catch (error) {
      if (!(error instanceof AppAIClientUnavailableError)) {
        toast.error("分析失败，请稍后重试");
      }
      setDigging(false);
    }
  }

  if (result === undefined) {
    return (
      <div className="p-10 text-center text-sm text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  if (result === null) {
    return (
      <div className="flex flex-col items-center gap-3 p-10 text-center">
        <p className="text-sm text-muted-foreground">{t("analysis.notFound")}</p>
        <Button asChild variant="outline" className="rounded-xl">
          <Link href="/">{t("analysis.back")}</Link>
        </Button>
      </div>
    );
  }

  return (
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

      <div
        className="rounded-3xl bg-primary p-5 text-primary-foreground shadow-[0_18px_44px_rgba(12,95,253,0.28)]"
        data-el="verdict-hero"
      >
        <span className="text-[11px] font-bold uppercase tracking-widest text-primary-foreground/70">
          {t("analysis.verdictLabel")}
        </span>
        <p className="mt-2 font-heading text-2xl font-black leading-tight">
          {result.verdict}
        </p>
      </div>

      <LayerAccordion layers={result.layers} />
      <SkeletonCard skeleton={result.skeleton} />

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

      <div
        className="flex items-center gap-2 rounded-xl border border-secondary/20 bg-secondary/[0.06] px-4 py-2.5 text-sm font-semibold text-secondary"
        data-el="saved-to-map"
      >
        <Check className="h-4 w-4" />
        {t("analysis.savedToMap")}
      </div>

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
              disabled={digging}
              onClick={() => digHook(hook.title)}
              data-el="walk-hook"
              className="group flex items-start gap-3 rounded-2xl border border-border bg-card p-3.5 text-left shadow-sm transition-all hover:border-primary/40 hover:shadow-md disabled:opacity-60"
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
  );
}
