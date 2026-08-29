"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Share2, Loader2, Copy, Check } from "lucide-react";
import { createShare } from "@/lib/api/analysis";
import { ShareCard } from "@/components/share/share-card";
import type { AnalysisResult } from "@/lib/analysis/types";

/**
 * 生成私密只读分享卡：手动触发、只分享本次骨架卡+金句，
 * 短链只读快照，不带用户地图/其他分析。
 */
export function ShareButton({ result }: { result: AnalysisResult }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    if (loading) return;
    setLoading(true);
    try {
      const code = await createShare({
        input: result.input,
        verdict: result.verdict,
        skeleton: result.skeleton,
      });
      const link = `${window.location.origin}/s/${code}`;
      setUrl(link);
      // 直接尝试复制，方便立即分享
      try {
        await navigator.clipboard.writeText(link);
        setCopied(true);
      } catch {
        /* 复制失败不阻断，用户可手动复制 */
      }
    } catch {
      toast.error(t("share.failed", "生成分享链接失败，请重试"));
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success(t("share.copied", "链接已复制"));
    } catch {
      toast.error(t("share.copyFailed", "复制失败，请手动复制"));
    }
  }

  return (
    <div className="flex flex-col gap-3" data-el="share-block">
      {!url ? (
        <button
          type="button"
          onClick={generate}
          disabled={loading}
          data-el="share-generate"
          className="inline-flex h-11 items-center justify-center gap-1.5 rounded-2xl border border-border bg-card text-sm font-bold text-foreground shadow-sm transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Share2 className="h-4 w-4" />
          )}
          {t("share.generate", "生成分享卡")}
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          <ShareCard
            verdict={result.verdict}
            skeleton={result.skeleton}
            input={result.input}
          />
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-2 pl-3">
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
              {url}
            </span>
            <button
              type="button"
              onClick={copy}
              className="inline-flex h-8 shrink-0 items-center gap-1 rounded-xl bg-primary px-3 text-xs font-bold text-primary-foreground"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? t("share.copied", "已复制") : t("share.copy", "复制")}
            </button>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {t(
              "share.privacyNote",
              "只读链接，仅包含这一条的骨架卡，不会暴露你的其他分析或结构地图。",
            )}
          </p>
        </div>
      )}
    </div>
  );
}
