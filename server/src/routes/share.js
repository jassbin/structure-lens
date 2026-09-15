// 分享路由：POST /api/share / GET /api/share/:code
// 自包含快照（input/verdict/skeleton 或 actionPlan），不持股与地图。免登录。
// type: 'report'（默认，结构报告） | 'action'（行动方案）

const express = require("express");
const { createShare, getShare } = require("../store");

const router = express.Router();

router.post("/", async (req, res) => {
  const body = req.body || {};
  const type = String(body.type || "report").trim();
  const input = String(body.input ?? "").trim();
  const verdict = String(body.verdict ?? "").trim();
  const skeleton = body.skeleton;
  const steps = Array.isArray(body.steps) ? body.steps.slice(0, 12) : undefined;
  const actionPlan = body.actionPlan || body.plan;
  const headline = String(body.headline ?? "").trim();

  if (type === "action") {
    if (!actionPlan || !actionPlan.headline) {
      return res.status(400).json({ error: "缺少可分享的行动方案" });
    }
    try {
      const code = await createShare({ type, input, verdict, skeleton, actionPlan, headline: actionPlan.headline || headline });
      return res.json({ code });
    } catch (e) {
      console.error("[share] create action failed", e);
      return res.status(500).json({ error: "生成分享链接失败，请重试" });
    }
  }

  if (!verdict || !skeleton || !skeleton.name) {
    return res.status(400).json({ error: "缺少可分享内容" });
  }
  try {
    const code = await createShare({ type: "report", input, verdict, skeleton, steps });
    return res.json({ code });
  } catch (e) {
    console.error("[share] create failed", e);
    return res.status(500).json({ error: "生成分享链接失败，请重试" });
  }
});

router.get("/:code", async (req, res) => {
  const share = await getShare(req.params.code).catch(() => null);
  if (!share) return res.status(404).json({ error: "not_found" });
  return res.json({ share });
});

module.exports = router;
