// 数据查询层 —— MySQL 版（替代云开发文档库，表在 init-db 里建好）
// 表：users / analyses / structure_nodes / shares。JSON 字段以 TEXT 存储。

const { query, mysqlEnabled, ping } = require("./db");

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-6);
}

// 仅当 MySQL 未启用时，本地开发仍可跑通（内存集，行为近似）
const mem = { users: new Map(), analyses: new Map(), nodes: [], shares: new Map() };

function j(v) {
  return v === undefined || v === null ? null : JSON.stringify(v);
}
function u(v) {
  return v === null || v === undefined ? undefined : v;
}

// ---------- users ----------
async function upsertUser(data) {
  const now = Date.now();
  if (!mysqlEnabled()) {
    mem.users.set(data.id, {
      id: data.id,
      email: data.email ?? null,
      name: data.name ?? null,
      avatarUrl: data.avatarUrl ?? null,
      updatedAt: now,
    });
    return { ...mem.users.get(data.id) };
  }
  await query_(
    "INSERT INTO users (id,email,name,avatar_url,created_at,updated_at) VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE email=VALUES(email),name=VALUES(name),avatar_url=VALUES(avatar_url),updated_at=VALUES(updated_at)",
    [data.id, data.email ?? null, data.name ?? null, data.avatarUrl ?? null, now, now],
  );
  return { id: data.id, email: data.email, name: data.name, avatarUrl: data.avatarUrl, updatedAt: now };
}

async function getUserById(id) {
  if (!mysqlEnabled()) return mem.users.get(id);
  const [rows] = await query_("SELECT * FROM users WHERE id=? LIMIT 1", [id]);
  if (!rows.length) return undefined;
  return rowToUser(rows[0]);
}

function rowToUser(r) {
  return { id: r.id, email: u(r.email), name: u(r.name), avatarUrl: u(r.avatar_url), updatedAt: r.updated_at };
}

// ---------- analyses ----------
async function insertAnalysis(userId, result) {
  const now = Date.now();
  if (!mysqlEnabled()) {
    mem.analyses.set(result.id, {
      id: result.id,
      userId,
      input: result.input,
      version: result.version,
      sources: result.sources ?? null,
      verdict: result.verdict,
      steps: result.steps,
      skeleton: result.skeleton,
      walkHooks: result.walkHooks,
      revisions: result.revisions ?? null,
      actionPlan: null,
      createdAt: now,
    });
    return;
  }
  await query_(
    "INSERT IGNORE INTO analyses (id,user_id,input,version,sources,verdict,steps,skeleton,walk_hooks,revisions,action_plan,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
    [
      result.id,
      userId,
      result.input ?? null,
      result.version ?? null,
      j(result.sources),
      result.verdict ?? null,
      j(result.steps),
      j(result.skeleton),
      j(result.walkHooks),
      j(result.revisions),
      j(result.actionPlan ?? null),
      now,
    ],
  );
}

async function updateAnalysis(userId, result) {
  if (!mysqlEnabled()) {
    const a = mem.analyses.get(result.id);
    if (a && a.userId === userId) Object.assign(a, { version: result.version, verdict: result.verdict, steps: result.steps, skeleton: result.skeleton, revisions: result.revisions ?? null });
    return;
  }
  await query_(
    "UPDATE analyses SET version=?,verdict=?,steps=?,skeleton=?,revisions=? WHERE id=? AND user_id=?",
    [result.version ?? null, result.verdict ?? null, j(result.steps), j(result.skeleton), j(result.revisions), result.id, userId],
  );
}

async function getAnalysisById(userId, id) {
  if (!mysqlEnabled()) {
    const a = mem.analyses.get(id);
    return a && a.userId === userId ? toAnalysisResult(a) : null;
  }
  const [rows] = await query_("SELECT * FROM analyses WHERE id=? AND user_id=? LIMIT 1", [id, userId]);
  if (!rows.length) return null;
  return toAnalysisResult(rowToAnalysis(rows[0]));
}

function rowToAnalysis(r) {
  return {
    id: r.id,
    userId: r.user_id,
    input: r.input,
    version: r.version,
    sources: JSON.parse(r.sources || "null"),
    verdict: r.verdict,
    steps: JSON.parse(r.steps || "null"),
    skeleton: JSON.parse(r.skeleton || "null"),
    walkHooks: JSON.parse(r.walk_hooks || "null"),
    revisions: JSON.parse(r.revisions || "null"),
    actionPlan: JSON.parse(r.action_plan || "null"),
    createdAt: r.created_at,
  };
}

function toAnalysisResult(row) {
  return {
    id: row.id,
    input: row.input,
    version: row.version,
    sources: row.sources ?? undefined,
    verdict: row.verdict,
    steps: row.steps,
    skeleton: row.skeleton,
    walkHooks: row.walkHooks,
    revisions: row.revisions ?? undefined,
    actionPlan: row.actionPlan ?? undefined,
    createdAt: new Date(row.createdAt || Date.now()).toISOString(),
  };
}

