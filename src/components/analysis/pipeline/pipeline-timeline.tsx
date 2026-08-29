"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ChevronDown, Loader2, MessageSquareX, Send } from "lucide-react";
import { StepBody } from "@/components/analysis/pipeline/step-body";
import { InfoTip } from "@/components/shared/info-tip";
import { recompute } from "@/lib/api/analysis";
import { AppAIClientUnavailableError } from "@/lib/api/app-ai-request";
import { STEP_LABELS, STEP_ORDER } from "@/lib/analysis/types";
import type { AnalysisResult, StepKind } from "@/lib/analysis/types";
import { cn } from "@/utils/utils";

/** 7 步竖向推理流水线 —— 逐步展开 + 单步「我不同意」下游重算 */
export function PipelineTimeline({
  result,
  onResult,
}: {
  result: AnalysisResult;
  onResult: (r: AnalysisResult) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    // 默认全部展开，保留“逐步看见”的通读感
    const init: Record<string, boolean> = {};
    for (const s of result.steps) init[s.kind] = true;
    return init;
  });
  const [disagreeOn, setDisagreeOn] = useState<StepKind | null>(null);
  const [draft, setDraft] = useState("");
  const [recomputing, setRecomputing] = useState<StepKind | null>(null);

  const total = result.steps.length;

  async function submitDisagree(kind: StepKind) {
    const text = draft.trim();
    if (!text || recomputing) return;
    setRecomputing(kind);
    try {
      const res = await recompute({ result, fromStepKind: kind, disagreement: text });
      onResult(res.result);
      setDisagreeOn(null);
      setDraft("");
      toast.success(
        res.changeNote
          ? `${t("pipeline.recomputed")} v${res.result.version}｜${res.changeNote}`
          : `${t("pipeline.recomputed")} v${res.result.version}`,
      );
    } catch (error) {
      if (!(error instanceof AppAIClientUnavailableError)) {
        toast.error(t("pipeline.recomputeFailed"));
      }
    } finally {
      setRecomputing(null);
    }
  }

  return (
    <div className="flex flex-col gap-2" data-el="pipeline-timeline">
      <div className="flex items-center justify-between px-0.5">
        <span className="flex items-center gap-1.5 font-heading text-sm font-extrabold text-foreground">
          {t("pipeline.title")}
          <InfoTip content={t("pipeline.tips.title")} />
        </span>
        <span className="text-[11px] font-semibold text-muted-foreground">
          {total} {t("pipeline.steps")}
        </span>
      </div>

      <ol className="relative flex flex-col">
        {result.steps.map((step, idx) => {
          const isOpen = open[step.kind];
          const order = STEP_ORDER.indexOf(step.kind);
          const label = STEP_LABELS[step.kind]?.zh ?? step.title;
          const busy = recomputing === step.kind;
          const last = idx === result.steps.length - 1;
          return (
            <li key={step.kind} className="relative pl-9" data-el="pipeline-step">
              {/* 连接线 */}
              {!last && (
                <span className="absolute left-[13px] top-7 h-[calc(100%-1rem)] w-px bg-border" />
              )}
              {/* 序号节点 */}
              <span className="absolute left-0 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-black text-primary-foreground shadow-sm">
                {order}
              </span>

              <div className="pb-3">
                <div className="flex w-full items-center justify-between gap-2 py-1.5">
                  <span className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setOpen((p) => ({ ...p, [step.kind]: !p[step.kind] }))
                      }
                      className="text-left font-heading text-[15px] font-extrabold text-foreground"
                    >
                      {label}
                    </button>
                    <InfoTip content={t(`pipeline.tips.${step.kind}`)} />
                  </span>
                  <button
                    type="button"
                    aria-label={label}
                    onClick={() =>
                      setOpen((p) => ({ ...p, [step.kind]: !p[step.kind] }))
                    }
                  >
                    <ChevronDown
                      className={cn(
                      "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                      isOpen && "rotate-180",
                    )}
                  />
                </button>

                {isOpen && (
                  <div className="mt-1.5 rounded-2xl border border-border bg-card p-3.5 shadow-sm">
                    <StepBody step={step} verdict={result.verdict} />

                    {/* 我不同意 */}
                    <div className="mt-3 border-t border-border/60 pt-2.5">
                      {disagreeOn === step.kind ? (
                        <div className="space-y-2">
                          <p className="text-[11px] font-semibold text-muted-foreground">
                            {t("pipeline.disagreeHint")}
                          </p>
                          <textarea
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            rows={2}
                            autoFocus
                            placeholder={t("pipeline.disagreePlaceholder")}
                            className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/60"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={!draft.trim() || busy}
                              onClick={() => submitDisagree(step.kind)}
                              className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
                            >
                              {busy ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Send className="h-3.5 w-3.5" />
                              )}
                              {t("pipeline.recomputeCta")}
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => {
                                setDisagreeOn(null);
                                setDraft("");
                              }}
                              className="text-xs font-semibold text-muted-foreground"
                            >
                              {t("common.cancel", "取消")}
                            </button>
                          </div>
                          {busy && (
                            <p className="text-[11px] text-muted-foreground">
                              {t("pipeline.recomputingDownstream")}
                            </p>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setDisagreeOn(step.kind);
                            setDraft("");
                          }}
                          className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground transition-colors hover:text-destructive"
                        >
                          <MessageSquareX className="h-3.5 w-3.5" />
                          {t("pipeline.disagree")}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
