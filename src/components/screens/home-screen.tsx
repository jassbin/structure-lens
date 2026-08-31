"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ArrowRight, Loader2 } from "lucide-react";
import { AppShell } from "@/components/shared/app-shell";
import { BottomTabs } from "@/components/shared/bottom-tabs";
import { AnalyzingOverlay } from "@/components/shared/analyzing-overlay";
import { DeepTopics } from "@/components/home/deep-topics";
import { HeroBackdrop } from "@/components/home/hero-backdrop";
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
  /** 仅在真正跑 8 步深度分析时为 true，用于显示全屏进度遮罩（预检/对齐阶段不显示） */
  const [analyzing, setAnalyzing] = useState(false);
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
    setAnalyzing(true);
    try {
      const res = await analyze(text, opts);
      if (res.status === "diggable") {
        persistLocally(res);
        router.push(`/analysis/${res.result.id}`);
      } else {
        setTriage(res.triage);
        setAnalyzing(false);
        setBusy(false);
      }
    } catch (error) {
      if (!(error instanceof AppAIClientUnavailableError)) {
        toast.error(t("home.failed", "分析失败，请稍后重试"));
      }
      setAnalyzing(false);
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
      <AnalyzingOverlay open={analyzing} />
      <div className="relative">
        <HeroBackdrop />

        <div className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-6">
          <div className="pt-6 text-center" data-el="home-hero">
            <h1 className="font-heading font-black tracking-tight text-[#0B0B0F]">
              <span className="block text-[27px] leading-[1.22] tracking-[-0.01em] [text-shadow:0_1px_0_rgba(255,255,255,0.4)]">
                <span className="block">{t("home.taglineLead")}{t("home.taglineHighlightHead")}</span>
                <span className="block">{t("home.taglineHighlightTail")}</span>
              </span>
              <span className="mt-2 block text-[16px] font-extrabold leading-snug tracking-[0.02em] text-[#0B0B0F]/85 [text-shadow:0_1px_0_rgba(255,255,255,0.4)]">
                {t("home.taglineSub")}
              </span>
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
              className="resize-none rounded-2xl border-border bg-card text-[15px] shadow-sm focus-visible:ring-primary [align-content:center]"
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
