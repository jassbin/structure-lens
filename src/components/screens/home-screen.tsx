"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { auth } from "@eazo/sdk";
import { useEazo } from "@eazo/sdk/react";
import { ArrowRight, Sparkles, Loader2 } from "lucide-react";
import { AppShell } from "@/components/shared/app-shell";
import { BottomTabs } from "@/components/shared/bottom-tabs";
import { DeepTopics } from "@/components/home/deep-topics";
import { ProbePanel, NotApplicablePanel } from "@/components/home/entry-panels";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cacheAnalysis } from "@/lib/analysis/store";
import { analyze } from "@/lib/api/analysis";
import { AppAIClientUnavailableError } from "@/lib/api/app-ai-request";
import type { TriageResult } from "@/lib/analysis/types";

export function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const user = useEazo((s) => s.auth.user);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [triage, setTriage] = useState<TriageResult | null>(null);
  const [probeAnswer, setProbeAnswer] = useState("");

  async function runAnalysis(text: string) {
    if (busy) return;
    if (!user) {
      auth.login().catch(() => undefined);
      return;
    }
    setBusy(true);
    setTriage(null);
    try {
      const res = await analyze(text);
      if (res.status === "diggable") {
        cacheAnalysis(res.result);
        router.push(`/analysis/${res.result.id}`);
      } else {
        setTriage(res.triage);
        setBusy(false);
      }
    } catch (error) {
      if (!(error instanceof AppAIClientUnavailableError)) {
        toast.error("分析失败，请稍后重试");
      }
      setBusy(false);
    }
  }

  function handleSubmit() {
    const text = input.trim();
    if (!text) {
      setTriage({
        verdict: "too_shallow",
        probes: [
          "这件事里，最让你觉得‘不对劲’的具体决定或动作是什么？",
          "涉及哪些主体？他们各自想要什么？",
        ],
      });
      return;
    }
    void runAnalysis(text);
  }

  return (
    <AppShell tab={<BottomTabs />}>
      <div className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-0 h-80 overflow-hidden"
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(12,95,253,0.28) 0%, rgba(12,95,253,0.12) 40%, rgba(255,248,236,0) 100%)",
            }}
          />
          <div
            className="absolute -left-12 -top-8 h-48 w-48 rounded-full opacity-90 blur-3xl"
            style={{ background: "rgba(12,95,253,0.35)" }}
          />
          <div
            className="absolute -right-8 top-4 h-36 w-36 rounded-full opacity-80 blur-3xl"
            style={{ background: "rgba(0,72,240,0.30)" }}
          />
        </div>

        <div className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-6">
          <div className="pt-2 text-center" data-el="home-hero">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-accent" aria-hidden />
              {t("home.brand")}
            </span>
            <h1 className="mt-3 font-heading text-2xl font-black leading-snug tracking-tight text-foreground">
              {t("home.tagline")}
            </h1>
          </div>

          <div className="flex flex-col gap-3" data-el="home-input">
            <Textarea
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setTriage(null);
              }}
              placeholder={t("home.inputPlaceholder")}
              rows={4}
              className="resize-none rounded-2xl border-border bg-card text-[15px] shadow-sm focus-visible:ring-primary"
            />
            <Button
              onClick={handleSubmit}
              disabled={busy}
              className="h-12 rounded-2xl bg-[#0C5FFD] text-base font-bold text-white shadow-[0_10px_24px_rgba(12,95,253,0.45)] hover:bg-[#0048F0] disabled:opacity-100"
              data-el="home-analyze"
            >
              {busy ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  {t("home.analyzing")}
                </>
              ) : (
                <>
                  {t("home.analyze")}
                  <ArrowRight className="ml-1 h-4 w-4" />
                </>
              )}
            </Button>
          </div>

          {triage?.verdict === "too_shallow" && (
            <ProbePanel
              probes={triage.probes ?? []}
              answer={probeAnswer}
              onAnswer={setProbeAnswer}
              onContinue={() =>
                void runAnalysis(`${input.trim()}\n${probeAnswer.trim()}`.trim())
              }
              busy={busy}
            />
          )}

          {triage?.verdict === "not_applicable" && (
            <NotApplicablePanel
              suggestion={triage.suggestion}
              onReset={() => {
                setInput("");
                setTriage(null);
              }}
            />
          )}

          <DeepTopics
            disabled={busy}
            onPick={(prompt) => {
              setInput(prompt);
              void runAnalysis(prompt);
            }}
          />
        </div>
      </div>
    </AppShell>
  );
}
