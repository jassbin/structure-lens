import { type NextRequest, NextResponse } from "next/server";
import { getShare } from "@/lib/db/queries/shares";

/** GET /api/share/[code] —— 读取只读分享快照。免登录。 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const record = await getShare(code).catch(() => null);
  if (!record) {
    return NextResponse.json({ error: "分享不存在或已失效" }, { status: 404 });
  }
  return NextResponse.json({ share: record });
}
