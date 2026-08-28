"use client";

import { useCallback, useSyncExternalStore } from "react";
import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";
import { UserBadge } from "@/components/user-profile/user-badge";
import {
  changeLocale,
  getLocalePreference,
  normalizeLocale,
  type LocaleCode,
  type LocalePreference,
} from "@/i18n";

/** 顶栏内的语言控件，按产品 tokens 重绘 */
function LocaleControl() {
  const { t, i18n } = useTranslation();
  const subscribe = useCallback(
    (sync: () => void) => {
      i18n.on("languageChanged", sync);
      window.addEventListener("eazo-locale-preference-changed", sync);
      window.addEventListener("storage", sync);
      return () => {
        i18n.off("languageChanged", sync);
        window.removeEventListener("eazo-locale-preference-changed", sync);
        window.removeEventListener("storage", sync);
      };
    },
    [i18n],
  );
  const preference = useSyncExternalStore(
    subscribe,
    getLocalePreference,
    () => "system" as LocalePreference,
  );
  async function handleChange(value: string) {
    if (value === "system") return void changeLocale("system");
    const locale = normalizeLocale(value);
    if (locale) await changeLocale(locale as LocaleCode);
  }
  return (
    <div
      className="flex items-center gap-1 rounded-full border border-border bg-background px-2 py-1"
      data-el="locale-control"
    >
      <Languages className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
      <label htmlFor="app-locale" className="sr-only">
        {t("language.label")}
      </label>
      <select
        id="app-locale"
        value={preference}
        onChange={(e) => void handleChange(e.target.value)}
        className="cursor-pointer bg-transparent text-xs font-semibold text-foreground outline-none"
      >
        <option value="system">{t("language.followSystem")}</option>
        <option value="en-US">{t("language.enUS")}</option>
        <option value="zh-CN">{t("language.zhCN")}</option>
      </select>
    </div>
  );
}

/** 全局外壳：顶部品牌栏 + 内容 + 底部 tab（由各页选择是否显示 tab） */
export function AppShell({
  children,
  showTabs = true,
  tab,
}: {
  children: React.ReactNode;
  showTabs?: boolean;
  tab?: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div data-shell className="flex h-full w-full flex-col bg-background">
      <header
        className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card/90 px-4 py-3 backdrop-blur"
        style={{ paddingTop: "max(10px, env(safe-area-inset-top, 0px))" }}
        data-el="app-header"
      >
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-primary text-[13px] font-black text-primary-foreground">
            透
          </span>
          <span className="font-heading text-base font-extrabold tracking-tight text-foreground">
            {t("home.brand")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <LocaleControl />
          <UserBadge />
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      {showTabs && (tab ?? null)}
    </div>
  );
}
