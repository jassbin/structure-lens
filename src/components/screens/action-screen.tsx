"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Activity,
  Split,
  ScanEye,
  Rocket,
  DoorOpen,
  HeartPulse,
  RefreshCw,
} from "lucide-react";
import { getCachedAnalysis } from "@/lib/analysis/store";
import { getLocalAnalysis } from "@/lib/analysis/local-map";
import { getLocalActionPlan, saveLocalActionPlan } from "@/lib/analysis/action-store";
import {
  getAnalysis,
  getActionPlan,
  getSavedActionPlan,
  recomputeAction,
} from "@/lib/api/analysis";
import { ActionLoadingOverlay } from "@/components/shared/action-loading-overlay";
import { PerspectiveBar } from "@/components/action/perspective-bar";
import { ActionDisagreeThread } from "@/components/action/action-disagree-thread";
import { InfoTip } from "@/components/shared/info-tip";
import { toast } from "sonner";
import type { AnalysisResult } from "@/lib/analysis/types";
import type {
  ActionPlan,
  ActionStepKey,
  ActionPerspective,
  Controllability,
} from "@/lib/analysis/action";

const BUCKET_STYLE: Record<Controllability, string> = {
  environment: "border-secondary/40 bg-secondary/10 text-secondary",
  behavior: "border-primary/40 bg-primary/10 text-primary",
  uncontrollable: "border-muted-foreground/30 bg-muted text-muted-foreground",
};

