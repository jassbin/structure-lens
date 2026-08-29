import { type NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth";
import { appAi, AppAIUnavailableError } from "@/lib/eazo-ai-billing";
import { ALIGN_SUMMARY_SYSTEM_PROMPT } from "@/lib/analysis/prompt";
import { triageInput } from "@/lib/analysis/triage";
import { ddgSearch, formatSearchContext } from "@/lib/analysis/search";
import type { SearchSource } from "@/lib/analysis/types";

/**
 * POST /api/precheck { input }
 * 分诊预检（分诊先搜、搜到也不直接分析、先对齐）：
 * - 输入够长（diggable）→ 直接放行，前端调 /api/analyze
 * - 输入太短/太泛 → 先静默联网搜一把：
 *     · 搜到 → 返回 { status:"align", summary, sources }，前端弹对齐卡让用户确认/纠正
 *     · 搜不到 → 返回 { status:"too_shallow"/"not_applicable", triage } 反问引导
 */
export async function POST(request: NextRequest) {
  const user = getOptionalUser(request);
  const body = (await request.json().catch(() => ({}))) as { input?: string };
  const input = (body.input ?? "").trim();

  if (!input) {
    return NextResponse.json({
      status: "too_shallow",
      triage: {
        verdict: "too_shallow",
        probes: [
          "这件事里，最让你觉得‘不对劲’的具体决定或动作是什么？",
          "涉及哪些主体？他们各自想要什么？",
        ],
      },
    });
  }

  const triage = triageInput(input);

  // 够具体：无需对齐，直接放行去分析
  if (triage.verdict === "diggable") {
    return NextResponse.json({ status: "diggable" });
  }

  // 太短/太泛：先静默搜一把，用搜索结果决定走对齐还是反问
  const searchResults = await ddgSearch(input, 6).catch(() => []);

  // 搜不到 → 维持原反问/引导
  if (searchResults.length === 0) {
    return NextResponse.json({ status: triage.verdict, triage });
  }

  // 搜到了 → 生成中性事实概要，供用户确认/纠正
  const sources: SearchSource[] = searchResults
    .slice(0, 4)
    .map((r) => ({ title: r.title, url: r.url }));

  let summary = "";
  try {
    const completion = await appAi.chat({
      messages: [
        { role: "system", content: ALIGN_SUMMARY_SYSTEM_PROMPT },
        {
          role: "user",
          content: `用户输入：${input}\n\n【检索资料】\n${formatSearchContext(searchResults)}`,
        },
      ],
      ...(user ? { viewer_user_id: user.id } : {}),
      temperature: 0.3,
    });
    summary = completion.choices?.[0]?.message?.content?.trim() ?? "";
  } catch (error) {
    if (error instanceof AppAIUnavailableError) {
      return NextResponse.json(
        { code: "app_ai_unavailable", message: error.message },
        { status: 402 },
      );
    }
    console.error("[precheck] summary failed", error);
    // 概要失败不阻断：退回反问引导
    return NextResponse.json({ status: triage.verdict, triage });
  }

  if (!summary) {
    return NextResponse.json({ status: triage.verdict, triage });
  }

  return NextResponse.json({ status: "align", input, summary, sources });
}
