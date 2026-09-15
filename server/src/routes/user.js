// 用户路由：GET /api/user/profile（需 openid；upsert 用户档案）

const express = require("express");
const { requireUser } = require("../auth");
const { upsertUser } = require("../store");

const router = express.Router();

router.get("/profile", async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  upsertUser({ id: user.id, email: undefined, name: undefined, avatarUrl: undefined }).catch((err) => {
    console.error("[profile] upsertUser failed", err);
  });
  return res.json({ ok: true, user });
});

module.exports = router;