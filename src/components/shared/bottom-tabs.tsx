"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Network, Sprout } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/utils/utils";

const LAST_ANALYSIS_KEY = "structure-lens:last-analysis-path";

/** 底部 tab 导航，安全区自适应 */
export function BottomTabs() {
  const pathname = usePathname();
  const { t } = useTranslation();
  // 记住最后停留的分析报告页：切到地图再切回「分析」时回到原报告页，而非空输入页
  const [lastAnalysis, setLastAnalysis] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (pathname.startsWith("/analysis/")) {
      window.sessionStorage.setItem(LAST_ANALYSIS_KEY, pathname);
      setLastAnalysis(pathname);
    } else {
      setLastAnalysis(window.sessionStorage.getItem(LAST_ANALYSIS_KEY));
    }
  }, [pathname]);

  const analyzeHref =
    lastAnalysis && !pathname.startsWith("/analysis/") ? lastAnalysis : "/";

  const tabs = [
    {
      key: "analyze",
      href: analyzeHref,
      icon: Search,
      active: pathname === "/" || pathname.startsWith("/analysis"),
    },
    {
      key: "actions",
      href: "/actions",
      icon: Sprout,
      active: pathname.startsWith("/actions") || pathname.startsWith("/action/"),
    },
    {
      key: "map",
      href: "/map",
      icon: Network,
      active: pathname.startsWith("/map"),
    },
  ] as const;

  return (
    <nav
      className="sticky bottom-0 z-30 flex items-stretch border-t border-border bg-card/95 backdrop-blur"
      style={{ paddingBottom: "max(6px, env(safe-area-inset-bottom, 0px))" }}
      data-el="bottom-tabs"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            data-el={`nav-${tab.key}`}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-semibold transition-colors",
              tab.active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Icon className={cn("h-5 w-5", tab.active && "stroke-[2.5]")} aria-hidden />
            {t(`nav.${tab.key}`)}
          </Link>
        );
      })}
    </nav>
  );
}
