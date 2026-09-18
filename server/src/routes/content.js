const express = require("express");
const { listContents, getContent } = require("../contents");
const router = express.Router();

// GET /api/contents 列表（免登录）：近 7 天滚动，仅元信息
router.get("/", async (req, res) => {
  const items = await listContents().catch(() => []);
  res.json({ items });
});

// GET /api/contents/:id 详情（免登录）：含完整拆解 result
router.get("/:id", async (req, res) => {
  const c = await getContent(String(req.params.id || "").trim()).catch(() => null);
  if (!c) return res.status(404).json({ error: "not_found" });
  res.json({ content: c });
});

module.exports = router;
