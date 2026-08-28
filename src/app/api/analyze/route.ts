import { type NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth";
import { appAi, AppAIUnavailableError } from "@/lib/eazo-ai-billing";
import { upsertUser } from "@/lib/db/queries";
import { insertAnalysis } from "@/lib/db/queries/analyses";
import { mergeStructure } from "@/lib/db/queries/structure-nodes";
import { ANALYSIS_SYSTEM_PROMPT, extractJson } from "@/lib/analysis/prompt";
import { normalizeAnalysis } from "@/lib/analysis/validate";
import { triageInput } from "@/lib/analysis/triage";
import { ddgSearch, formatSearchContext } from "@/lib/analysis/search";
import type { SearchSource } from "@/lib/analysis/types";

function makeId(): string {
  return crypto.randomUUID().slice(0, 16);
}

/**
 * POST /api/analyze  { input }
 * 免登录：任何人都能分析。登录用户额外把结果落库并并入云端结构地图。
 * 1) 可挖掘性分诊：too_shallow / not_applicable 直接返回引导
 * 2) 静默联网：后台搜一把，搜到就把资料喂给分析并附来源；搜不到直接分析（不打扰用户）
 * 3) diggable：按方法论穿透
 */
export async function POST(request: NextRequest) {
  const user = getOptionalUser(request);

  const body = (await request.json().catch(() => ({}))) as { input?: string };
  const input = (body.input ?? "").trim();

  const triage = triageInput(input);
  if (triage.verdict !== "diggable") {
    return NextResponse.json({ status: triage.verdict, triage });
  }

  // 静默联网：搜到才用（多为“具体事件”），搜不到（多为通用命题）就直接分析
  const searchResults = await ddgSearch(input, 6).catch(() => []);
  const sources: SearchSource[] | undefined =
    searchResults.length > 0
      ? searchResults.slice(0, 4).map((r) => ({ title: r.title, url: r.url }))
      : undefined;

  const analysisTarget =
    searchResults.length > 0
      ? `用户输入：${input}\n\n【联网检索到的相关资料，仅供你对齐事实，若与用户输入无关请忽略】\n${formatSearchContext(searchResults)}`
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
    result = normalizeAnalysis(extractJson(content), makeId(), input, { sources });
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
