"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Network } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/utils/utils";

const TABS = [
  { href: "/", key: "analyze", icon: Search, match: (p: string) => p === "/" || p.startsWith("/analysis") },
  { href: "/map", key: "map", icon: Network, match: (p: string) => p.startsWith("/map") },
] as const;

/** 底部 tab 导航，安全区自适应 */
export function BottomTabs() {
  const pathname = usePathname();
  const { t } = useTranslation();

  return (
    <nav
      className="sticky bottom-0 z-30 flex items-stretch border-t border-border bg-card/95 backdrop-blur"
      style={{ paddingBottom: "max(6px, env(safe-area-inset-bottom, 0px))" }}
      data-el="bottom-tabs"
    >
      {TABS.map((tab) => {
        const active = tab.match(pathname);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            data-el={`nav-${tab.key}`}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-semibold transition-colors",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Icon className={cn("h-5 w-5", active && "stroke-[2.5]")} aria-hidden />
            {t(`nav.${tab.key}`)}
          </Link>
        );
      })}
    </nav>
  );
}
