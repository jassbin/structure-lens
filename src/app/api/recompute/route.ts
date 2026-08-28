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

/**
 * POST /api/recompute { result, fromStepKind, disagreement }
 * 用户对某一步「我不同意」→ 从该步开始重算它及所有下游步骤。
 * 上游步骤作为上下文喂给模型；免登录也可用（前端本地保存新版本）。
 */
export async function POST(request: NextRequest) {
  const user = getOptionalUser(request);

  const body = (await request.json().catch(() => ({}))) as {
    result?: AnalysisResult;
    fromStepKind?: StepKind;
    disagreement?: string;
  };
  const base = body.result;
  const fromStepKind = body.fromStepKind;
  const disagreement = (body.disagreement ?? "").trim();

  if (!base || !fromStepKind || !STEP_ORDER.includes(fromStepKind)) {
    return NextResponse.json({ error: "参数不完整" }, { status: 400 });
  }
  if (!disagreement) {
    return NextResponse.json({ error: "请先写下你的反对意见" }, { status: 400 });
  }

  const fromIdx = STEP_ORDER.indexOf(fromStepKind);
  const upstream = base.steps.filter((s) => STEP_ORDER.indexOf(s.kind) < fromIdx);
  const downstream = base.steps.filter((s) => STEP_ORDER.indexOf(s.kind) >= fromIdx);

  const stepLabel = STEP_LABELS[fromStepKind]?.zh ?? fromStepKind;

  const userContent = [
    `原始输入：${base.input}`,
    `\n【已确定的上游步骤（保持不变，作为约束）】\n${serializeStepsForContext(upstream)}`,
    `\n【需要被重算的步骤及其下游（当前版本，供参考）】\n${serializeStepsForContext(downstream)}`,
    `\n【用户对「${stepLabel}」这一步的反对意见】\n${disagreement}`,
    `\n请从「${stepLabel}」开始重算这些步骤，输出约定的 JSON。`,
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
