"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ArrowRight, Sparkles, Loader2 } from "lucide-react";
import { AppShell } from "@/components/shared/app-shell";
import { BottomTabs } from "@/components/shared/bottom-tabs";
import { DeepTopics } from "@/components/home/deep-topics";
import { ProbePanel, NotApplicablePanel, AlignCard } from "@/components/home/entry-panels";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cacheAnalysis } from "@/lib/analysis/store";
import { saveLocalAnalysis, mergeLocalStructure } from "@/lib/analysis/local-map";
import { analyze, precheck } from "@/lib/api/analysis";
import { AppAIClientUnavailableError } from "@/lib/api/app-ai-request";
import type { SearchSource, TriageResult } from "@/lib/analysis/types";

type AlignState = {
  input: string;
  summary: string;
  sources: SearchSource[];
} | null;

export function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [triage, setTriage] = useState<TriageResult | null>(null);
  const [probeAnswer, setProbeAnswer] = useState("");
  const [align, setAlign] = useState<AlignState>(null);
  const [alignDraft, setAlignDraft] = useState("");

  /** 免登录：本地缓存 + 本地结构地图并入，登录用户服务端已落库 */
  function persistLocally(
    res: Extract<Awaited<ReturnType<typeof analyze>>, { status: "diggable" }>,
  ) {
    cacheAnalysis(res.result);
    saveLocalAnalysis(res.result);
    if (!res.persisted) {
      mergeLocalStructure(res.result.skeleton, res.result.verdict);
    }
  }

  /** 真正调分析并跳转。opts 用于对齐流程带上已确认的来源。 */
  async function runAnalysis(
    text: string,
    opts?: { alignedSources?: SearchSource[]; aligned?: boolean },
  ) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await analyze(text, opts);
      if (res.status === "diggable") {
        persistLocally(res);
        router.push(`/analysis/${res.result.id}`);
      } else {
        setTriage(res.triage);
        setBusy(false);
      }
    } catch (error) {
      if (!(error instanceof AppAIClientUnavailableError)) {
        toast.error(t("home.failed", "分析失败，请稍后重试"));
      }
      setBusy(false);
    }
  }

  /** 提交：先预检——够具体直接分析；太短先搜，搜到弹对齐卡、搜不到弹反问。 */
  async function submitText(text: string) {
    if (busy) return;
    setBusy(true);
    setTriage(null);
    setAlign(null);
    if (!text) {
      setTriage({
        verdict: "too_shallow",
        probes: [
          "这件事里，最让你觉得‘不对劲’的具体决定或动作是什么？",
          "涉及哪些主体？他们各自想要什么？",
        ],
      });
      setBusy(false);
      return;
    }
    try {
      const pre = await precheck(text);
      if (pre.status === "diggable") {
        await runAnalysis(text);
        return;
      }
      if (pre.status === "align") {
        setAlign({ input: pre.input, summary: pre.summary, sources: pre.sources });
        setAlignDraft(pre.summary);
        setBusy(false);
        return;
      }
      setTriage(pre.triage);
      setBusy(false);
    } catch (error) {
      if (!(error instanceof AppAIClientUnavailableError)) {
        toast.error(t("home.failed", "分析失败，请稍后重试"));
      }
      setBusy(false);
    }
  }

  function handleSubmit() {
    void submitText(input.trim());
  }

  /** 用户在对齐卡确认：用（可能已编辑的）概要 + 来源直接分析 */
  function confirmAlign() {
    if (!align) return;
    void runAnalysis(alignDraft.trim(), {
      alignedSources: align.sources,
      aligned: true,
    });
  }

  return (
    <AppShell tab={<BottomTabs />}>
      <div className="relative">
        <HeroBackdrop />

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

          {align && (
            <AlignCard
              sources={align.sources}
              edited={alignDraft}
              onEdit={setAlignDraft}
              onConfirm={confirmAlign}
              onReject={() => {
                setAlign(null);
                setTriage({
                  verdict: "too_shallow",
                  probes: [
                    "这件事里，最让你觉得‘不对劲’的具体决定或动作是什么？",
                    "涉及哪些主体？他们各自想要什么？",
                  ],
                });
              }}
              busy={busy}
            />
          )}

          {triage?.verdict === "too_shallow" && (
            <ProbePanel
              probes={triage.probes ?? []}
              answer={probeAnswer}
              onAnswer={setProbeAnswer}
              onContinue={() =>
                void submitText(`${input.trim()}\n${probeAnswer.trim()}`.trim())
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
