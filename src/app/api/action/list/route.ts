import { type NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth";
import { listActionPlans } from "@/lib/db/queries/analyses";

/**
 * GET /api/action/list
 * 登录用户：返回云端已保存行动方案的分析摘要（用于「解忧果」浏览入口）。
 * 免登录：返回空数组，前端只展示本地。
 */
export async function GET(request: NextRequest) {
  const user = getOptionalUser(request);
  if (!user) return NextResponse.json({ items: [] });
  const items = await listActionPlans(user.id).catch(() => []);
  return NextResponse.json({ items });
}
