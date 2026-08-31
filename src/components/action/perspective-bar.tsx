"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { UserCog, Check, ChevronDown } from "lucide-react";
import { PERSPECTIVE_ROLES, type ActionPerspective } from "@/lib/analysis/action";

/**
 * 视角条：显示行动方案当前所站的视角（自动识别），点击可切换到其他角色。
 * 切换后父组件会按新视角强制重生成整份方案，避免"用户是子女却给父母建议"的错位。
 */
export function PerspectiveBar({
  current,
  busy,
  onSwitch,
}: {
  current: ActionPerspective;
  busy: boolean;
  onSwitch: (role: ActionPerspective["role"]) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative" data-el="perspective-bar">
      <div className="flex items-center gap-2 rounded-2xl border border-secondary/30 bg-secondary/[0.06] px-3.5 py-2.5">
        <UserCog className="h-4 w-4 shrink-0 text-secondary" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-muted-foreground">
            {t("action.perspective.label", "当前视角")}
          </p>
          <p className="truncate text-sm font-bold text-foreground">{current.label}</p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => setOpen((v) => !v)}
          data-el="perspective-switch"
          className="inline-flex items-center gap-1 rounded-full border border-secondary/40 bg-card px-2.5 py-1 text-[11px] font-bold text-secondary disabled:opacity-50"
        >
          {t("action.perspective.switch", "切换视角")}
          <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      {open && (
        <div className="absolute inset-x-0 top-full z-20 mt-1.5 overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
          <p className="border-b border-border/60 px-3.5 py-2 text-[11px] leading-relaxed text-muted-foreground">
            {t("action.perspective.pickHint", "你在这件事里是哪个角色？换一个，建议就会重新对准你。")}
          </p>
          <ul className="max-h-64 overflow-y-auto py-1">
            {PERSPECTIVE_ROLES.map((role) => {
              const active = role === current.role;
              return (
                <li key={role}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setOpen(false);
                      if (!active) onSwitch(role);
                    }}
                    className="flex w-full items-center justify-between px-3.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-secondary/[0.06] disabled:opacity-50"
                  >
                    {t(`action.perspective.role.${role}`)}
                    {active && <Check className="h-4 w-4 text-secondary" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
