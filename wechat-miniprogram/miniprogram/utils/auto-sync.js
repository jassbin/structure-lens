// 自动静默同步：免登录 + 本地分析 -> 云端。
// 规利：App 启动、生成结构分析、追閮重算、生成行动方案后各自动触发一次；
// 用户不用按任何同步按钮（登录/同步按钮已移除）。
const api = require("./api");
const local = require("./local");

const LOGGED_IN_KEY = "structure-lens:map-logged-in";
let sessionPromise = null;
let syncing = false;
let pending = false;

function ensureSession() {
  if (!sessionPromise) {
    sessionPromise = new Promise((resolve) => {
      wx.login({ success: () => resolve(true), fail: () => resolve(false) });
    });
  }
  return sessionPromise;
}

/** 静默同步（幂等、失败不弹窗不影响使用）。 */
function sync() {
  if (syncing) { pending = true; return Promise.resolve(); }
  syncing = true;
  return ensureSession()
    .then(() => api.syncStructureMap(local.getAllLocalAnalyses()))
    .then((res) => {
      if (res && res.analyses && res.analyses.length) {
        local.saveLocalAnalyses(res.analyses);
        local.rebuildLocalMapFrom(res.analyses);
      }
      try { wx.setStorageSync(LOGGED_IN_KEY, 1); } catch (e) { /* ignore */ }
      return res;
    })
    .catch((e) => {
      // 静默失败：数据仍在本地，下次自动重试
      console.error("[auto-sync] 失败（本地数据已保存）", e && e.message);
    })
    .finally(() => {
      syncing = false;
      if (pending) { pending = false; sync(); }
    });
}

module.exports = { sync, ensureSession, LOGGED_IN_KEY };
