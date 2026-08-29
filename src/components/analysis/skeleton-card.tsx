"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Boxes } from "lucide-react";
import { RootBadge } from "@/components/shared/root-badge";
import { ConfidenceBar } from "@/components/shared/confidence-bar";
import { InfoTip } from "@/components/shared/info-tip";
import { DisagreeThread } from "@/components/analysis/pipeline/disagree-thread";
import { recompute } from "@/lib/api/analysis";
import { AppAIClientUnavailableError } from "@/lib/api/app-ai-request";
import { STANCE_LABELS } from "@/lib/analysis/types";
import type { AnalysisResult } from "@/lib/analysis/types";

/**
 * 结构骨架卡：
 * 上半——三段式揭示（原本以为是 / 真实运作是 / 为什么是这样），让用户看穿本质。
 * 下半——结构内部零件（主体/对象/机制/被提取/利益流向），说清结构本身如何运转。
 * root 主判定 + 或许更准的开放位。可「我不同意」参与共同推演。
 */
export function SkeletonCard({
  result,
  onResult,
}: {
  result: AnalysisResult;
  onResult: (r: AnalysisResult) => void;
}) {
  const { t } = useTranslation();
  const sk = result.skeleton;
  const [busy, setBusy] = useState(false);

  async function submitDisagree(objection: string) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await recompute({
        result,
        fromStepKind: "skeleton-card",
        disagreement: objection,
      });
      onResult(res.result);
      const stanceLabel =
        STANCE_LABELS[
          res.result.revisions?.[res.result.revisions.length - 1]?.stance ?? "hold"
        ].zh;
      toast.success(
        res.changeNote ? `${stanceLabel}｜${res.changeNote}` : stanceLabel,
      );
    } catch (error) {
      if (!(error instanceof AppAIClientUnavailableError)) {
        toast.error(t("pipeline.recomputeFailed"));
      }
    } finally {
      setBusy(false);
    }
  }

  const reveal: Array<{ label: string; value: string; accent?: boolean }> = [
    { label: t("analysis.skeletonCard.perceivedAs"), value: sk.perceivedAs },
    { label: t("analysis.skeletonCard.actualStructure"), value: sk.actualStructure, accent: true },
    { label: t("analysis.skeletonCard.whySo"), value: sk.whySo },
  ];

  return (
    <div
      className="rounded-2xl border border-secondary/30 bg-secondary/[0.04] p-4"
      data-el="skeleton-card"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Boxes className="h-4 w-4 text-secondary" aria-hidden />
          <span className="flex items-center gap-1.5 font-heading text-sm font-extrabold text-foreground">
            {t("analysis.skeletonCard.title")}
            <InfoTip content={t("analysis.skeletonCard.tip")} />
          </span>
        </div>
        <span className="rounded-full border border-accent/50 bg-accent/20 px-2 py-0.5 text-[10px] font-bold text-foreground">
          {t("analysis.skeletonCard.hypothesisTag")}
        </span>
      </div>

      {/* 可复用结构命名 */}
      <p className="mt-2.5 font-heading text-base font-black leading-snug text-secondary">
        {sk.name}
      </p>

      {/* 三段式揭示 */}
      <div className="mt-3 space-y-2">
        {reveal.map((r) => (
          <div
            key={r.label}
            className={
              r.accent
                ? "rounded-xl border border-secondary/40 bg-secondary/[0.07] px-3 py-2"
                : "px-0.5"
            }
          >
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              {r.label}
            </p>
            <p
              className={
                r.accent
                  ? "mt-0.5 text-sm font-bold leading-relaxed text-secondary"
                  : "mt-0.5 text-sm leading-relaxed text-foreground"
              }
            >
              {r.value}
            </p>
          </div>
        ))}
      </div>

      {/* 结构内部零件 */}
      <div className="mt-3 border-t border-border/60 pt-2.5">
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          {t("analysis.skeletonCard.parts")}
        </p>
        <dl className="mt-1.5 space-y-1.5">
          {parts.map((r) => (
            <div key={r.label} className="flex gap-2 text-sm">
              <dt className="w-14 shrink-0 font-bold text-muted-foreground">{r.label}</dt>
              <dd className="min-w-0 flex-1 text-foreground">{r.value}</dd>
            </div>
          ))}
          {sk.interestFlow.length > 0 && (
            <div className="flex gap-2 text-sm">
              <dt className="w-14 shrink-0 font-bold text-muted-foreground">
                {t("analysis.skeletonCard.flow")}
              </dt>
              <dd className="min-w-0 flex-1 space-y-0.5 text-foreground">
                {sk.interestFlow.map((f, i) => (
                  <p key={i}>{f}</p>
                ))}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/* root 主判定 + 开放位 */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-medium text-muted-foreground">
          {t("analysis.skeletonCard.root")}
        </span>
        <RootBadge root={sk.root} />
        {sk.altStructure && (
          <span className="rounded-full border border-dashed border-primary/40 bg-primary/5 px-2 py-0.5 text-[11px] font-semibold text-primary">
            {t("analysis.skeletonCard.altStructure")}：{sk.altStructure}
          </span>
        )}
      </div>

      <ConfidenceBar
        className="mt-3"
        value={sk.confidence}
        label={t("analysis.confidence")}
      />

      <DisagreeThread
        debate={sk.debate}
        busy={busy}
        onSubmit={submitDisagree}
      />
    </div>
  );
}
