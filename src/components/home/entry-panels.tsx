"use client";

import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { TriageResult } from "@/lib/analysis/types";

/** 对话探井面板：输入太浅时反问，养成可挖事件 */
export function ProbePanel({
  probes,
  answer,
  onAnswer,
  onContinue,
  busy,
}: {
  probes: string[];
  answer: string;
  onAnswer: (v: string) => void;
  onContinue: () => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4" data-el="probe-panel">
      <p className="font-heading text-sm font-extrabold text-foreground">
        {t("home.probeTitle")}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{t("home.probeIntro")}</p>
      <ul className="mt-3 space-y-1.5">
        {probes.map((p, i) => (
          <li key={i} className="flex gap-2 text-sm text-foreground">
            <span className="font-bold text-primary">{i + 1}.</span>
            {p}
          </li>
        ))}
      </ul>
      <Textarea
        value={answer}
        onChange={(e) => onAnswer(e.target.value)}
        placeholder={t("home.probeAnswerPlaceholder")}
        rows={2}
        className="mt-3 resize-none rounded-xl border-border bg-card text-sm"
      />
      <Button
        onClick={onContinue}
        disabled={!answer.trim() || busy}
        className="mt-3 h-10 w-full rounded-xl font-bold"
        data-el="probe-continue"
      >
        {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
        {t("home.probeContinue")}
      </Button>
    </div>
  );
}

/** 不适合结构分析时的温和引导 */
export function NotApplicablePanel({
  suggestion,
  onReset,
}: {
  suggestion?: string;
  onReset: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="rounded-2xl border border-accent/50 bg-accent/10 p-4" data-el="not-applicable-panel">
      <p className="font-heading text-sm font-extrabold text-foreground">
        {t("home.notApplicableTitle")}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{suggestion}</p>
      <Button
        variant="outline"
        onClick={onReset}
        className="mt-3 h-9 rounded-xl font-semibold"
      >
        {t("home.notApplicableBack")}
      </Button>
    </div>
  );
}

export type { TriageResult };

/** 事实对齐卡：搜到资料后，先给中性概要+来源让用户确认/纠正，再进入分析 */
export function AlignCard({
  sources,
  edited,
  onEdit,
  onConfirm,
  onReject,
  busy,
}: {
  sources: { title: string; url: string }[];
  edited: string;
  onEdit: (v: string) => void;
  onConfirm: () => void;
  onReject: () => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div
      className="rounded-2xl border border-secondary/30 bg-secondary/[0.05] p-4"
      data-el="align-card"
    >
      <p className="font-heading text-sm font-extrabold text-foreground">
        {t("home.align.title")}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{t("home.align.intro")}</p>

      <Textarea
        value={edited}
        onChange={(e) => onEdit(e.target.value)}
        rows={5}
        className="mt-3 resize-none rounded-xl border-border bg-card text-sm leading-relaxed"
        data-el="align-summary"
      />

      {sources.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            {t("home.align.sources")}
          </p>
          <ul className="mt-1.5 space-y-1">
            {sources.map((s, i) => (
              <li key={i} className="truncate text-xs">
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline decoration-dotted underline-offset-2"
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <Button
          onClick={onConfirm}
          disabled={!edited.trim() || busy}
          className="h-10 flex-1 rounded-xl font-bold"
          data-el="align-confirm"
        >
          {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
          {t("home.align.confirm")}
        </Button>
        <Button
          variant="outline"
          onClick={onReject}
          disabled={busy}
          className="h-10 rounded-xl font-semibold"
          data-el="align-reject"
        >
          {t("home.align.reject")}
        </Button>
      </div>
    </div>
  );
}
