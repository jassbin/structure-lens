"use client";

import { useTranslation } from "react-i18next";
import { ArrowRight, Landmark, Briefcase, ScrollText } from "lucide-react";
import { cn } from "@/utils/utils";
import { DEEP_TOPICS } from "@/lib/analysis/topics";

const CATEGORY_COLOR: Record<string, string> = {
  policy: "text-primary",
  business: "text-secondary",
  history: "text-[#5647d6]",
};

const CATEGORY_ICON = {
  policy: Landmark,
  business: Briefcase,
  history: ScrollText,
} as const;

const CATEGORY_ICON_BG: Record<string, string> = {
  policy: "bg-primary/10 text-primary",
  business: "bg-secondary/10 text-secondary",
  history: "bg-[#6b5cff]/10 text-[#5647d6]",
};

/** 首屏深度题库卡片列表 */
export function DeepTopics({
  disabled,
  onPick,
}: {
  disabled: boolean;
  onPick: (prompt: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3" data-el="deep-topics">
      <p className="text-sm font-bold text-muted-foreground">{t("home.topicsTitle")}</p>
      <div className="grid grid-cols-1 gap-2.5">
        {DEEP_TOPICS.map((topic) => {
          const Icon = CATEGORY_ICON[topic.category];
          return (
            <button
              key={topic.id}
              type="button"
              disabled={disabled}
              onClick={() => onPick(topic.prompt)}
              data-el="topic-card"
              className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 text-left shadow-sm transition-all hover:border-primary/40 hover:shadow-md disabled:opacity-60"
            >
              <span
                className={cn(
                  "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
                  CATEGORY_ICON_BG[topic.category],
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-bold leading-snug text-foreground">
                  {topic.title}
                </p>
                <span
                  className={cn(
                    "mt-1 inline-block text-[10px] font-medium tracking-wide text-muted-foreground/70",
                  )}
                >
                  {t(`home.category.${topic.category}`)}
                </span>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