async function listRecentAnalyses(userId, limit = 20) {
  if (!mysqlEnabled()) {
    return Array.from(mem.analyses.values())
      .filter((a) => a.userId === userId)
      .slice(-limit)
      .reverse()
      .map((r) => ({ id: r.id, input: r.input, verdict: r.verdict, createdAt: new Date(r.createdAt).toISOString() }));
  }
  const [rows] = await query_("SELECT * FROM analyses WHERE user_id=? ORDER BY created_at DESC LIMIT ?", [userId, limit]);
  return rows.map((r) => ({ id: r.id, input: r.input, verdict: r.verdict, createdAt: new Date(r.created_at).toISOString() }));
}

async function saveActionPlan(userId, analysisId, plan) {
  if (!mysqlEnabled()) {
    const a = mem.analyses.get(analysisId);
    if (a && a.userId === userId) a.actionPlan = plan;
    return;
  }
  await query_("UPDATE analyses SET action_plan=? WHERE id=? AND user_id=?", [j(plan), analysisId, userId]);
}

async function getActionPlanById(userId, analysisId) {
  if (!mysqlEnabled()) {
    const a = mem.analyses.get(analysisId);
    return a && a.userId === userId ? a.actionPlan ?? null : null;
  }
  const [rows] = await query_("SELECT action_plan FROM analyses WHERE id=? AND user_id=? LIMIT 1", [analysisId, userId]);
  if (!rows.length) return null;
  return JSON.parse(rows[0].action_plan || "null");
}

async function listActionPlans(userId, limit = 200) {
  if (!mysqlEnabled()) {
    return Array.from(mem.analyses.values())
      .filter((a) => a.userId === userId && a.actionPlan)
      .slice(-limit)
      .reverse()
      .map((r) => ({ id: r.id, input: r.input, verdict: r.verdict, headline: r.actionPlan.headline ?? "", createdAt: new Date(r.createdAt).toISOString() }));
  }
  const [rows] = await query_(
    "SELECT id,input,verdict,action_plan,created_at FROM analyses WHERE user_id=? AND action_plan IS NOT NULL ORDER BY created_at DESC LIMIT ?",
    [userId, limit],
  );
  return rows.map((r) => {
    const plan = JSON.parse(r.action_plan || "null");
    return { id: r.id, input: r.input, verdict: r.verdict, headline: (plan && plan.headline) || "", createdAt: new Date(r.created_at).toISOString() };
  });
}

async function listAllAnalysesFull(userId, limit = 500) {
  if (!mysqlEnabled()) {
    return listAllAnalysesFullMem(userId);
  }
  const [rows] = await query_("SELECT * FROM analyses WHERE user_id=? ORDER BY created_at DESC LIMIT ?", [userId, limit]);
  return rows.map((r) => toAnalysisResult(rowToAnalysis(r)));
}

function listAllAnalysesFullMem(userId) {
  return Array.from(mem.analyses.values())
    .filter((a) => a.userId === userId)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(toAnalysisResult);
}

async function deleteAnalysis(userId, id) {
  if (!mysqlEnabled()) {
    const a = mem.analyses.get(id);
    if (a && a.userId === userId) mem.analyses.delete(id);
    return;
  }
  await query_("DELETE FROM analyses WHERE id=? AND user_id=?", [id, userId]);
}

// ---------- structure_nodes ----------
async function mergeStructure(userId, skeleton, eventTitle) {
  const name = skeleton && skeleton.name;
  if (!name) return;
  if (!mysqlEnabled()) {
    const idx = mem.nodes.findIndex((n) => n.userId === userId && n.name === name);
    const base = { id: uid(), userId, name, root: skeleton.root, state: "hypothesis", confidence: skeleton.confidence || 60, events: [], hits: 0, createdAt: Date.now(), updatedAt: Date.now() };
    if (idx >= 0) {
      const node = mem.nodes[idx];
      const events = Array.from(new Set([...(node.events || []), eventTitle]));
      const hits = (node.hits || 0) + 1;
      const verified = hits >= 2 && events.length >= 2;
      mem.nodes[idx] = Object.assign(node, {
        events,
        hits,
        state: verified ? "verified" : "hypothesis",
        confidence: verified ? Math.min(92, (skeleton.confidence || 60) + (hits - 1) * 8) : skeleton.confidence || node.confidence || 60,
        updatedAt: Date.now(),
      });
    } else {
      base.events = [eventTitle];
      base.hits = 1;
      mem.nodes.unshift(base);
    }
    return;
  }
  const [rows] = await query_("SELECT * FROM structure_nodes WHERE user_id=? AND name=? LIMIT 1", [userId, name]);
  if (rows.length) {
    const node = rows[0];
    const events = Array.from(new Set([...(JSON.parse(node.events || "[]")), eventTitle]));
    const hits = (node.hits || 0) + 1;
    const verified = hits >= 2 && events.length >= 2;
    await query_(
      "UPDATE structure_nodes SET events=?,hits=?,state=?,confidence=?,updated_at=? WHERE id=?",
      [
        JSON.stringify(events),
        hits,
        verified ? "verified" : "hypothesis",
        verified ? Math.min(92, (skeleton.confidence || 60) + (hits - 1) * 8) : skeleton.confidence || 60,
        Date.now(),
        node.id,
      ],
    );
  } else {
    await query_(
      "INSERT INTO structure_nodes (id,user_id,name,root,state,confidence,events,hits,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
      [uid(), userId, name, skeleton.root || null, "hypothesis", skeleton.confidence || 60, JSON.stringify([eventTitle]), 1, Date.now(), Date.now()],
    );
  }
}

