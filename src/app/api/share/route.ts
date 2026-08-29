import { type NextRequest, NextResponse } from "next/server";
import { createShare } from "@/lib/db/queries/shares";
import type { StructureSkeleton } from "@/lib/analysis/types";

/**
 * POST /api/share  { input, verdict, skeleton }
 * 创建一份只读、自包含的分享快照，返回短码。免登录可用。
 * 刻意只接收骨架卡 + 金句，不接收用户身份/地图/完整步骤。
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    input?: string;
    verdict?: string;
    skeleton?: StructureSkeleton;
  };
  const input = (body.input ?? "").trim();
  const verdict = (body.verdict ?? "").trim();
  const skeleton = body.skeleton;
  if (!verdict || !skeleton || !skeleton.name) {
    return NextResponse.json({ error: "缺少可分享内容" }, { status: 400 });
  }
  try {
    const code = await createShare({ input, verdict, skeleton });
    return NextResponse.json({ code });
  } catch (error) {
    console.error("[share] create failed", error);
    return NextResponse.json({ error: "生成分享链接失败，请重试" }, { status: 500 });
  }
}
