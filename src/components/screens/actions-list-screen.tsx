"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Sprout, ArrowRight, Sparkles } from "lucide-react";
import { getAllLocalActionPlans } from "@/lib/analysis/action-store";
import { getLocalAnalysis } from "@/lib/analysis/local-map";
import { listSavedActionPlans, type ActionPlanSummary } from "@/lib/api/analysis";

/**
 * 「解忧果」浏览入口：列出已保存的清醒行动主义方案。
 * 数据来源与全局策略一致：本地（免登录）+ 云端（登录），按 id 去重合并。
 */
export function ActionsListScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [items, setItems] = useState<ActionPlanSummary[] | null>(null);

  useEffect(() => {
    let alive = true;
    // 本地：方案只存了 headline，标题从本地分析补齐
    const local: ActionPlanSummary[] = getAllLocalActionPlans().map((p) => {
      const a = getLocalAnalysis(p.id);
      return {
        id: p.id,
        input: a?.input ?? "",
        verdict: a?.verdict ?? p.headline,
        headline: p.headline,
        createdAt: a?.createdAt,
      };
    });
    listSavedActionPlans()
      .then((cloud) => {
        if (!alive) return;
        const byId = new Map<string, ActionPlanSummary>();
        for (const it of [...local, ...cloud]) byId.set(it.id, it);
        const merged = Array.from(byId.values()).sort((a, b) =>
          (b.createdAt ?? "").localeCompare(a.createdAt ?? ""),
        );
        setItems(merged);
      })
      .catch(() => alive && setItems(local));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-6">
      <header className="flex items-center gap-2.5">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary/15">
          <Sprout className="h-5 w-5 text-secondary" aria-hidden />
        </span>
        <div>
          <h1 className="font-heading text-xl font-black text-foreground">
            {t("actions.title", "解忧果")}
          </h1>
          <p className="text-xs text-muted-foreground">
            {t("actions.subtitle", "看清之后，你攒下的每一份清醒行动方案")}
          </p>
        </div>
      </header>

      {items === null && (
        <div className="space-y-3 pt-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      )}

      {items !== null && items.length === 0 && (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border bg-card/60 px-6 py-14 text-center">
          <Sprout className="h-8 w-8 text-muted-foreground/50" aria-hidden />
          <p className="text-sm font-semibold text-foreground">
            {t("actions.emptyTitle", "还没有攒下解忧果")}
          </p>
          <p className="max-w-[240px] text-xs leading-relaxed text-muted-foreground">
            {t("actions.emptyHint", "分析一件事，在报告底部点「看清了，然后呢？」，生成的行动方案会存到这里")}
          </p>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="mt-1 inline-flex h-9 items-center gap-1 rounded-xl bg-secondary px-4 text-sm font-bold text-secondary-foreground"
          >
            {t("actions.goAnalyze", "去分析一件事")}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {items !== null && items.length > 0 && (
        <ul className="flex flex-col gap-3">
          {items.map((it) => (
            <li key={it.id}>
              <button
                type="button"
                onClick={() => router.push(`/action/${it.id}`)}
                data-el="action-list-item"
                className="group flex w-full items-start gap-3 rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-all hover:border-secondary/50 hover:shadow-md"
              >
                <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-secondary/12">
                  <Sparkles className="h-4 w-4 text-secondary" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  {it.verdict && (
                    <p className="line-clamp-2 font-heading text-sm font-extrabold leading-snug text-foreground">
                      {it.verdict}
                    </p>
                  )}
                  {it.headline && (
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {it.headline}
                    </p>
                  )}
                </div>
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-secondary transition-transform group-hover:translate-x-0.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