export function ActionScreen({ id }: { id: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [source, setSource] = useState<AnalysisResult | null | undefined>(
    () => getCachedAnalysis(id) ?? getLocalAnalysis(id) ?? undefined,
  );
  const [plan, setPlan] = useState<ActionPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // 1) 取来源分析（缓存/本地/云端）
  useEffect(() => {
    if (source !== undefined) return;
    let alive = true;
    getAnalysis(id)
      .then((r) => alive && setSource(r ?? getLocalAnalysis(id)))
      .catch(() => alive && setSource(getLocalAnalysis(id)));
    return () => {
      alive = false;
    };
  }, [id, source]);

  // 2) 有来源后：先查已存方案（本地→云端），命中直接用；否则生成并保存
  useEffect(() => {
    if (!source) {
      if (source === null) setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    setError(false);

    const sourceId = source.id;
    const local = getLocalActionPlan(sourceId);
    if (local) {
      setPlan(local);
      setLoading(false);
      return;
    }

    (async () => {
      // 登录用户：先看云端是否已存
      const saved = await getSavedActionPlan(sourceId).catch(() => null);
      if (!alive) return;
      if (saved) {
        setPlan(saved);
        saveLocalActionPlan(saved); // 回灌本地，下次秒开
        setLoading(false);
        return;
      }
      // 都没有 → 生成，并本地持久化（登录用户服务端已落库）
      try {
        const p = await getActionPlan({
          id: source.id,
          input: source.input,
          verdict: source.verdict,
          skeleton: source.skeleton,
        });
        if (!alive) return;
        setPlan(p);
        saveLocalActionPlan(p);
      } catch {
        if (alive) setError(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [source]);

  function retry() {
    setSource((s) => (s ? { ...s } : s)); // 触发重取
  }

  const [busyStep, setBusyStep] = useState<ActionStepKey | null>(null);
  const [switching, setSwitching] = useState(false);

  /** 切换视角 → 强制按新视角重生成整份方案 */
  async function switchPerspective(role: ActionPerspective["role"]) {
    if (!source || switching || role === plan?.perspective.role) return;
    setSwitching(true);
    setLoading(true);
    try {
      const p = await getActionPlan({
        id: source.id,
        input: source.input,
        verdict: source.verdict,
        skeleton: source.skeleton,
        perspectiveRole: role,
      });
      setPlan(p);
      saveLocalActionPlan(p);
    } catch {
      toast.error(t("action.failed", "生成失败，请重试"));
    } finally {
      setSwitching(false);
      setLoading(false);
    }
  }

  /** 某一节「我不同意/追问」→ 表态 + 可能重算下游 */
  async function submitDisagree(stepKey: ActionStepKey, objection: string) {
    if (!plan || busyStep) return;
    setBusyStep(stepKey);
    try {
      const res = await recomputeAction({ plan, fromStepKey: stepKey, objection });
      setPlan(res.plan);
      saveLocalActionPlan(res.plan);
      if (res.changeNote) {
        toast.success(
          res.stance === "hold"
            ? t("action.debate.held", "已回应，结论维持")
            : t("action.debate.updated", "已据此更新后续步骤"),
        );
      }
    } catch {
      toast.error(t("action.debate.failed", "回应失败，请重试"));
    } finally {
      setBusyStep(null);
    }
  }

  const bucketLabel = (b: Controllability) => t(`action.bucket.${b}`);

  /** 渲染某一节的「我不同意/追问」线程 */
  const dt = (stepKey: ActionStepKey) =>
    plan ? (
      <ActionDisagreeThread
        debate={plan.debates?.[stepKey]}
        busy={busyStep === stepKey}
        onSubmit={(objection) => submitDisagree(stepKey, objection)}
      />
    ) : null;

  if (source === null) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-3 px-4 py-16 text-center">
        <p className="text-sm text-muted-foreground">{t("analysis.notFound")}</p>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="inline-flex h-9 items-center rounded-xl border border-border bg-card px-4 text-sm font-semibold"
        >
          {t("analysis.back")}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-4">
      <ActionLoadingOverlay open={loading} />
      <button
        type="button"
        onClick={() => router.push(`/analysis/${id}`)}
        className="flex items-center gap-1 self-start text-sm font-semibold text-muted-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("action.backToReport")}
      </button>

      {/* Hero */}
      <div className="rounded-3xl bg-secondary p-5 text-secondary-foreground shadow-[0_18px_44px_rgba(16,185,129,0.28)]">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-secondary-foreground/80">
          {t("action.badge")}
          <InfoTip content={t("action.tip.overview")} className="[&_button]:text-secondary-foreground/70 [&_button:hover]:text-white" />
        </span>
        <h1 className="mt-2 font-heading text-2xl font-black leading-tight">
          {t("action.title")}
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-secondary-foreground/85">
          {t("action.subtitle")}
        </p>
      </div>

      {/* 视角条：显示当前视角 + 可切换（自动识别，错了能纠正） */}
      {!loading && !error && plan && (
        <PerspectiveBar
          current={plan.perspective}
          busy={switching || busyStep !== null}
          onSwitch={switchPerspective}
        />
      )}

      {loading && <div className="py-16" aria-hidden />}

      {!loading && error && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-sm text-muted-foreground">{t("action.failed")}</p>
          <button
            type="button"
            onClick={retry}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-secondary px-4 text-sm font-semibold text-secondary-foreground"
          >
            <RefreshCw className="h-4 w-4" />
            {t("action.retry")}
          </button>
        </div>
      )}

      {!loading && !error && plan && (
        <>
          <p className="rounded-2xl border border-secondary/20 bg-secondary/[0.06] px-4 py-3 font-heading text-base font-extrabold leading-snug text-foreground">
            {plan.headline}
          </p>

          {/* 1 痛点定位 */}
          <StepCard icon={Activity} n={1} title={t("action.step.pain")} tip={t("action.tip.pain")}>
            <Field label={t("action.pain.whatHurts")} value={plan.steps.pain.whatHurts} strong />
            <Field label={t("action.pain.signal")} value={plan.steps.pain.signal} />
          </StepCard>

          {/* 2 可控性分诊 */}
          <StepCard icon={Split} n={2} title={t("action.step.triage")} tip={t("action.tip.triage")}>
            <ul className="space-y-2">
              {plan.steps.triage.items.map((it, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span
                    className={`mt-0.5 shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${BUCKET_STYLE[it.bucket]}`}
                  >
                    {bucketLabel(it.bucket)}
                  </span>
                  <span className="text-sm leading-relaxed text-foreground">{it.text}</span>
                </li>
              ))}
            </ul>
          </StepCard>

          {/* 3 自欺检测 */}
          <StepCard icon={ScanEye} n={3} title={t("action.step.selfDeception")} tip={t("action.tip.selfDeception")}>
            <span className="inline-flex rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-bold text-foreground">
              {t(`action.sd.${plan.steps.selfDeception.verdict}`)}
            </span>
            <p className="mt-2 text-sm leading-relaxed text-foreground">
              {plan.steps.selfDeception.note}
            </p>
            {plan.steps.selfDeception.checks.length > 0 && (
              <ul className="mt-2 space-y-1">
                {plan.steps.selfDeception.checks.map((c, i) => (
                  <li key={i} className="text-[13px] leading-relaxed text-muted-foreground">
                    · {c}
                  </li>
                ))}
              </ul>
            )}
          </StepCard>

          {/* 4 最小行动 */}
          {plan.steps.minimalAction.actions.length > 0 && (
            <StepCard icon={Rocket} n={4} title={t("action.step.minimalAction")} tip={t("action.tip.minimalAction")} accent>
              <div className="space-y-2.5">
                {plan.steps.minimalAction.actions.map((a, i) => (
                  <div key={i} className="rounded-xl border border-secondary/25 bg-secondary/[0.05] px-3 py-2">
                    <p className="text-sm font-bold text-foreground">{a.title}</p>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{a.how}</p>
                  </div>
                ))}
              </div>
            </StepCard>
          )}

          {/* 5 缝隙扫描 */}
          {plan.steps.crack.cracks.length > 0 && (
            <StepCard icon={DoorOpen} n={5} title={t("action.step.crack")} tip={t("action.tip.crack")}>
              <ul className="space-y-2">
                {plan.steps.crack.cracks.map((c, i) => (
                  <li key={i}>
                    <span className="text-[13px] font-bold text-primary">{c.kind}</span>
                    <span className="ml-1 text-sm leading-relaxed text-foreground">{c.detail}</span>
                  </li>
                ))}
              </ul>
            </StepCard>
          )}

          {/* 6 清醒安慰剂 */}
          <StepCard icon={HeartPulse} n={6} title={t("action.step.placebo")} tip={t("action.tip.placebo")}>
            {plan.steps.placebo.regulations.length > 0 && (
              <ul className="space-y-1">
                {plan.steps.placebo.regulations.map((r, i) => (
                  <li key={i} className="text-sm leading-relaxed text-foreground">· {r}</li>
                ))}
              </ul>
            )}
            <p className="mt-3 border-l-2 border-secondary pl-3 font-heading text-sm font-extrabold leading-snug text-foreground">
              {plan.steps.placebo.closingPrinciple}
            </p>
          </StepCard>

          <p className="px-1 pb-4 text-center text-[11px] leading-relaxed text-muted-foreground">
            {t("action.disclaimer")}
          </p>
        </>
      )}
    </div>
  );
}

function StepCard({
  icon: Icon,
  n,
  title,
  tip,
  accent,
  children,
  footer,
}: {
  icon: typeof Activity;
  n: number;
  title: string;
  tip?: string;
  accent?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border-2 p-4 shadow-[0_2px_10px_rgba(15,23,42,0.05)] ${accent ? "border-secondary/45 bg-secondary/[0.07]" : "border-border/80 bg-card"}`}
    >
      <div className="flex items-center gap-2">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-secondary/15 text-[12px] font-black text-secondary ring-1 ring-inset ring-secondary/25">
          {n}
        </span>
        <Icon className="h-4 w-4 text-secondary" aria-hidden />
        <span className="flex items-center gap-1 font-heading text-sm font-extrabold text-foreground">
          {title}
          {tip && <InfoTip content={tip} />}
        </span>
      </div>
      <div className="mt-3 border-t border-border/60 pt-3">{children}</div>
      {footer}
    </div>
  );
}

function Field({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  if (!value) return null;
  return (
    <p className={`text-sm leading-relaxed ${strong ? "font-semibold text-foreground" : "text-muted-foreground"} mt-1 first:mt-0`}>
      <span className="text-[11px] font-bold uppercase tracking-wide text-secondary">{label} </span>
      {value}
    </p>
  );
}
