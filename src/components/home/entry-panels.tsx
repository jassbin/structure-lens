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
