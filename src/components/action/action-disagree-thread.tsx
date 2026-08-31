"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, MessageSquareX, Send, User, Bot } from "lucide-react";
import type { ActionDebateTurn } from "@/lib/analysis/action";
import { cn } from "@/utils/utils";

const STANCE_STYLE: Record<ActionDebateTurn["stance"], string> = {
  absorb: "border-secondary/40 bg-secondary/10 text-secondary",
  compromise: "border-primary/40 bg-primary/10 text-primary",
  hold: "border-amber-400/50 bg-amber-50/60 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400",
};

/**
 * 行动页某一节的「我不同意/追问」线程（逻辑同分析页 DisagreeThread，薄荷绿主题）：
 * 展示历轮留痕（用户反驳 → AI 表态徽章 + 回答/理由），并允许继续追问。
 */
export function ActionDisagreeThread({
  debate,
  busy,
  onSubmit,
}: {
  debate?: ActionDebateTurn[];
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
    <div className="mt-3 border-t border-border/60 pt-2.5" data-el="action-disagree-thread">
      {hasHistory && (
        <ul className="mb-2.5 space-y-2">
          {turns.map((turn, i) => (
            <li key={i} className="space-y-1.5" data-el="action-debate-turn">
              <p className="flex items-start gap-1.5 rounded-xl bg-muted/60 px-2.5 py-1.5 text-[13px] leading-relaxed text-foreground">
                <User className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span>{turn.objection}</span>
              </p>
              <div className="rounded-xl border border-border bg-card px-2.5 py-1.5">
                <span className="flex items-center gap-1.5">
                  <Bot className="h-3.5 w-3.5 shrink-0 text-secondary" />
                  <span
                    className={cn(
                      "rounded-full border px-1.5 py-0.5 text-[10px] font-bold leading-none",
                      STANCE_STYLE[turn.stance],
                    )}
                  >
                    {t(`action.stance.${turn.stance}`)}
                  </span>
                </span>
                {turn.answer ? (
                  <>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-foreground">
                      {turn.answer}
                    </p>
                    <p className="mt-1.5 border-t border-border/50 pt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                      <span className="font-semibold">
                        {t("action.debate.verdictNote", "裁定说明")}：
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

      {composing ? (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-muted-foreground">
            {t("action.debate.hint", "反驳这一步的判断，或追问它为什么——有理，后续步骤会随之调整")}
          </p>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            autoFocus
            placeholder={t("action.debate.placeholder", "写下你的反驳或追问…")}
            className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-secondary/60"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!draft.trim() || busy}
              onClick={submit}
              className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-xs font-bold text-secondary-foreground disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              {t("action.debate.submit", "提交")}
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
              {t("action.debate.thinking", "正在回应…")}
            </p>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setComposing(true)}
          className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground transition-colors hover:text-secondary"
        >
          <MessageSquareX className="h-3.5 w-3.5" />
          {hasHistory
            ? t("action.debate.keep", "继续追问")
            : t("action.debate.start", "我不同意 / 追问这一节")}
        </button>
      )}
    </div>
  );
}
