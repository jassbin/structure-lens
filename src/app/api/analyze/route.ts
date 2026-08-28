import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { appAi, AppAIUnavailableError } from "@/lib/eazo-ai-billing";
import { upsertUser } from "@/lib/db/queries";
import { insertAnalysis } from "@/lib/db/queries/analyses";
import { mergeStructure } from "@/lib/db/queries/structure-nodes";
import { ANALYSIS_SYSTEM_PROMPT, extractJson } from "@/lib/analysis/prompt";
import { normalizeAnalysis } from "@/lib/analysis/validate";
import { triageInput } from "@/lib/analysis/triage";

function makeId(): string {
  return crypto.randomUUID().slice(0, 16);
}

/**
 * POST /api/analyze  { input: string }
 * 1) 可挖掘性分诊：too_shallow / not_applicable 直接返回引导，不消耗 AI
 * 2) diggable：调用 AI 按方法论穿透，规整、存库、并入结构地图
 */
export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const body = (await request.json().catch(() => ({}))) as { input?: string };
  const input = (body.input ?? "").trim();

  const triage = triageInput(input);
  if (triage.verdict !== "diggable") {
    return NextResponse.json({ status: triage.verdict, triage });
  }

  let content: string;
  try {
    const completion = await appAi.chat({
      messages: [
        { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
        { role: "user", content: input },
      ],
      viewer_user_id: user.id,
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
    console.error("[analyze] AI failed", error);
    return NextResponse.json({ error: "分析失败，请重试" }, { status: 500 });
  }

  let result;
  try {
    result = normalizeAnalysis(extractJson(content), makeId(), input);
  } catch (error) {
    console.error("[analyze] parse failed", error, content.slice(0, 300));
    return NextResponse.json({ error: "分析结果解析失败，请重试" }, { status: 502 });
  }

  // 确保用户存在（外键），再持久化 + 并入结构地图
  await upsertUser({
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
  }).catch(() => {});

  try {
    await insertAnalysis(user.id, result);
    await mergeStructure(user.id, result.skeleton, result.verdict);
  } catch (error) {
    console.error("[analyze] persist failed", error);
    // 持久化失败不阻断用户拿到结果
  }

  return NextResponse.json({ status: "diggable", result });
}
