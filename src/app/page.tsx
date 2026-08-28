"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { ArrowRight, Sparkles, Loader2, Landmark, Briefcase, ScrollText } from "lucide-react";
import { AppShell } from "@/components/shared/app-shell";
import { BottomTabs } from "@/components/shared/bottom-tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/utils/utils";
import { DEEP_TOPICS } from "@/lib/analysis/mock";
import { analyzeLocally, makeId, triageLocally } from "@/lib/analysis/engine";
import { saveAnalysis } from "@/lib/analysis/store";
import type { TriageResult } from "@/lib/analysis/types";

const CATEGORY_COLOR: Record<string, string> = {
  policy: "text-primary",
  business: "text-secondary",
  history: "text-[#5647d6]",
};

const CATEGORY_ICON = {
  policy: Landmark,
  business: Briefcase,
  history: ScrollText,
} as const;

const CATEGORY_ICON_BG: Record<string, string> = {
  policy: "bg-primary/10 text-primary",
  business: "bg-secondary/10 text-secondary",
  history: "bg-[#6b5cff]/10 text-[#5647d6]",
};

export default function HomePage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [triage, setTriage] = useState<TriageResult | null>(null);
  const [probeAnswer, setProbeAnswer] = useState("");

  function runAnalysis(text: string) {
    setBusy(true);
    const id = makeId();
    const result = analyzeLocally(text, id);
    saveAnalysis(result);
    setTimeout(() => router.push(`/analysis/${id}`), 450);
  }

  function handleSubmit() {
    const text = input.trim();
    if (!text || busy) return;
    const verdict = triageLocally(text);
    if (verdict.verdict === "diggable") runAnalysis(text);
    else setTriage(verdict);
  }

  function handleProbeContinue() {
    const merged = `${input.trim()}\n${probeAnswer.trim()}`.trim();
    runAnalysis(merged);
  }

  return (
    <AppShell tab={<BottomTabs />}>
      <div className="relative">
        {/* 柔和涂鸦氛围背景（参考清新薄荷风） */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-0 h-80 overflow-hidden"
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(180,230,210,0.5) 0%, rgba(200,225,255,0.3) 42%, rgba(255,248,236,0) 100%)",
            }}
          />
          <div
            className="absolute -left-8 top-8 h-28 w-28 opacity-60 blur-[1px]"
            style={{
              background: "#b8ecd6",
              borderRadius: "42% 58% 60% 40% / 45% 45% 55% 55%",
            }}
          />
          <div
            className="absolute right-1 top-4 h-16 w-24 opacity-60"
            style={{
              background: "#cfe3ff",
              borderRadius: "60% 40% 50% 50% / 55% 50% 50% 45%",
            }}
          />
          <div
            className="absolute right-12 top-28 h-9 w-9 rounded-full opacity-50"
            style={{ background: "#ffe08a" }}
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
            disabled={!input.trim() || busy}
            className="h-12 rounded-2xl text-base font-bold shadow-[0_8px_18px_rgba(12,95,253,0.18)]"
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
          <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4" data-el="probe-panel">
            <p className="font-heading text-sm font-extrabold text-foreground">
              {t("home.probeTitle")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{t("home.probeIntro")}</p>
            <ul className="mt-3 space-y-1.5">
              {triage.probes?.map((p, i) => (
                <li key={i} className="flex gap-2 text-sm text-foreground">
                  <span className="font-bold text-primary">{i + 1}.</span>
                  {p}
                </li>
              ))}
            </ul>
            <Textarea
              value={probeAnswer}
              onChange={(e) => setProbeAnswer(e.target.value)}
              placeholder={t("home.probeAnswerPlaceholder")}
              rows={2}
              className="mt-3 resize-none rounded-xl border-border bg-card text-sm"
            />
            <Button
              onClick={handleProbeContinue}
              disabled={!probeAnswer.trim() || busy}
              className="mt-3 h-10 w-full rounded-xl font-bold"
              data-el="probe-continue"
            >
              {t("home.probeContinue")}
            </Button>
          </div>
        )}

        {triage?.verdict === "not_applicable" && (
          <div className="rounded-2xl border border-accent/50 bg-accent/10 p-4" data-el="not-applicable-panel">
            <p className="font-heading text-sm font-extrabold text-foreground">
              {t("home.notApplicableTitle")}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{triage.suggestion}</p>
            <Button
              variant="outline"
              onClick={() => {
                setInput("");
                setTriage(null);
              }}
              className="mt-3 h-9 rounded-xl font-semibold"
            >
              {t("home.notApplicableBack")}
            </Button>
          </div>
        )}

        <div className="flex flex-col gap-3" data-el="deep-topics">
          <p className="text-sm font-bold text-muted-foreground">{t("home.topicsTitle")}</p>
          <div className="grid grid-cols-1 gap-2.5">
            {DEEP_TOPICS.map((topic) => {
              const Icon = CATEGORY_ICON[topic.category];
              return (
                <button
                  key={topic.id}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setInput(topic.prompt);
                    runAnalysis(topic.prompt);
                  }}
                  data-el="topic-card"
                  className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 text-left shadow-sm transition-all hover:border-primary/40 hover:shadow-md disabled:opacity-60"
                >
                  <span
                    className={cn(
                      "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
                      CATEGORY_ICON_BG[topic.category],
                    )}
                  >
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "text-[11px] font-bold uppercase tracking-wide",
                        CATEGORY_COLOR[topic.category],
                      )}
                    >
                      {t(`home.category.${topic.category}`)}
                    </span>
                    <p className="mt-0.5 truncate text-sm font-semibold text-foreground">
                      {topic.title}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </button>
              );
            })}
          </div>
        </div>
      </div>
      </div>
    </AppShell>
  );
}
