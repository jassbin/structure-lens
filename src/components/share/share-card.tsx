"use client";

import { useTranslation } from "react-i18next";
import { Layers } from "lucide-react";
import { ROOT_LABELS } from "@/lib/analysis/types";
import type { StructureSkeleton } from "@/lib/analysis/types";

/**
 * 骨架卡：只读、自包含的分享视觉。只用 verdict + skeleton，
 * 绝不含用户身份、结构地图或完整分析步骤。
 */
export function ShareCard({
  verdict,
  skeleton,
  input,
}: {
  verdict: string;
  skeleton: StructureSkeleton;
  input?: string;
}) {
  const { t, i18n } = useTranslation();
  const zh = i18n.language?.startsWith("zh");
  const rootLabel = ROOT_LABELS[skeleton.root]?.[zh ? "zh" : "en"] ?? skeleton.root;

  return (
    <div
      data-el="share-card"
      className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0B0B14] p-6 text-white shadow-[0_24px_60px_rgba(8,12,40,0.5)]"
    >
      {/* 科幻底纹 */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/25 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-12 -left-8 h-40 w-40 rounded-full bg-secondary/20 blur-3xl"
      />

      <div className="relative">
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-primary/80">
          <Layers className="h-3.5 w-3.5" aria-hidden />
          {t("share.brand", "结构透镜")}
        </div>

        {input ? (
          <p className="mt-3 text-xs leading-relaxed text-white/50">{input}</p>
        ) : null}

        <p className="mt-2 font-heading text-[22px] font-black leading-tight">
          {verdict}
        </p>

        <div className="mt-4 space-y-2.5 rounded-2xl bg-white/[0.04] p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-black text-primary">{skeleton.name}</span>
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
              {rootLabel}
            </span>
          </div>
          <Row label={t("share.perceivedAs", "表面以为")} value={skeleton.perceivedAs} />
          <Row label={t("share.actual", "底层其实")} value={skeleton.actualStructure} strong />
          <Row label={t("share.whySo", "为何成立")} value={skeleton.whySo} />
        </div>

        <p className="mt-4 text-[10px] leading-relaxed text-white/40">
          {t(
            "share.disclaimer",
            "这是基于个人视角与 AI 推演的结构解读，仅供参考，非事实定论。",
          )}
        </p>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex gap-2 text-[13px] leading-relaxed">
      <span className="w-14 shrink-0 text-white/40">{label}</span>
      <span className={strong ? "flex-1 font-semibold text-white" : "flex-1 text-white/80"}>
        {value}
      </span>
    </div>
  );
}
