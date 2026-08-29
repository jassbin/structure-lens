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

  const body = (await request.json().catch(() => ({}))) as {
    input?: string;
    /** 来自对齐流程：用户已确认的来源，若带上则不再重复搜索 */
    alignedSources?: SearchSource[];
    /** 是否已经过用户对齐（对齐流程会传 true，跳过分诊拦截） */
    aligned?: boolean;
  };
  const input = (body.input ?? "").trim();

  const triage = triageInput(input);
  if (!body.aligned && triage.verdict !== "diggable") {
    return NextResponse.json({ status: triage.verdict, triage });
  }

  // 对齐流程已带来源则直接复用，避免重复搜索；否则静默联网（搜到才用）
  const preAligned =
    Array.isArray(body.alignedSources) && body.alignedSources.length > 0;
  const searchResults = preAligned ? [] : await ddgSearch(input, 6).catch(() => []);
  const sources: SearchSource[] | undefined = preAligned
    ? body.alignedSources
    : searchResults.length > 0
      ? searchResults.slice(0, 4).map((r) => ({ title: r.title, url: r.url }))
      : undefined;

  const sourceContext =
    searchResults.length > 0
      ? formatSearchContext(searchResults)
      : preAligned
        ? (sources ?? [])
            .map((s, i) => `[${i + 1}] ${s.title}\n来源：${s.url}`)
            .join("\n\n")
        : "";

  const analysisTarget = sourceContext
    ? `用户输入（已与用户确认）：${input}\n\n【相关来源，仅供你对齐事实，若与用户输入无关请忽略】\n${sourceContext}`
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
