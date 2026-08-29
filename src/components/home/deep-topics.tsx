"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, Landmark, Briefcase, ScrollText } from "lucide-react";
import { cn } from "@/utils/utils";
import { DEEP_TOPICS } from "@/lib/analysis/topics";

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

/** 每次展示的推荐条数（方案 A：从候选池随机轮换，保持新鲜） */
const VISIBLE_COUNT = 4;

/** Fisher–Yates 洗牌，返回打乱后的新数组 */
function shuffle<T>(list: T[]): T[] {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** 首屏深度题库卡片列表 */
export function DeepTopics({
  disabled,
  onPick,
}: {
  disabled: boolean;
  onPick: (prompt: string) => void;
}) {
  const { t } = useTranslation();
  // 首帧用确定顺序（SSR 与 CSR 一致，避免 hydration 不匹配）；
  // 挂载后再随机洗牌轮换（方案 A：每次打开都新鲜）。
  const [topics, setTopics] = useState(() => DEEP_TOPICS.slice(0, VISIBLE_COUNT));

  useEffect(() => {
    // 挂载后下一帧再洗牌轮换：首帧与 SSR 一致（无 hydration 不匹配），
    // 用 rAF 推迟到 effect 之外，避免 set-state-in-effect 级联渲染告警。
    const raf = requestAnimationFrame(() => {
      setTopics(shuffle(DEEP_TOPICS).slice(0, VISIBLE_COUNT));
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="flex flex-col gap-3" data-el="deep-topics">
      <p className="text-sm font-bold text-muted-foreground">{t("home.topicsTitle")}</p>
      <div className="grid grid-cols-1 gap-2.5">
        {topics.map((topic) => {
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
              <span className="flex shrink-0 flex-col items-center gap-1">
                <span
                  className={cn(
                    "grid h-10 w-10 place-items-center rounded-xl",
                    CATEGORY_ICON_BG[topic.category],
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="text-[10px] font-medium tracking-wide text-muted-foreground/70">
                  {t(`home.category.${topic.category}`)}
                </span>
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-bold leading-snug text-foreground">
                  {topic.title}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