async function listStructureNodes(userId) {
  if (!mysqlEnabled()) {
    return mem.nodes
      .filter((n) => n.userId === userId)
      .map((r) => ({ id: r.id, name: r.name, root: r.root, state: r.state, confidence: r.confidence, events: r.events || [], hits: r.hits || 0 }));
  }
  const [rows] = await query_("SELECT * FROM structure_nodes WHERE user_id=? ORDER BY created_at DESC LIMIT 500", [userId]);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    root: r.root,
    state: r.state,
    confidence: r.confidence,
    events: JSON.parse(r.events || "[]"),
    hits: r.hits || 0,
  }));
}

// ---------- shares ----------
// 内存优先保证“分享秒成”，后台尽力落库；DB 恢复后自动补位。
const shareMemory = new Map();

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

function makeCode() {
  let s = "";
  const alpha = "abcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 8; i++) s += alpha[Math.floor(Math.random() * alpha.length)];
  return s;
}

async function createShare(snapshot) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeCode();
    if (shareMemory.has(code)) continue;
    const row = {
      id: code,
      type: snapshot.type || "report",
      input: snapshot.input,
      verdict: snapshot.verdict,
      skeleton: snapshot.skeleton,
      steps: snapshot.steps || null,
      actionPlan: snapshot.actionPlan,
      headline: snapshot.headline || null,
      createdAt: Date.now(),
    };
    shareMemory.set(code, row);
    if (shareMemory.size > 2000) {
      const oldest = shareMemory.keys().next().value;
      if (oldest) shareMemory.delete(oldest);
    }
    persistShareRow(row).catch(() => {});
    return code;
  }
  throw new Error("failed to allocate share code");
}

async function persistShareRow(row) {
  if (!mysqlEnabled()) return;
  try {
    await withTimeout(
      query_(
        "INSERT IGNORE INTO shares (id,type,input,verdict,skeleton,steps,action_plan,headline,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
        [row.id, row.type, row.input ?? null, row.verdict ?? null, j(row.skeleton), j(row.steps), j(row.actionPlan), row.headline ?? null, row.createdAt],
      ),
      3000,
    );
  } catch (e) {
    console.error("[share] db add failed", e && e.message);
  }
}

async function getShare(code) {
  const mem = shareMemory.get(code);
  if (mem) return formatShare(mem);
  if (!mysqlEnabled()) return null;
  try {
    const [rows] = await withTimeout(query_("SELECT * FROM shares WHERE id=? LIMIT 1", [code]), 5000);
    if (rows && rows.length) {
      const share = formatShare(rowToShare(rows[0]));
      shareMemory.set(code, rows[0]);
      return share;
    }
  } catch (e) {
    console.error("[share] db get failed", e && e.message);
  }
  return null;
}

function rowToShare(r) {
  return {
    id: r.id,
    type: r.type || "report",
    input: r.input,
    verdict: r.verdict,
    skeleton: JSON.parse(r.skeleton || "null"),
    steps: JSON.parse(r.steps || "null"),
    actionPlan: JSON.parse(r.action_plan || "null"),
    headline: u(r.headline),
    createdAt: r.created_at,
  };
}

function formatShare(row) {
  return {
    code: row.id,
    type: row.type || "report",
    input: row.input,
    verdict: row.verdict,
    skeleton: row.skeleton,
    steps: row.steps ?? undefined,
    actionPlan: row.actionPlan,
    headline: row.headline ?? undefined,
    createdAt: new Date(row.createdAt || Date.now()).toISOString(),
  };
}

// 包装 query 使之同时可用于内存兜底分支（未启用 mysql 时仅内存路径调用 query_ 的应返回 undefined）
async function query_(sql, params) {
  const { query: q } = require("./db");
  return q(sql, params);
}

module.exports = {
  upsertUser,
  getUserById,
  insertAnalysis,
  updateAnalysis,
  getAnalysisById,
  listRecentAnalyses,
  saveActionPlan,
  getActionPlanById,
  listActionPlans,
  listAllAnalysesFull,
  mergeStructure,
  listStructureNodes,
  createShare,
  getShare,
};
