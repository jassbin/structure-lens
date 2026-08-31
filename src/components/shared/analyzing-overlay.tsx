"use client";

import { useEffect, useRef, useState } from "react";
import { Radar, Search, Layers, ScanLine, CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * 「开始穿透」全屏等待遮罩：纯前端进度反馈，不改任何分析/搜索逻辑。
 * 目标：给用户明确预期——这件事要花 10~20 秒，且能看到进度在推进，避免误以为卡死。
 *
 * 进度是「时间驱动的乐观动画」（并非真实后端进度），随预计时长平滑推进到 ~92%，
 * 请求真正返回后由父组件卸载本遮罩即可。分阶段文案按经过时间切换。
 */

const STAGE_ICONS = [Search, Radar, Layers, ScanLine] as const;
// 各阶段大致起始秒数（仅用于文案切换的观感，不代表后端真实耗时）
const STAGE_STARTS = [0, 3, 7, 13];
/** 进度条预计爬满到 92% 所需秒数（留 8% 给真实返回时的收尾） */
const EXPECTED_SECONDS = 18;

export function AnalyzingOverlay({ open }: { open: boolean }) {
  const { t } = useTranslation();
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number>(0);

  useEffect(() => {
    if (!open) return;
    startRef.current = Date.now();
    setElapsed(0);
    const timer = setInterval(() => {
      setElapsed((Date.now() - startRef.current) / 1000);
    }, 200);
    return () => clearInterval(timer);
  }, [open]);

  if (!open) return null;

  // 乐观进度：平滑逼近 92%，越到后面越慢，绝不到 100%（留给真实返回）
  const progress = Math.min(92, (1 - Math.exp(-elapsed / (EXPECTED_SECONDS / 2.5))) * 100);
  const stageIndex = Math.min(
    STAGE_STARTS.length - 1,
    STAGE_STARTS.filter((s) => elapsed >= s).length - 1,
  );
  const StageIcon = STAGE_ICONS[stageIndex] ?? Radar;

  const stageLabels = [
    t("analyzing.stage.search", "联网核对事实原料"),
    t("analyzing.stage.structure", "还原底层结构骨架"),
    t("analyzing.stage.deep", "逐层跑 8 步深度穿透"),
    t("analyzing.stage.compose", "整理反转与行动线索"),
  ];

  return (
    <div className="fixed inset-0 z-[90] flex flex-col items-center justify-center bg-background/94 px-8 backdrop-blur-md">
      {/* 旋转雷达环 */}
      <div className="relative mb-7 flex h-24 w-24 items-center justify-center">
        <div className="absolute inset-0 animate-ping rounded-full border border-primary/25" />
        <div className="absolute inset-1 animate-[spin_2.6s_linear_infinite] rounded-full border border-dashed border-primary/50" />
        <StageIcon className="h-9 w-9 animate-pulse text-primary" aria-hidden />
      </div>

      <div className="text-center">
        <p className="font-heading text-lg font-black text-foreground">
          {stageLabels[stageIndex]}
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          {t("analyzing.expect", "深度分析通常需要 10~20 秒，请别关页面，好东西值得等一下")}
        </p>
      </div>

      {/* 进度条 */}
      <div className="mt-6 w-full max-w-[300px]">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
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
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />
              ) : (
                <span
                  className={`h-3.5 w-3.5 shrink-0 rounded-full border ${
                    active ? "animate-pulse border-primary bg-primary/20" : "border-muted-foreground/30"
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
