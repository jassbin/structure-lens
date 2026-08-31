import { type NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth";
import { appAi, AppAIUnavailableError } from "@/lib/eazo-ai-billing";
import { extractJson } from "@/lib/analysis/prompt";
import {
  ACTION_SYSTEM_PROMPT,
  normalizeActionPlan,
} from "@/lib/analysis/action";
import type { StructureSkeleton } from "@/lib/analysis/types";

/**
 * POST /api/action  { id, input, verdict, skeleton }
 * 基于一次已完成分析，用「清醒行动主义」6 步引擎生成行动方案。免登录。
 */
export async function POST(request: NextRequest) {
  const user = getOptionalUser(request);
  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    input?: string;
    verdict?: string;
    skeleton?: StructureSkeleton;
  };

  const id = (body.id ?? "").trim() || crypto.randomUUID().slice(0, 16);
  const input = (body.input ?? "").trim();
  const verdict = (body.verdict ?? "").trim();
  const sk = body.skeleton;
  if (!input && !verdict) {
    return NextResponse.json({ error: "empty" }, { status: 400 });
  }

  const userMsg = [
    `【用户的原始困惑/事件】\n${input || "(未提供)"}`,
    `【已看清的金句结论】\n${verdict || "(未提供)"}`,
    sk
      ? `【真实结构骨架】\n原本以为：${sk.perceivedAs}\n真实运作：${sk.actualStructure}\n为什么这样：${sk.whySo}\n根结构：${sk.root}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  let content: string;
  try {
    const completion = await appAi.chat({
      messages: [
        { role: "system", content: ACTION_SYSTEM_PROMPT },
        { role: "user", content: userMsg },
      ],
      ...(user ? { viewer_user_id: user.id } : {}),
      temperature: 0.7,
    });
    content = completion.choices?.[0]?.message?.content ?? "";
  } catch (error) {
    if (error instanceof AppAIUnavailableError) {
      return NextResponse.json(
        { code: "app_ai_unavailable", message: error.message },
        { status: 402 },
      );
    }
    console.error("[action] AI failed", error);
    return NextResponse.json({ error: "行动方案生成失败，请重试" }, { status: 500 });
  }

  try {
    const plan = normalizeActionPlan(extractJson(content), id);
    return NextResponse.json({ plan });
  } catch (error) {
    console.error("[action] parse failed", error, content.slice(0, 300));
    return NextResponse.json({ error: "行动方案解析失败，请重试" }, { status: 502 });
  }
}
