import { type NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth";
import { appAi, AppAIUnavailableError } from "@/lib/eazo-ai-billing";
import { drillSystemPrompt, type DrillMode } from "@/lib/analysis/prompt";

const MODES: DrillMode[] = ["challenge", "deeper", "counter"];

/**
 * POST /api/drill  { verdict, layerTitle, point, mode }
 * 对某一条判断继续深挖 / 质疑 / 反驳。返回一段短文本。免登录。
 */
export async function POST(request: NextRequest) {
  const user = getOptionalUser(request);
  const body = (await request.json().catch(() => ({}))) as {
    verdict?: string;
    layerTitle?: string;
    point?: string;
    mode?: string;
  };
  const point = (body.point ?? "").trim();
  const mode = (MODES.includes(body.mode as DrillMode) ? body.mode : "deeper") as DrillMode;
  if (!point) {
    return NextResponse.json({ error: "empty" }, { status: 400 });
  }

  const userMsg = [
    body.verdict ? `本次分析的核心结论：${body.verdict}` : "",
    body.layerTitle ? `所在维度：${body.layerTitle}` : "",
    `用户点中的判断：${point}`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const completion = await appAi.chat({
      messages: [
        { role: "system", content: drillSystemPrompt(mode) },
        { role: "user", content: userMsg },
      ],
      ...(user ? { viewer_user_id: user.id } : {}),
      temperature: 0.6,
    });
    const text = (completion.choices?.[0]?.message?.content ?? "").trim();
    return NextResponse.json({ text, mode });
  } catch (error) {
    if (error instanceof AppAIUnavailableError) {
      return NextResponse.json(
        { code: "app_ai_unavailable", message: error.message },
        { status: 402 },
      );
    }
    console.error("[drill] AI failed", error);
    return NextResponse.json({ error: "drill_failed" }, { status: 500 });
  }
}
