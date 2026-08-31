import { type NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth";
import { appAi, AppAIUnavailableError } from "@/lib/eazo-ai-billing";
import { extractJson } from "@/lib/analysis/prompt";
import {
  ACTION_STEP_ORDER,
  actionRecomputeSystemPrompt,
  applyActionRecompute,
  type ActionPlan,
  type ActionStepKey,
} from "@/lib/analysis/action";
import { saveActionPlan } from "@/lib/db/queries/analyses";

/**
 * POST /api/action/recompute { plan, fromStepKey, objection }
 * 行动页某一节「我不同意/追问」→ AI 表态(absorb/compromise/hold)+理由/回答，
 * 仅吸收/折中才重算该步及其线性下游。锁定既有视角，不改判角色。免登录。
 */
export async function POST(request: NextRequest) {
  const user = getOptionalUser(request);
  const body = (await request.json().catch(() => ({}))) as {
    plan?: ActionPlan;
    fromStepKey?: ActionStepKey;
    objection?: string;
  };

  const base = body.plan;
  const fromStepKey = body.fromStepKey;
  const objection = (body.objection ?? "").trim();

  if (!base || !fromStepKey || !ACTION_STEP_ORDER.includes(fromStepKey)) {
    return NextResponse.json({ error: "参数不完整" }, { status: 400 });
  }
  if (!objection) {
    return NextResponse.json({ error: "请先写下你的反驳或追问" }, { status: 400 });
  }

  const userMsg = [
    `【行动方案的视角】${base.perspective.label}（id=${base.perspective.id}）`,
    `【被质疑这一节及下游的当前内容（供参考）】\n${JSON.stringify(base.steps, null, 2)}`,
    `【用户对这一节的反驳/追问】\n${objection}`,
  ].join("\n\n");

  let content: string;
  try {
    const completion = await appAi.chat({
      messages: [
        {
          role: "system",
          content: actionRecomputeSystemPrompt(fromStepKey, base.perspective),
        },
        { role: "user", content: userMsg },
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
    console.error("[action/recompute] AI failed", error);
    return NextResponse.json({ error: "重算失败，请重试" }, { status: 500 });
  }

  try {
    const parsed = extractJson(content);
    const { plan, stance, changeNote } = applyActionRecompute(
      base,
      parsed,
      fromStepKey,
      objection,
    );
    if (user) {
      await saveActionPlan(user.id, plan.id, plan).catch((e) =>
        console.error("[action/recompute] persist failed", e),
      );
    }
    return NextResponse.json({ plan, stance, changeNote, persisted: Boolean(user) });
  } catch (error) {
    console.error("[action/recompute] parse failed", error, content.slice(0, 300));
    return NextResponse.json({ error: "重算结果解析失败，请重试" }, { status: 502 });
  }
}
