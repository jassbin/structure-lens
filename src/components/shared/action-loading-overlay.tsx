"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, Compass, Target, HeartPulse } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * 「看清了，然后呢？」→ 行动页过渡遮罩。
 * 与 AnalyzingOverlay 一致的观感（进度条 + 阶段文案 + 计时），但薄荷绿主题，
 * 呼应「清醒行动主义」。命中已存方案时 loading 极短、遮罩一闪即走。
 */
const STAGE_ICONS = [Compass, Target, HeartPulse] as const;
const STAGE_STARTS = [0, 4, 9];
const EXPECTED_SECONDS = 14;

export function ActionLoadingOverlay({ open }: { open: boolean }) {
  const { t } = useTranslation();
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(0);

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

  const stages = [
    t("action.loading.stage.read", "读懂你此刻卡在哪"),
    t("action.loading.stage.triage", "把能动的和不能动的分开"),
    t("action.loading.stage.act", "给出今天就能做的一步"),
  ];

  return (
    <div className="fixed inset-0 z-[90] flex flex-col items-center justify-center bg-secondary/[0.96] px-8 text-secondary-foreground backdrop-blur-md">
      <div className="relative mb-7 flex h-24 w-24 items-center justify-center">
        <div className="absolute inset-0 animate-ping rounded-full border border-white/25" />
        <div className="absolute inset-1 animate-[spin_2.6s_linear_infinite] rounded-full border border-dashed border-white/45" />
        <StageIcon className="h-9 w-9 animate-pulse text-white" aria-hidden />
      </div>

      <div className="text-center">
        <p className="flex items-center justify-center gap-1.5 font-heading text-lg font-black">
          <Sparkles className="h-4 w-4" aria-hidden />
          {stages[stageIndex]}
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-secondary-foreground/85">
          {t("action.loading.expect", "正在生成你的清醒行动方案，通常需要 8~15 秒，好好等一下")}
        </p>
      </div>

      <div className="mt-6 w-full max-w-[300px]">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/25">
          <div
            className="h-full rounded-full bg-white transition-[width] duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] font-medium text-secondary-foreground/80">
          <span>{t("analyzing.elapsed", { s: Math.floor(elapsed), defaultValue: `已用 ${Math.floor(elapsed)} 秒` })}</span>
          <span>{Math.floor(progress)}%</span>
        </div>
      </div>
    </div>
  );
}
