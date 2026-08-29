"use client";

import { useEffect, useState } from "react";
import { Compass, Radar, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * 游走全屏遮罩：点击"继续游走"后始终显示，明确告诉用户"正在联网锁定+深挖中"，
 * 避免误以为死机。两阶段文案（锁定事件 / 深度穿透）随进度切换。
 */
export function WalkOverlay({
  open,
  phase,
  lockedTitle,
}: {
  open: boolean;
  /** "focus" 联网锁定最火事件 / "analyze" 深度穿透 */
  phase: "focus" | "analyze";
  /** 已锁定的具体事件标题（进入 analyze 阶段后展示） */
  lockedTitle?: string;
}) {
  const { t } = useTranslation();
  const [dots, setDots] = useState("");

  useEffect(() => {
    if (!open) return;
    const timer = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "" : d + "·"));
    }, 450);
    return () => clearInterval(timer);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-background/92 backdrop-blur-sm">
      {/* 旋转雷达环 */}
      <div className="relative mb-6 flex h-20 w-20 items-center justify-center">
        <div className="absolute inset-0 animate-ping rounded-full border border-primary/30" />
        <div className="absolute inset-2 animate-[spin_2.4s_linear_infinite] rounded-full border border-dashed border-primary/50" />
        {phase === "focus" ? (
          <Radar className="h-8 w-8 animate-pulse text-primary" />
        ) : (
          <Compass className="h-8 w-8 animate-pulse text-primary" />
        )}
      </div>

      <div className="flex items-center gap-2 text-base font-semibold text-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        {phase === "focus"
          ? t("walk.focusing", "正在联网锁定最火的同构事件")
          : t("walk.analyzing", "正在深度穿透这件事")}
        <span className="w-4 text-left text-primary">{dots}</span>
      </div>

      <p className="mt-2 max-w-[280px] px-6 text-center text-xs leading-relaxed text-muted-foreground">
        {phase === "focus"
          ? t(
              "walk.focusHint",
              "在这个结构方向下筛选当前最火、最典型的真实事件，请稍候，别关页面",
            )
          : lockedTitle
            ? t("walk.analyzeLocked", { title: lockedTitle, defaultValue: `已锁定「${lockedTitle}」，正在跑完整 8 步穿透` })
            : t("walk.analyzeHint", "正在跑完整 8 步穿透，通常需要几秒")}
      </p>
    </div>
  );
}
