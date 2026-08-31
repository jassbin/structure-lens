"use client";

import { useEffect, useRef, useState } from "react";
import { Compass, Split, Rocket, HeartPulse, CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * 「看清了，然后呢？」→ 行动页过渡遮罩。
 * 版式与 AnalyzingOverlay（开始分析遮罩）完全对齐：浅背景 + 深色文字 + 旋转环 +
 * 标题/预期/进度条/阶段清单，字体、位置、高度、间距一致；仅主色换成 secondary（薄荷绿）、
 * 图标换成「清醒行动主义」语义。命中已存方案时 loading 极短、遮罩一闪即走。
 */

const STAGE_ICONS = [Compass, Split, Rocket, HeartPulse] as const;
const STAGE_STARTS = [0, 3, 7, 11];
const EXPECTED_SECONDS = 14;

export function ActionLoadingOverlay({ open }: { open: boolean }) {
  const { t } = useTranslation();
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number>(0);

  useEffect(() => {
    if (!open) return;
    startRef.current = Date.now();
    const timer = setInterval(() => {
      setElapsed((Date.now() - startRef.current) / 1000);
    }, 200);
    return () => clearInterval(timer);
  }, [open]);

  if (!open) return null;

  const progress = Math.min(92, (1 - Math.exp(-elapsed / (EXPECTED_SECONDS / 2.5))) * 100);
  const stageIndex = Math.min(
    STAGE_STARTS.length - 1,
    STAGE_STARTS.filter((s) => elapsed >= s).length - 1,
  );
  const StageIcon = STAGE_ICONS[stageIndex] ?? Compass;

  const stageLabels = [
    t("action.loading.stage.read", "读懂你此刻卡在哪"),
    t("action.loading.stage.triage", "把能动的和不能动的分开"),
    t("action.loading.stage.act", "给出今天就能做的一步"),
    t("action.loading.stage.settle", "留一句不自欺的收尾"),
  ];

  return (
    <div className="fixed inset-0 z-[90] flex flex-col items-center justify-center bg-background/94 px-8 backdrop-blur-md">
      {/* 旋转环（与分析页同尺寸/间距，主色换 secondary） */}
      <div className="relative mb-7 flex h-24 w-24 items-center justify-center">
        <div className="absolute inset-0 animate-ping rounded-full border border-secondary/25" />
        <div className="absolute inset-1 animate-[spin_2.6s_linear_infinite] rounded-full border border-dashed border-secondary/50" />
        <StageIcon className="h-9 w-9 animate-pulse text-secondary" aria-hidden />
      </div>

      <div className="text-center">
        <p className="font-heading text-lg font-black text-foreground">
          {stageLabels[stageIndex]}
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          {t("action.loading.expect", "正在生成你的清醒行动方案，通常需要 8~15 秒，好好等一下")}
        </p>
      </div>

      {/* 进度条 */}
      <div className="mt-6 w-full max-w-[300px]">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-secondary transition-[width] duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] font-medium text-muted-foreground">
          <span>{t("analyzing.elapsed", { s: Math.floor(elapsed), defaultValue: `已用 ${Math.floor(elapsed)} 秒` })}</span>
          <span>{Math.floor(progress)}%</span>
        </div>
      </div>

      {/* 阶段清单 */}
      <ul className="mt-6 w-full max-w-[300px] space-y-2">
        {stageLabels.map((label, i) => {
          const done = i < stageIndex;
          const active = i === stageIndex;
          return (
            <li
              key={label}
              className={`flex items-center gap-2 text-xs transition-colors ${
                active ? "font-bold text-foreground" : done ? "text-muted-foreground" : "text-muted-foreground/45"
              }`}
            >
              {done ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-secondary" />
              ) : (
                <span
                  className={`h-3.5 w-3.5 shrink-0 rounded-full border ${
                    active ? "animate-pulse border-secondary bg-secondary/20" : "border-muted-foreground/30"
                  }`}
                />
              )}
              {label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
