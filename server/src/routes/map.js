// 结构地图路由：GET /api/structure-map / POST import / sync（均需 openid）
// 同步/导入按 analysis id 判重，防止重复累计 hits 误点亮 verified。

const express = require("express");
const { requireUser } = require("../auth");
const {
  upsertUser,
  insertAnalysis,
  mergeStructure,
  listAllAnalysesFull,
  listStructureNodes,
} = require("../store");

const router = express.Router();

function upsertProfile(user) {
  return upsertUser({ id: user.id, email: undefined, name: undefined, avatarUrl: undefined }).catch(() => {});
}

// ---------- GET /api/structure-map ----------
router.get("/", async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const nodes = await listStructureNodes(user.id).catch(() => []);
  return res.json({ nodes });
});

// ---------- POST /api/structure-map/import ----------
router.post("/import", async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const body = req.body || {};
  const list = Array.isArray(body.analyses) ? body.analyses.slice(0, 100) : [];
  await upsertProfile(user);
  let imported = 0;
  for (const a of list) {
    try {
      await insertAnalysis(user.id, a).catch(() => {});
      await mergeStructure(user.id, a.skeleton ?? {}, a.verdict || "");
      imported += 1;
    } catch (e) {
      console.error("[import] one failed", e);
    }
  }
  return res.json({ ok: true, imported });
});

// ---------- POST /api/structure-map/sync ----------
router.post("/sync", async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const body = req.body || {};
  const local = Array.isArray(body.analyses) ? body.analyses.slice(0, 500) : [];
  await upsertProfile(user);
  const existing = await listAllAnalysesFull(user.id).catch(() => []);
  const cloudIds = new Set(existing.map((a) => a.id));
  let pushed = 0;
  for (const a of local) {
    if (!a?.id || cloudIds.has(a.id)) continue;
    try {
      await insertAnalysis(user.id, a).catch(() => {});
      await mergeStructure(user.id, a.skeleton || {}, a.verdict || "");
      cloudIds.add(a.id);
      pushed += 1;
    } catch (e) {
      console.error("[sync] push one failed", e);
    }
  }
  // pushOnly：只上传不回传全量（前端分片上传用，规避单包过大 -606001）
  if (body.pushOnly === true) {
    return res.json({ ok: true, pushed });
  }
  const cloudAll = await listAllAnalysesFull(user.id).catch(() => existing);
  return res.json({ ok: true, pushed, analyses: cloudAll });
});

module.exports = router;