// 免登录本地结构地图 + 分析持久化（wx 本地存储）。
// 逻辑与 <原作>src/lib/analysis/local-map.ts 一致：同名结构累积 hits，达阈值点亮 verified。
// 键名保持与原作相同（structure-lens:local-map / structure-lens:local-analyses），便于未来迁移。

const MAP_KEY = "structure-lens:local-map";
const ANALYSES_KEY = "structure-lens:local-analyses";
const ACTION_PLANS_KEY = "structure-lens:local-action-plans";
const ACTION_STATE_KEY = "structure-lens:local-action-state";
const VERIFY_HITS = 2;

/** 生成短 id（16 位，替代原作 crypto.randomUUID().slice(0,16)） */
function genId() {
  const t = Date.now().toString(36);
  let r = "";
  for (let i = 0; i < 4; i++) {
    r += Math.random().toString(36).slice(2);
  }
  return (t + r).slice(0, 16);
}

function verifiedConfidence(hits, base) {
  return Math.min(92, base + (hits - 1) * 8);
}

function readMap() {
  try {
    const raw = wx.getStorageSync(MAP_KEY);
    return raw ? raw : [];
  } catch {
    return [];
  }
}

function writeMap(nodes) {
  try {
    wx.setStorageSync(MAP_KEY, nodes);
  } catch {
    /* ignore quota */
  }
}

function getLocalStructureMap() {
  return readMap();
}

/** 把一次分析并入本地结构地图 */
function mergeLocalStructure(skeleton, eventTitle) {
  const nodes = readMap();
  const idx = nodes.findIndex((n) => n.name === skeleton.name);
  if (idx >= 0) {
    const found = nodes[idx];
    const events = Array.from(new Set([...(found.events || []), eventTitle]));
    const hits = (found.hits ?? (found.events || []).length) + 1;
    const verified = hits >= VERIFY_HITS && events.length >= 2;
    nodes[idx] = {
      ...found,
      events,
      hits,
      state: verified ? "verified" : "hypothesis",
      confidence: verified
        ? verifiedConfidence(hits, skeleton.confidence)
        : skeleton.confidence,
    };
  } else {
    nodes.unshift({
      id: genId(),
      name: skeleton.name,
      root: skeleton.root,
      state: "hypothesis",
      confidence: skeleton.confidence,
      events: [eventTitle],
      hits: 1,
    });
  }
  writeMap(nodes);
}

/** 本地保存整份分析（免登录时报告页可回读） */
function saveLocalAnalysis(result) {
  try {
    const raw = wx.getStorageSync(ANALYSES_KEY);
    const all = raw && typeof raw === "object" ? raw : {};
    all[result.id] = result;
    wx.setStorageSync(ANALYSES_KEY, all);
  } catch {
    /* ignore quota */
  }
}

function getLocalAnalysis(id) {
  try {
    const raw = wx.getStorageSync(ANALYSES_KEY);
    const all = raw && typeof raw === "object" ? raw : {};
    return all[id] || null;
  } catch {
    return null;
  }
}

function getAllLocalAnalyses() {
  try {
    const raw = wx.getStorageSync(ANALYSES_KEY);
    const all = raw && typeof raw === "object" ? raw : {};
    return Object.values(all);
  } catch {
    return [];
  }
}

/** 本地记忆：行动方案按 analysis id 缓存，报告重算后才清除 */
function saveLocalActionPlan(id, plan) {
  try {
    const raw = wx.getStorageSync(ACTION_PLANS_KEY);
    const all = raw && typeof raw === "object" ? raw : {};
    all[id] = plan;
    wx.setStorageSync(ACTION_PLANS_KEY, all);
  } catch {
    /* ignore quota */
  }
}

function getLocalActionPlan(id) {
  try {
    const raw = wx.getStorageSync(ACTION_PLANS_KEY);
    const all = raw && typeof raw === "object" ? raw : {};
    return all[id] || null;
  } catch {
    return null;
  }
}

