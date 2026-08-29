"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Sparkles, ArrowRight } from "lucide-react";
import { getAllLocalAnalyses } from "@/lib/analysis/local-map";
import type { AnalysisResult } from "@/lib/analysis/types";

/**
 * 同构惊喜提示（B）：本次骨架若与地图里其他分析同名（同一副骨架），
 * 弹一条"这件事和你之前挖的 XX 是同一副骨架"提示，可点跳转。
 * 纯读本地分析集合，不触碰分析流程，无请求。
 */
export function IsomorphHint({ result }: { result: AnalysisResult }) {
  const { t } = useTranslation();
  const router = useRouter();

  const match = useMemo(() => {
    const name = result.skeleton?.name?.trim();
    if (!name) return null;
    const others = getAllLocalAnalyses().filter(
      (a) => a.id !== result.id && a.skeleton?.name?.trim() === name,
    );
    if (others.length === 0) return null;
    // 取最近一条同构分析
    const latest = others.sort((a, b) =>
      (b.createdAt ?? "").localeCompare(a.createdAt ?? ""),
    )[0];
    return { name, count: others.length, target: latest };
  }, [result]);

  if (!match) return null;

  return (
    <button
      type="button"
      onClick={() => router.push(`/analysis/${match.target.id}`)}
      data-el="isomorph-hint"
      className="group flex w-full items-start gap-3 rounded-2xl border border-secondary/40 bg-secondary/[0.06] p-3.5 text-left transition-colors hover:border-secondary/70"
    >
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-secondary/15 text-secondary">
        <Sparkles className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-foreground">
          {t("isomorph.title", { name: match.name, defaultValue: `又是「${match.name}」这副骨架` })}
        </span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
          {t("isomorph.body", {
            title: match.target.verdict || match.target.input,
            defaultValue: `你之前挖的「${match.target.verdict || match.target.input}」是同一副底层结构——点开看看是不是一个套路。`,
          })}
        </span>
      </span>
      <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-secondary transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}
