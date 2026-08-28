import { type NextRequest, NextResponse } from "next/server";
import { appAi, AppAIUnavailableError } from "@/lib/eazo-ai-billing";
import { ALIGN_SYSTEM_PROMPT, extractJson } from "@/lib/analysis/prompt";
import { ddgSearch, formatSearchContext } from "@/lib/analysis/search";
import type { AlignResult, SearchSource } from "@/lib/analysis/types";

/**
 * POST /api/align  { input: string }
 * 联网搜索该事件 → AI 整理成"事件概要 + 来源"，供用户确认/修正。免登录。
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { input?: string };
  const input = (body.input ?? "").trim();
  if (!input) {
    return NextResponse.json({ error: "empty" }, { status: 400 });
  }

  const results = await ddgSearch(input, 6);

  // 联网没搜到 → 优雅降级：不让 AI 硬编"无法确认"，直接请用户手动对齐
  if (results.length === 0) {
    const align: AlignResult = {
      summary: "",
      confident: false,
      sources: [],
      questions: [],
      needsManual: true,
    };
    return NextResponse.json({ align });
  }

  const context = formatSearchContext(results);

  let content: string;
  try {
    const completion = await appAi.chat({
      messages: [
        { role: "system", content: ALIGN_SYSTEM_PROMPT },
        {
          role: "user",
          content: `用户说的事件：${input}\n\n联网搜索到的资料：\n${context}`,
        },
      ],
      temperature: 0.3,
    });
    content = completion.choices?.[0]?.message?.content ?? "";
  } catch (error) {
    if (error instanceof AppAIUnavailableError) {
      return NextResponse.json(
        { code: "app_ai_unavailable", message: error.message },
        { status: 402 },
      );
    }
    console.error("[align] AI failed", error);
    return NextResponse.json({ error: "align_failed" }, { status: 500 });
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = extractJson(content) as Record<string, unknown>;
  } catch {
    // 解析失败时兜底：直接用搜索结果拼一个概要
    const align: AlignResult = {
      summary: results[0]?.snippet || input,
      confident: false,
      sources: results.slice(0, 3).map((r) => ({ title: r.title, url: r.url })),
      questions: ["我没能完全确认这件事，能否补充一下具体的人物、时间或关键动作？"],
    };
    return NextResponse.json({ align });
  }

  const sources: SearchSource[] = Array.isArray(parsed.sources)
    ? (parsed.sources as SearchSource[]).filter((s) => s && s.title)
    : results.slice(0, 3).map((r) => ({ title: r.title, url: r.url }));

  const align: AlignResult = {
    summary: typeof parsed.summary === "string" ? parsed.summary : input,
    confident: parsed.confident === true,
    sources,
    questions: Array.isArray(parsed.questions)
      ? (parsed.questions as unknown[]).map(String).filter(Boolean)
      : [],
  };
  return NextResponse.json({ align });
}
