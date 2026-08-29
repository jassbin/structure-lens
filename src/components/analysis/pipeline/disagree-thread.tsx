"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, MessageSquareX, Send, User, Bot } from "lucide-react";
import { STANCE_LABELS } from "@/lib/analysis/types";
import type { DebateStance, DebateTurn } from "@/lib/analysis/types";
import { cn } from "@/utils/utils";

const STANCE_STYLE: Record<DebateStance, string> = {
  absorb: "border-secondary/40 bg-secondary/10 text-secondary",
  compromise: "border-primary/40 bg-primary/10 text-primary",
  hold: "border-amber-400/50 bg-amber-50/60 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400",
};

/**
 * 一节下面的人机辩论：
 * - 展示历轮留痕（用户反对 → AI 表态徽章 + 理由）
 * - 允许用户继续反驳，多轮累积
 */
export function DisagreeThread({
  debate,
  busy,
  onSubmit,
}: {
  debate?: DebateTurn[];
  busy: boolean;
  onSubmit: (objection: string) => Promise<void> | void;
}) {
  const { t } = useTranslation();
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState("");
  const turns = debate ?? [];
  const hasHistory = turns.length > 0;

  async function submit() {
    const text = draft.trim();
    if (!text || busy) return;
    await onSubmit(text);
    setDraft("");
    setComposing(false);
  }

  return (
    <div className="mt-3 border-t border-border/60 pt-2.5" data-el="disagree-thread">
      {/* 辩论留痕 */}
      {hasHistory && (
        <ul className="mb-2.5 space-y-2">
          {turns.map((turn, i) => (
            <li key={i} className="space-y-1.5" data-el="debate-turn">
              <p className="flex items-start gap-1.5 rounded-xl bg-muted/60 px-2.5 py-1.5 text-[13px] leading-relaxed text-foreground">
                <User className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span>{turn.objection}</span>
              </p>
              <div className="rounded-xl border border-border bg-card px-2.5 py-1.5">
                <span className="flex items-center gap-1.5">
                  <Bot className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span
                    className={cn(
                      "rounded-full border px-1.5 py-0.5 text-[10px] font-bold leading-none",
                      STANCE_STYLE[turn.stance],
                    )}
                  >
                    {t(`pipeline.stance.${turn.stance}`, STANCE_LABELS[turn.stance].zh)}
                  </span>
                </span>
                {turn.answer ? (
                  <>
                    {/* 直接回答/解释——追问的答案在这里 */}
                    <p className="mt-1.5 text-[13px] leading-relaxed text-foreground">
                      {turn.answer}
                    </p>
                    {/* 裁定说明降级为小字附注 */}
                    <p className="mt-1.5 border-t border-border/50 pt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                      <span className="font-semibold">
                        {t("pipeline.verdictNote", "裁定说明")}：
                      </span>
                      {turn.reason}
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-[13px] leading-relaxed text-foreground">
                    {turn.reason}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* 输入区 */}
      {composing ? (
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
              onClick={submit}
              className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              {t("pipeline.submitObjection")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setComposing(false);
                setDraft("");
              }}
              className="text-xs font-semibold text-muted-foreground"
            >
              {t("common.cancel", "取消")}
            </button>
          </div>
          {busy && (
            <p className="text-[11px] text-muted-foreground">
              {t("pipeline.thinking")}
            </p>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setComposing(true)}
          className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground transition-colors hover:text-destructive"
        >
          <MessageSquareX className="h-3.5 w-3.5" />
          {hasHistory ? t("pipeline.keepRebutting") : t("pipeline.disagree")}
        </button>
      )}
    </div>
  );
}
