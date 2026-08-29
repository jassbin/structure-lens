import { type NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth";
import { appAi, AppAIUnavailableError } from "@/lib/eazo-ai-billing";
import { updateAnalysis } from "@/lib/db/queries/analyses";
import { mergeStructure } from "@/lib/db/queries/structure-nodes";
import {
  extractJson,
  recomputeSystemPrompt,
  serializeStepsForContext,
} from "@/lib/analysis/prompt";
import { applyRecompute } from "@/lib/analysis/validate";
import { STEP_ORDER, STEP_LABELS } from "@/lib/analysis/types";
import type { AnalysisResult, StepKind } from "@/lib/analysis/types";

type Target = StepKind | "skeleton-card";

/**
 * POST /api/recompute { result, fromStepKind, disagreement }
 * 用户对某一节「我不同意」→ AI 先表态(吸收/折中/保持)+理由，仅吸收/折中才动下游。
 * fromStepKind 可为某个 StepKind，或 "skeleton-card"（反驳结构骨架卡）。免登录。
 */
export async function POST(request: NextRequest) {
  const user = getOptionalUser(request);

  const body = (await request.json().catch(() => ({}))) as {
    result?: AnalysisResult;
    fromStepKind?: Target;
    disagreement?: string;
  };
  const base = body.result;
  const fromStepKind = body.fromStepKind;
  const disagreement = (body.disagreement ?? "").trim();

  const isSkeletonCard = fromStepKind === "skeleton-card";
  const validTarget =
    isSkeletonCard || (fromStepKind && STEP_ORDER.includes(fromStepKind as StepKind));
  if (!base || !fromStepKind || !validTarget) {
    return NextResponse.json({ error: "参数不完整" }, { status: 400 });
  }
  if (!disagreement) {
    return NextResponse.json({ error: "请先写下你的反对意见" }, { status: 400 });
  }

  const fromIdx = isSkeletonCard ? -1 : STEP_ORDER.indexOf(fromStepKind as StepKind);
  const upstream = isSkeletonCard
    ? []
    : base.steps.filter((s) => STEP_ORDER.indexOf(s.kind) < fromIdx);
  const downstream = isSkeletonCard
    ? base.steps
    : base.steps.filter((s) => STEP_ORDER.indexOf(s.kind) >= fromIdx);

  const stepLabel = isSkeletonCard
    ? "结构骨架卡"
    : (STEP_LABELS[fromStepKind as StepKind]?.zh ?? String(fromStepKind));

  const targetContent = isSkeletonCard
    ? `\n【被反对的这一节：结构骨架卡（当前内容）】\n${serializeStepsForContext([base.skeleton])}`
    : `\n【被反对的这一节及其下游（当前内容，供参考）】\n${serializeStepsForContext(downstream)}`;

  const userContent = [
    `原始输入：${base.input}`,
    `\n【已确定的上游（保持不变，作为约束）】\n${serializeStepsForContext(upstream)}`,
    targetContent,
    `\n【用户对「${stepLabel}」这一节的反对意见】\n${disagreement}`,
    `\n请先对「${stepLabel}」表态（absorb/compromise/hold）并给理由，再按约定输出 JSON。`,
  ].join("\n");

  let content: string;
  try {
    const completion = await appAi.chat({
      messages: [
        { role: "system", content: recomputeSystemPrompt(stepLabel) },
        { role: "user", content: userContent },
      ],
      ...(user ? { viewer_user_id: user.id } : {}),
      temperature: 0.6,
    });
    content = completion.choices?.[0]?.message?.content ?? "";
  } catch (error) {
    if (error instanceof AppAIUnavailableError) {
      return NextResponse.json(
        { code: "app_ai_unavailable", message: error.message },
        { status: 402 },
      );
    }
    console.error("[recompute] AI failed", error);
    return NextResponse.json({ error: "重算失败，请重试" }, { status: 500 });
  }

  let result: AnalysisResult;
  let changeNote = "";
  try {
    const parsed = extractJson(content) as { changeNote?: string };
    changeNote = typeof parsed.changeNote === "string" ? parsed.changeNote : "";
    result = applyRecompute(base, parsed, fromStepKind, disagreement);
  } catch (error) {
    console.error("[recompute] parse failed", error, content.slice(0, 300));
    return NextResponse.json({ error: "重算结果解析失败，请重试" }, { status: 502 });
  }

  if (user) {
    try {
      await updateAnalysis(user.id, result);
      await mergeStructure(user.id, result.skeleton, result.verdict);
    } catch (error) {
      console.error("[recompute] persist failed", error);
    }
  }

  return NextResponse.json({ result, changeNote, persisted: Boolean(user) });
}