function clearLocalActionPlan(id) {
  try {
    const raw = wx.getStorageSync(ACTION_PLANS_KEY);
    const all = raw && typeof raw === "object" ? raw : {};
    if (all[id]) {
      delete all[id];
      wx.setStorageSync(ACTION_PLANS_KEY, all);
    }
  } catch {
    /* ignore quota */
  }
}

function hasLocalData() {
  return readMap().length > 0;
}

/**
 * 用「全量分析」重建本地结构地图（幂等，不会重复累积 hits）。
 * 用于双向同步后：把合并后的分析集合确定性地折叠成结构节点。
 */
function rebuildLocalMapFrom(analyses) {
  const byName = new Map();
  const ordered = [...analyses].sort((a, b) =>
    (a.createdAt || "").localeCompare(b.createdAt || ""),
  );
  for (const a of ordered) {
    const sk = a.skeleton;
    if (!sk || !sk.name) continue;
    const title = a.verdict || a.input;
    const found = byName.get(sk.name);
    if (found) {
      const events = Array.from(new Set([...(found.events || []), title]));
      const hits = (found.hits ?? (found.events || []).length) + 1;
      const verified = hits >= VERIFY_HITS && events.length >= 2;
      byName.set(sk.name, {
        ...found,
        events,
        hits,
        state: verified ? "verified" : "hypothesis",
        confidence: verified
          ? verifiedConfidence(hits, sk.confidence)
          : sk.confidence,
      });
    } else {
      byName.set(sk.name, {
        id: genId(),
        name: sk.name,
        root: sk.root,
        state: "hypothesis",
        confidence: sk.confidence,
        events: [title],
        hits: 1,
      });
    }
  }
  const nodes = Array.from(byName.values()).reverse();
  writeMap(nodes);
  return nodes;
}

/** 批量把分析写入本地存储（用于云端→本地回流） */
function saveLocalAnalyses(analyses) {
  try {
    const raw = wx.getStorageSync(ANALYSES_KEY);
    const all = raw && typeof raw === "object" ? raw : {};
    for (const a of analyses || []) if (a && a.id) all[a.id] = a;
    wx.setStorageSync(ANALYSES_KEY, all);
  } catch {
    /* ignore quota */
  }
}


/** 行动方案页「本地交互态」：扫缝勾选 / 探针状态与笔记 / 四问打卡 / 归筐改判。
 *  按 analysis id 独立保存：结构未变时跨次进入仍生效；报告被追问重算后可清理。 */
function getLocalPlanState(id) {
  try {
    const raw = wx.getStorageSync(ACTION_STATE_KEY);
    const all = raw && typeof raw === "object" ? raw : {};
    return all[id] || null;
  } catch {
    return null;
  }
}

function saveLocalPlanState(id, patch) {
  if (!id) return;
  try {
    const raw = wx.getStorageSync(ACTION_STATE_KEY);
    const all = raw && typeof raw === "object" ? raw : {};
    const cur = all[id] && typeof all[id] === "object" ? all[id] : {};
    all[id] = Object.assign({}, cur, patch || {});
    wx.setStorageSync(ACTION_STATE_KEY, all);
  } catch {
    /* ignore quota */
  }
}

function clearLocalPlanState(id) {
  try {
    const raw = wx.getStorageSync(ACTION_STATE_KEY);
    const all = raw && typeof raw === "object" ? raw : {};
    if (all[id]) {
      delete all[id];
      wx.setStorageSync(ACTION_STATE_KEY, all);
    }
  } catch {
    /* ignore quota */
  }
}

module.exports = {
  MAP_KEY,
  ANALYSES_KEY,
  ACTION_PLANS_KEY,
  ACTION_STATE_KEY,
  getLocalStructureMap,
  mergeLocalStructure,
  saveLocalAnalysis,
  getLocalAnalysis,
  getAllLocalAnalyses,
  hasLocalData,
  rebuildLocalMapFrom,
  saveLocalAnalyses,
  saveLocalActionPlan,
  getLocalActionPlan,
  clearLocalActionPlan,
  getLocalPlanState,
  saveLocalPlanState,
  clearLocalPlanState,
};
