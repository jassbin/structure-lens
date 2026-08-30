"use client";

import { useTranslation } from "react-i18next";
import { Target, TrendingUp, Zap, GitBranch } from "lucide-react";
import { ConfidenceBar } from "@/components/shared/confidence-bar";
import { DrillPoint } from "@/components/analysis/drill-point";
import { GradeBadge } from "@/components/analysis/pipeline/grade-badge";
import { cn } from "@/utils/utils";
import { BEDROCK_LABELS } from "@/lib/analysis/types";
import type { PipelineStep } from "@/lib/analysis/types";

function LeverageDots({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`leverage ${n}`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            i <= n ? "bg-primary" : "bg-border",
          )}
        />
      ))}
    </span>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-sm">
      <dt className="w-16 shrink-0 font-bold text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 leading-relaxed text-foreground">{value}</dd>
    </div>
  );
}

/** 渲染单个流水线步骤的正文（不含头部/干预入口） */
export function StepBody({
  step,
  verdict,
}: {
  step: PipelineStep;
  verdict: string;
}) {
  const { t } = useTranslation();

  switch (step.kind) {
    case "materials":
      return (
        <div className="space-y-2">
          <ul className="space-y-1.5">
            {step.materials.map((m, i) => (
              <li key={i} className="flex items-start gap-2 text-sm leading-relaxed">
                <GradeBadge grade={m.grade} className="mt-0.5" />
                <span className="min-w-0 flex-1 text-foreground">
                  {m.url ? (
                    <a
                      href={m.url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline decoration-dotted underline-offset-2 hover:text-primary"
                    >
                      {m.fact}
                    </a>
                  ) : (
                    m.fact
                  )}
                </span>
              </li>
            ))}
          </ul>
          {step.note && (
            <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              {step.note}
            </p>
          )}
        </div>
      );

    case "anomaly":
      return (
        <div className="space-y-2.5">
          {step.baseline && (
            <p className="text-sm leading-relaxed text-foreground">
              <span className="font-bold text-muted-foreground">
                {t("pipeline.anomaly.baseline")}：
              </span>
              {step.baseline}
            </p>
          )}
          <ul className="space-y-1.5">
            {step.candidates.map((c) => {
              const selected = c.id === step.selectedId;
              return (
                <li
                  key={c.id}
                  className={cn(
                    "rounded-xl border px-3 py-2",
                    selected
                      ? "border-primary/60 bg-primary/[0.06]"
                      : "border-border bg-card",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-black text-primary">
                        {c.id}
                      </span>
                      {selected && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/12 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                          <Target className="h-2.5 w-2.5" />
                          {t("pipeline.anomaly.entry")}
                        </span>
                      )}
                    </div>
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
                      {t("pipeline.anomaly.leverage")}
                      <LeverageDots n={c.leverage} />
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-foreground">
                    {c.content}
                  </p>
                </li>
              );
            })}
          </ul>
          {step.reason && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              <span className="font-bold">{t("pipeline.anomaly.why")}：</span>
              {step.reason}
            </p>
          )}
        </div>
      );

    case "skeleton": {
      const s = step.skeleton;
      return (
        <div className="space-y-2.5">
          <p className="rounded-lg bg-secondary/[0.06] px-3 py-2 text-sm font-bold leading-snug text-secondary">
            {s.naming}
          </p>
          <dl className="space-y-1.5">
            <Field label={t("pipeline.skeleton.subject")} value={s.subject} />
            <Field label={t("pipeline.skeleton.object")} value={s.object} />
            <Field label={t("pipeline.skeleton.mechanism")} value={s.mechanism} />
            <Field label={t("pipeline.skeleton.harmed")} value={s.harmed} />
            <Field label={t("pipeline.skeleton.benefited")} value={s.benefited} />
          </dl>
        </div>
      );
    }

    case "mechanism": {
      const m = step.mechanism;
      return (
        <div className="space-y-2.5">
          {m.anchorAnomaly && (
            <p className="flex items-start gap-1.5 rounded-lg bg-muted/60 px-3 py-2 text-[13px] leading-relaxed text-foreground">
              <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <span>
                <span className="font-bold">{t("pipeline.mechanism.anchor")}：</span>
                {m.anchorAnomaly}
              </span>
            </p>
          )}

          {/* 逐层下钻 */}
          <ol className="relative space-y-2 pl-4">
            <span
              className="absolute left-[7px] top-1 bottom-6 w-px bg-gradient-to-b from-primary/50 to-secondary/60"
              aria-hidden
            />
            {m.layers.map((l, i) => (
              <li key={i} className="relative min-w-0" style={{ marginLeft: Math.min(i, 3) * 8 }}>
                <span className="absolute -left-4 top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-primary/60 bg-background text-[9px] font-black text-primary">
                  {i + 1}
                </span>
                <div className="rounded-lg border border-border/70 bg-card/60 px-3 py-2">
                  {l.ask && (
                    <p className="text-[11px] font-bold text-muted-foreground">
                      ↳ {l.ask}
                    </p>
                  )}
                  <DrillPoint
                    verdict={verdict}
                    layerTitle={step.title}
                    point={l.finding}
                  />
                  {l.breakthrough && (
                    <p className="mt-1.5 flex items-start gap-1.5 rounded-md bg-secondary/10 px-2 py-1 text-[12px] font-semibold leading-snug text-secondary">
                      <Zap className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                      <span>{l.breakthrough}</span>
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>

          {/* 见底基岩 */}
          <div className="rounded-lg border border-secondary/50 bg-secondary/[0.08] px-3 py-2">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-secondary">
              {t("pipeline.mechanism.bedrock")}
              <span className="rounded-full border border-secondary/50 px-1.5 py-0.5 text-[10px]">
                {BEDROCK_LABELS[m.bedrockKind].zh}
              </span>
            </p>
            <p className="mt-1 text-sm font-bold leading-snug text-foreground">
              {m.bedrock}
            </p>
          </div>

          {m.sideAnomalies && m.sideAnomalies.length > 0 && (
            <div className="rounded-lg border border-dashed border-accent/50 bg-accent/[0.06] px-3 py-2">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                <GitBranch className="h-3.5 w-3.5 text-accent" aria-hidden />
                {t("pipeline.mechanism.sideAnomalies")}
              </p>
              <ul className="mt-1.5 space-y-1.5">
                {m.sideAnomalies.map((s, i) => (
                  <li key={i} className="text-[13px] leading-relaxed">
                    <span className="font-semibold text-foreground">{s.anomaly}</span>
                    {s.whyDig && (
                      <span className="text-muted-foreground">　—　{s.whyDig}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {m.interestFlow.length > 0 && (
            <div className="rounded-lg bg-muted/60 px-3 py-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                {t("pipeline.mechanism.flow")}
              </p>
              <ul className="mt-1 space-y-0.5">
                {m.interestFlow.map((f, i) => (
                  <li key={i} className="text-[13px] leading-relaxed text-foreground">
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="rounded-lg border border-primary/30 bg-primary/[0.05] px-3 py-2 text-sm font-bold leading-snug text-primary">
            {t("pipeline.mechanism.renaming")}：{m.renaming}
          </p>
        </div>
      );
    }

    case "game": {
      const g = step.game;
      return (
        <div className="space-y-2.5">
          <p className="text-sm leading-relaxed text-foreground">{g.gameSummary}</p>
          {g.analogs.length > 0 && (
            <div className="space-y-1.5">
              {g.analogs.map((a, i) => (
                <div key={i} className="rounded-xl border border-border bg-card px-3 py-2">
                  <p className="text-sm font-bold text-foreground">{a.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {a.isomorphism}
                  </p>
                </div>
              ))}
            </div>
          )}
          <p className="rounded-lg bg-accent/15 px-3 py-2 text-sm leading-snug text-foreground">
            <span className="font-bold">{t("pipeline.game.variable")}：</span>
            {g.variableParameter}
          </p>
        </div>
      );
    }

    case "scenario":
      return (
        <div className="space-y-2.5">
          {step.variables.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {step.variables.map((v, i) => (
                <span
                  key={i}
                  className="rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-semibold text-muted-foreground"
                >
                  {v}
                </span>
              ))}
            </div>
          )}
          <div className="space-y-1.5">
            {step.branches.map((b, i) => (
              <div key={i} className="rounded-xl border border-border bg-card px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-foreground">{b.label}</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-black text-primary">
                    <TrendingUp className="h-3 w-3" />
                    {b.probability}%
                  </span>
                </div>
                <p className="mt-1 text-[13px] leading-relaxed text-foreground">
                  {b.narrative}
                </p>
                {b.warningSignals && (
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    <span className="font-bold">{t("pipeline.scenario.signal")}：</span>
                    {b.warningSignals}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      );

    case "judgment":
      return (
        <div className="space-y-2.5">
          {step.judgments.map((j, i) => (
            <div key={i} className="rounded-xl border border-border bg-card px-3 py-2.5">
              <p className="text-sm font-bold leading-snug text-foreground">
                {j.claim}
              </p>
              <ConfidenceBar
                className="mt-2"
                value={j.confidence}
                label={t("analysis.confidence")}
              />
              <div className="mt-2 rounded-lg border border-destructive/25 bg-destructive/[0.04] px-2.5 py-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wide text-destructive">
                  {t("pipeline.judgment.falsifiable")}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-foreground">
                  {j.falsifiable}
                </p>
              </div>
            </div>
          ))}
        </div>
      );

    case "adversarial": {
      const c = step.check;
      return (
        <div className="space-y-2.5">
          {c.devilsAdvocate.map((d, i) => (
            <div key={i} className="rounded-xl border border-border bg-card px-3 py-2">
              <p className="text-sm leading-relaxed text-foreground">
                <span className="font-bold text-destructive">
                  {t("pipeline.adversarial.challenge")}：
                </span>
                {d.challenge}
              </p>
              {d.response ? (
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                  <span className="font-bold text-secondary">
                    {t("pipeline.adversarial.response")}：
                  </span>
                  {d.response}
                </p>
              ) : (
                <p className="mt-1 text-[13px] leading-relaxed text-destructive/80">
                  ⚠️ {t("pipeline.adversarial.responseMissing")}
                </p>
              )}
            </div>
          ))}
          {c.metacognition.length > 0 && (
            <div className="rounded-lg bg-muted/60 px-3 py-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                {t("pipeline.adversarial.meta")}
              </p>
              <ul className="mt-1 space-y-1">
                {c.metacognition.map((m, i) => (
                  <li key={i} className="text-[13px] leading-relaxed text-foreground">
                    <span className="font-bold">{m.bias}</span>
                    {m.check ? ` — ${m.check}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    }

    default:
      return null;
  }
}
