"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { analyze, walkFocus } from "@/lib/api/analysis";
import { AppAIClientUnavailableError } from "@/lib/api/app-ai-request";
import { cacheAnalysis } from "@/lib/analysis/store";
import { saveLocalAnalysis, mergeLocalStructure } from "@/lib/analysis/local-map";

export type WalkPhase = "focus" | "analyze";

/**
 * 游走编排：宽泛同构方向 -> 联网锁定最火/最典型具体事件 -> 完整 8 步穿透 -> 跳报告页。
 * 全程通过 { walking, phase, lockedTitle } 驱动一个"分析中"全屏遮罩。
 * direction 是钩子/标签给的方向文案；reason 是可选的同构理由，帮助筛选更准。
 */
export function useWalk() {
  const { t } = useTranslation();
  const router = useRouter();
  const [walking, setWalking] = useState(false);
  const [phase, setPhase] = useState<WalkPhase>("focus");
  const [lockedTitle, setLockedTitle] = useState<string>("");

  const walk = useCallback(
    async (direction: string, reason?: string) => {
      if (walking) return;
      setWalking(true);
      setPhase("focus");
      setLockedTitle("");
      try {
        // 1) 联网筛选：锁定该方向下最火（没有则最典型）的具体真实事件
        const focus = await walkFocus({ direction, reason });
        const target = focus.picked && focus.title ? focus.title : direction;
        setLockedTitle(target);
        setPhase("analyze");

        // 2) aligned:true —— 已是明确锁定的具体事件，跳过"太模糊"分诊，直接跑完整分析
        const res = await analyze(target, { aligned: true });
        if (res.status === "diggable") {
          cacheAnalysis(res.result);
          saveLocalAnalysis(res.result);
          if (!res.persisted)
            mergeLocalStructure(res.result.skeleton, res.result.verdict);
          router.push(`/analysis/${res.result.id}`);
          // 保持遮罩到路由切走，避免闪回原页
        } else {
          toast.message(
            res.triage.suggestion ??
              t("home.tooShallow", "这个方向还需要更具体一些"),
          );
          setWalking(false);
        }
      } catch (error) {
        if (!(error instanceof AppAIClientUnavailableError)) {
          toast.error(t("home.failed", "分析失败，请稍后重试"));
        }
        setWalking(false);
      }
    },
    [walking, router, t],
  );

  return { walk, walking, phase, lockedTitle };
}
