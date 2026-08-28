"use client";

import { useTranslation } from "react-i18next";
import { auth } from "@eazo/sdk";
import { useEazo } from "@eazo/sdk/react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

/** 登录门禁：未登录时展示登录引导，登录后渲染 children */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const user = useEazo((s) => s.auth.user);
  const loading = useEazo((s) => s.auth.loading);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20 text-sm text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center gap-4 px-8 py-20 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Lock className="h-6 w-6" aria-hidden />
        </span>
        <p className="max-w-xs text-sm text-muted-foreground">
          {t("auth.needLogin")}
        </p>
        <Button
          onClick={() => auth.login().catch(() => undefined)}
          className="h-11 rounded-xl px-6 font-bold"
          data-el="auth-login"
        >
          {t("common.signIn")}
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
