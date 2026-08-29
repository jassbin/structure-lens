"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2, Search, ChevronsDown, Swords } from "lucide-react";
import { drill, type DrillMode } from "@/lib/api/analysis";
import { AppAIClientUnavailableError } from "@/lib/api/app-ai-request";
import { cn } from "@/utils/utils";

/** 单条判断 + 三个深挖入口（质疑 / 深挖 / 反驳），结果内联展开 */
export function DrillPoint({
  verdict,
  layerTitle,
  point,
}: {
  verdict: string;
  layerTitle: string;
  point: string;
}) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<DrillMode | null>(null);
  const [text, setText] = useState<Record<DrillMode, string>>({
    challenge: "",
    deeper: "",
    counter: "",
  });
  const [loading, setLoading] = useState<DrillMode | null>(null);

  const actions: Array<{ m: DrillMode; label: string; icon: typeof Search }> = [
    { m: "deeper", label: t("drill.deeper", "再深一层"), icon: ChevronsDown },
    { m: "challenge", label: t("drill.challenge", "质疑依据"), icon: Search },
    { m: "counter", label: t("drill.counter", "反驳它"), icon: Swords },
  ];

  async function run(m: DrillMode) {
    setMode(m);
    if (text[m] || loading) return;
    setLoading(m);
    try {
      const res = await drill({ verdict, layerTitle, point, mode: m });
      setText((prev) => ({ ...prev, [m]: res }));
    } catch (error) {
      if (!(error instanceof AppAIClientUnavailableError)) {
        toast.error(t("drill.failed", "深挖失败，请重试"));
      }
      setMode(null);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="rounded-xl border border-transparent px-0 py-0" data-el="drill-point">
      <div className="flex gap-2 text-sm leading-relaxed text-foreground">
        <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" />
        <span className="flex-1">{point}</span>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5 pl-3">
        {actions.map(({ m, label, icon: Icon }) => (
          <button
            key={m}
            type="button"
            onClick={() => run(m)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold transition-colors",
              mode === m
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/40 hover:text-primary",
            )}
          >
            {loading === m ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Icon className="h-3 w-3" />
            )}
            {label}
          </button>
        ))}
      </div>
      {mode && text[mode] && (
        <p className="mt-2 rounded-xl bg-muted/60 px-3 py-2 text-[13px] leading-relaxed text-foreground">
          {text[mode]}
        </p>
      )}
    </li>
  );
}
