"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { ArrowRight, Loader2 } from "lucide-react";
import { ShareCard } from "@/components/share/share-card";
import { getShare, type ShareRecord } from "@/lib/api/analysis";

/** 只读分享页：任何人可看，不需要登录，不暴露分享者的结构地图。 */
export function ShareScreen({ code }: { code: string }) {
  const { t } = useTranslation();
  const [share, setShare] = useState<ShareRecord | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    getShare(code)
      .then((r) => alive && setShare(r))
      .catch(() => alive && setShare(null));
    return () => {
      alive = false;
    };
  }, [code]);

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-center gap-5 px-4 py-8">
      {share === undefined ? (
        <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("common.loading", "加载中…")}
        </div>
      ) : share === null ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <p className="text-sm text-muted-foreground">
            {t("share.notFound", "分享不存在或已失效")}
          </p>
        </div>
      ) : (
        <ShareCard
          verdict={share.verdict}
          skeleton={share.skeleton}
          input={share.input}
        />
      )}

      <Link
        href="/"
        data-el="share-cta"
        className="mt-1 inline-flex h-12 items-center justify-center gap-1 rounded-2xl bg-[#0C5FFD] text-base font-bold text-white shadow-[0_10px_24px_rgba(12,95,253,0.45)] hover:bg-[#0048F0]"
      >
        {t("share.tryYours", "拿你的事件也照一副骨架")}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
