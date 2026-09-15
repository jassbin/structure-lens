// 照妖镜 Structure Lens 云端服务入口（云托管容器，端口 80；本地开发 process.env.PORT||80）
// 挂载路由 + /healthz + 统一错误兜底。

const express = require("express");
const analysisRoutes = require("./src/routes/analysis");
const mapRoutes = require("./src/routes/map");
const shareRoutes = require("./src/routes/share");
const userRoutes = require("./src/routes/user");
const actionRoutes = require("./src/routes/action");
const { mysqlEnabled, startHeartbeat } = require("./src/db");
const { stat: aiStat } = require("./src/ai-client");


// [v21.4] in-memory log ring: expose runtime logs via GET /api/debug-log (no console access needed)
const RING = [];
const RING_MAX = 5000;
const ORIG_LOG = console.log;
const ORIG_ERR = console.error;
function ringLine(args) {
  try {
    const parts = Array.from(args).map((a) => {
      if (typeof a === "string") return a;
      if (typeof a === "undefined") return "undefined";
      if (a instanceof Error) return a.stack || a.message;
      try { const s = JSON.stringify(a); return s === undefined ? String(a) : s; } catch (e) { return String(a); }
    });
    RING.push(new Date().toISOString().slice(11, 23) + " " + parts.join(" ").slice(0, 600));
  } catch (e) { /* ignore */ }
  if (RING.length > RING_MAX) RING.splice(0, RING.length - RING_MAX);
}
console.log = function () { ringLine(arguments); return ORIG_LOG.apply(console, arguments); };
console.error = function () { ringLine(arguments); return ORIG_ERR.apply(console, arguments); };

const app = express();
app.use(express.json({ limit: "8mb" }));
// [v21.3] per-request log: method/path/status + masked openid (problem diagnosis without client tools)
app.use((req, res, next) => {
  const t0 = Date.now();
  res.on("finish", () => {
    const oid = String(req.headers["x-wx-openid"] || "");
    const mask = oid ? oid.slice(0, 6) + "..." + oid.slice(-4) : "-";
    console.log(
      "[req] " + req.method + " " + req.originalUrl + " " + res.statusCode +
      " " + (Date.now() - t0) + "ms openid=" + mask,
    );
  });
  next();
});

// healthz 带版本与服务特征，用于核对云端跑的是哪一版
// v10：recompute 异步化（根治"重算失败" 102002）；累计 v9 缓存查库超时兜底 + persist 8s 兜底
app.get("/healthz", (req, res) =>
  res.json({
    ok: true,
    version: "1.0.0-v21.5",
    features: {
      storage: "mysql", // v15 MySQL persistence via CynosDB 5.7
      analyze: "async", // /api/analyze 异步任务
      action: "async", //  /api/action 异步任务
      recompute: "async", // ★v10 /api/recompute 异步任务，根治"重算失败"
      actionCacheTimeoutMs: 3000, // 缓存查询 3s 超时兜底
      actionJsonMode: true,
      persistTimeoutMs: 8000,
      precheck: "bounded", // v11 precheck 预算制：搜索 3s + 摘要 2.5s，防 15s 容器超时
      searchTimeoutMs: 4200, // 检索整体限时（v13 国内双源）
      share: "mysql-fallback", // v15 share: memory instant + MySQL persist
      searchEngine: "360+sogou", // v13 国内可直连搜索替代 DuckDuckGo
    },
    dbMode: mysqlEnabled() ? "mysql" : "memory",
    model: aiStat().primary || "not-set",
    fallbackModel: aiStat().fallback,
    lastUsedModel: aiStat().lastUsedModel,
  }));

// analysis.js 内部保留完整子路径（/precheck /analyze /drill /recompute /walk-focus /analyses...）
app.use("/api", analysisRoutes);
// map/share/user/action 各挂专属前缀，内部用相对路径
app.use("/api/structure-map", mapRoutes);
app.use("/api/share", shareRoutes);
app.use("/api/user", userRoutes);
app.use("/api/action", actionRoutes);

// GET /api/debug-log : return recent runtime log ring (v21.4)
app.get("/api/debug-log", (req, res) => res.json({ ok: true, lines: RING.slice(-400) }));

// 未匹配 → 404
app.use((req, res) => {
  res.status(404).json({ error: "not_found", path: req.path });
});

// 统一兜底：任何未捕获异常返回 500
app.use((err, req, res, next) => {
  console.error("[server] unhandled", err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: "internal_error" });
});

startHeartbeat();
const PORT = Number(process.env.PORT || 8080);
app.listen(PORT, () => {
  console.log(`structure-lens server listening on :${PORT}`);
});

module.exports = app;
