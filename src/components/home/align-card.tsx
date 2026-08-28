"use client";

import { useTranslation } from "react-i18next";
import { Check, Pencil, Loader2, ExternalLink, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { AlignResult } from "@/lib/analysis/types";

/**
 * 事实对齐确认卡：展示搜索到的事件概要 + 来源，用户可确认或修正后再分析。
 * needsManual = 联网没搜到，引导用户手动粘贴概要/链接后再分析。
 */
export function AlignCard({
  align,
  edited,
  onEdit,
  onConfirm,
  busy,
}: {
  align: AlignResult;
  edited: string;
  onEdit: (v: string) => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const manual = align.needsManual === true;
  return (
    <div
      className="flex flex-col gap-3 rounded-2xl border border-primary/30 bg-card p-4 shadow-sm"
      data-el="align-card"
    >
      <div className="flex items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-primary">
          {manual ? <SearchX className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
        </span>
        <h3 className="text-sm font-bold text-foreground">
          {manual
            ? t("align.manualTitle", "没搜到实时资料，请手动对齐")
            : t("align.title", "先对齐事实，再穿透")}
        </h3>
      </div>

      {manual ? (
        <p className="rounded-lg bg-accent/15 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          {t(
            "align.manualHint",
            "这件事可能太新、太小众，联网没检索到可靠资料。请把你知道的事件经过、或一段新闻摘要/链接粘到下面，我据此对齐后再深度分析。",
          )}
        </p>
      ) : (
        !align.confident && (
          <p className="rounded-lg bg-accent/15 px-3 py-2 text-xs text-muted-foreground">
            {t("align.uncertain", "我不太确定说的是同一件事，请核对或补充下面的概要。")}
          </p>
        )
      )}

      <Textarea
        value={edited}
        onChange={(e) => onEdit(e.target.value)}
        rows={manual ? 6 : 5}
        placeholder={
          manual
            ? t("align.manualPlaceholder", "粘贴事件经过、新闻摘要或链接…")
            : undefined
        }
        className="resize-none rounded-xl border-border bg-background text-[14px] leading-relaxed"
        data-el="align-summary"
      />

      {align.sources.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("align.sources", "来源")}
          </span>
          {align.sources.slice(0, 4).map((s, i) => (
            <a
              key={i}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 truncate text-xs text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3 shrink-0" />
              <span className="truncate">{s.title}</span>
            </a>
          ))}
        </div>
      )}

      {align.questions.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
          {align.questions.map((q, i) => (
            <li key={i}>{q}</li>
          ))}
        </ul>
      )}

      <Button
        onClick={onConfirm}
        disabled={busy || !edited.trim()}
        className="h-11 rounded-xl bg-[#0C5FFD] text-sm font-bold text-white shadow-[0_8px_20px_rgba(12,95,253,0.4)] hover:bg-[#0048F0] disabled:opacity-60"
        data-el="align-confirm"
      >
        {busy ? (
          <>
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            {t("home.analyzing", "穿透中…")}
          </>
        ) : (
          <>
            <Pencil className="mr-1 h-4 w-4" />
            {manual
              ? t("align.manualConfirm", "用我填的内容开始穿透")
              : t("align.confirm", "就按这个概要，开始穿透")}
          </>
        )}
      </Button>
    </div>
  );
}
