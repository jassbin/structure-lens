import { type NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth";
import { appAi, AppAIUnavailableError } from "@/lib/eazo-ai-billing";
import { upsertUser } from "@/lib/db/queries";
import { insertAnalysis } from "@/lib/db/queries/analyses";
import { mergeStructure } from "@/lib/db/queries/structure-nodes";
import { ANALYSIS_SYSTEM_PROMPT, extractJson } from "@/lib/analysis/prompt";
import { normalizeAnalysis } from "@/lib/analysis/validate";
import { triageInput } from "@/lib/analysis/triage";
import type { SearchSource } from "@/lib/analysis/types";

function makeId(): string {
  return crypto.randomUUID().slice(0, 16);
}

/**
 * POST /api/analyze  { input, alignedSummary?, sources? }
 * 免登录：任何人都能分析。登录用户额外把结果落库并并入云端结构地图。
 * 1) 可挖掘性分诊：too_shallow / not_applicable 直接返回引导
 * 2) diggable：按方法论穿透（若带对齐概要则以概要为准）
 */
export async function POST(request: NextRequest) {
  const user = getOptionalUser(request);

  const body = (await request.json().catch(() => ({}))) as {
    input?: string;
    alignedSummary?: string;
    sources?: SearchSource[];
  };
  const input = (body.input ?? "").trim();
  const alignedSummary = (body.alignedSummary ?? "").trim();
  const sources = Array.isArray(body.sources) ? body.sources.slice(0, 6) : undefined;

  // 有对齐概要时，用概要做分诊（原始输入可能只有几个字，会被误判太浅）
  const triage = triageInput(alignedSummary || input);
  if (triage.verdict !== "diggable") {
    return NextResponse.json({ status: triage.verdict, triage });
  }

  // 以对齐后的事件概要为分析主体（若有），否则用原始输入
  const analysisTarget = alignedSummary
    ? `【已与用户确认的事件概要】\n${alignedSummary}\n\n【用户原话】\n${input}`
    : input;

  let content: string;
  try {
    const completion = await appAi.chat({
      messages: [
        { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
        { role: "user", content: analysisTarget },
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
    console.error("[analyze] AI failed", error);
    return NextResponse.json({ error: "分析失败，请重试" }, { status: 500 });
  }

  let result;
  try {
    result = normalizeAnalysis(extractJson(content), makeId(), input, {
      alignedSummary: alignedSummary || undefined,
      sources,
    });
  } catch (error) {
    console.error("[analyze] parse failed", error, content.slice(0, 300));
    return NextResponse.json({ error: "分析结果解析失败，请重试" }, { status: 502 });
  }

  // 仅登录用户云端持久化（免登录时前端本地保存）
  if (user) {
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
    }
  }

  return NextResponse.json({ status: "diggable", result, persisted: Boolean(user) });
}
