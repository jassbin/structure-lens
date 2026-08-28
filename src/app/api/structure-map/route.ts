import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { listStructureNodes } from "@/lib/db/queries/structure-nodes";

/** GET /api/structure-map — 读取本人的结构地图节点 */
export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;

  const nodes = await listStructureNodes(auth.user.id);
  return NextResponse.json({ nodes });
}
