import { type NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth";
import { appAi, AppAIUnavailableError } from "@/lib/eazo-ai-billing";
import { WALK_FOCUS_SYSTEM_PROMPT, extractJson } from "@/lib/analysis/prompt";
import { ddgSearch, formatSearchContext } from "@/lib/analysis/search";

/**
 * POST /api/walk-focus  { direction, reason? }
 * 游走事件筛选：给一个宽泛的同构方向，联网检索后由 AI 锁定
 * "当前最火（没有则最典型）"的具体真实事件，返回具体标题 + 中性概要。
 * 免登录。拿到 title 后前端再走 /api/analyze 深挖。
 */
export async function POST(request: NextRequest) {
  const user = getOptionalUser(request);
  const body = (await request.json().catch(() => ({}))) as {
    direction?: string;
    reason?: string;
  };
  const direction = (body.direction ?? "").trim();
  if (!direction) {
    return NextResponse.json({ error: "缺少方向" }, { status: 400 });
  }

  const query = body.reason ? `${direction} ${body.reason}` : direction;
  const searchResults = await ddgSearch(query, 8).catch(() => []);

  // 搜不到就直接把方向本身当兜底目标交给前端分析
  if (searchResults.length === 0) {
    return NextResponse.json({ picked: false, title: direction, summary: "" });
  }

  try {
    const completion = await appAi.chat({
      messages: [
        { role: "system", content: WALK_FOCUS_SYSTEM_PROMPT },
        {
          role: "user",
          content: `结构同构方向：${direction}${
            body.reason ? `\n同构理由：${body.reason}` : ""
          }\n\n【检索资料】\n${formatSearchContext(searchResults)}`,
        },
      ],
      ...(user ? { viewer_user_id: user.id } : {}),
      temperature: 0.4,
    });
    const content = completion.choices?.[0]?.message?.content ?? "";
    const parsed = extractJson(content) as {
      picked?: boolean;
      title?: string;
      summary?: string;
      hotness?: string;
      reason?: string;
    };
    const title = (parsed.title ?? "").trim();
    if (!parsed.picked || !title) {
      return NextResponse.json({ picked: false, title: direction, summary: "" });
    }
    return NextResponse.json({
      picked: true,
      title,
      summary: (parsed.summary ?? "").trim(),
      hotness: parsed.hotness === "typical" ? "typical" : "hot",
      reason: (parsed.reason ?? "").trim(),
    });
  } catch (error) {
    if (error instanceof AppAIUnavailableError) {
      return NextResponse.json(
        { code: "app_ai_unavailable", message: error.message },
        { status: 402 },
      );
    }
    console.error("[walk-focus] failed", error);
    // 失败兜底：让前端用方向本身继续
    return NextResponse.json({ picked: false, title: direction, summary: "" });
  }
}
