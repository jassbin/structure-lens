// 网络层：wx.cloud.callContainer 封装 + 照原作 src/lib/api/analysis.ts 的全部 15 个 API 方法
// 云托管自动注入 x-wx-openid，免登录链路无需任何认证头。

// 注意：本模块顶层不能依赖 getApp()！app.js 的 onLaunch 会同步 require 本模块，
// 而在 App onLaunch 执行期间 getApp() 可能返回 undefined；一旦模块级 app 被缓存为 undefined，
// 后续每一次请求都会在读取配置时同步崩溃 —— 表现正是“诊断为空、后端收不到请求”。
// 容器环境/服务名是固定常量，直接在此声明（需与 app.js 保持一致）；运行时状态才用 getApp()。
const CONTAINER_ENV_ID = "prod-d8gvfrnwzd049d403"; // 与 app.js 保持一致
const CONTAINER_NAME = "structure-lens";           // 与 app.js 保持一致
function sdkVersionLazy() {
  try {
    const a = typeof getApp === "function" ? getApp() : null;
    return ((a && a.globalData && a.globalData.sdkVersion) || "");
  } catch (e) { return ""; }
}


// ---- 轻量请求诊断：记录最近 50 次调用（home 页长按版本号可查看，用于定位失败现场） ----
const DIAG_LOG = [];
function diagPush(entry) {
  DIAG_LOG.push(entry);
  if (DIAG_LOG.length > 50) DIAG_LOG.shift();
}
function getDiag() {
  return DIAG_LOG.slice();
}

/**
 * 统一调用云容器。
 * @param {string} fullPath 例如 "/api/analyze"（云托管根路径 + 服务端挂载前缀 /api）
 * @param {object} data 请求体
 * @param {string} method 默认 POST
 * @returns {Promise<any>} 解析后的 JSON；HTTP 非 2xx 抛错（含 ai_failed）
 */
function callApi(fullPath, data = {}, method = "POST") {
  const t0 = Date.now();
  // 诊断第一行：无论后续成败，先记“请求已开始”。长按弹窗里：
  // 连 BEGIN 都没有 → callApi 没走到；只有 BEGIN → 卡在调用栈；
  // 有 pre-fail → 云能力/基础库不可用；有 ok/fail/http-err → 网络链路已通到。
  diagPush({
    t: t0,
    phase: "begin",
    path: fullPath,
    sdk: sdkVersionLazy(),
    cloud: !!(wx.cloud && wx.cloud.callContainer),
  });
  return new Promise((resolve, reject) => {
    // 前置检查：wx.cloud.callContainer 不存在时是“同步抛错”，不会进 success/fail，
    // 这正是“暂无请求记录再后端也收不到”的典型来源。现在显式检查并记录。
    if (!wx.cloud || typeof wx.cloud.callContainer !== "function") {
      const errMsg = !wx.cloud
        ? "wx.cloud 不存在（基础库过旧/未开通云能力），请求未发出"
        : "wx.cloud.callContainer 不存在（基础库过旧），请求未发出";
      diagPush({ t: Date.now(), phase: "pre-fail", path: fullPath, status: 0, ms: Date.now() - t0, err: errMsg });
      const e = new Error(errMsg);
      e.preflight = true;
      reject(e);
      return;
    }
    try {
      wx.cloud.callContainer({
        config: {
          env: CONTAINER_ENV_ID, // 微信云托管环境 ID（非小程序云开发 envId）
        },
        path: fullPath,
        method,
        data,
        header: {
          "content-type": "application/json",
          "X-WX-SERVICE": CONTAINER_NAME, // 云托管服务名，必须带
        },
        success: (res) => {
          const code = res.statusCode || 0;
          diagPush({ t: Date.now(), phase: "ok", path: fullPath, status: code, ms: Date.now() - t0 });
          let body = res.data;
          // 云容器 body 可能是字符串或对象
          if (typeof body === "string") {
            try {
              body = JSON.parse(body);
            } catch {
              /* 保留原样 */
            }
          }
          if (code >= 200 && code < 300) {
            resolve(body);
          } else {
            const msg = (body && (body.error || body.message)) || ("HTTP " + code);
            diagPush({ t: Date.now(), phase: "http-err", path: fullPath, status: code, ms: Date.now() - t0, err: String(msg).slice(0, 80) });
            const err = new Error(msg);
            err.status = code;
            err.body = body;
            reject(err);
          }
        },
        fail: (err) => {
          // 网络/云调用失败（此处开始才是真正有网络动作）
          diagPush({ t: Date.now(), phase: "fail", path: fullPath, status: 0, ms: Date.now() - t0, err: String((err && (err.errMsg || err.message)) || "cloud_fail").slice(0, 80) });
          const e = new Error((err && (err.errMsg || err.message)) || "云服务调用失败");
          e.raw = err;
          reject(e);
        },
      });
    } catch (syncErr) {
      // 同步异常（调用本身抛出）：记录真实原因
      const msg = String((syncErr && (syncErr.message || syncErr.errMsg)) || syncErr).slice(0, 80);
      diagPush({ t: Date.now(), phase: "sync-err", path: fullPath, status: 0, ms: Date.now() - t0, err: msg });
      const e = new Error("云调用异常：" + msg);
      e.raw = syncErr;
      reject(e);
    }
  });
}

/**
 * 带重试的 callApi：冷启动/503/超时等瞬时抖动自动再试一次（治标；与云托管最小实例=1的治本配合）。
 * 仅对 502/503/504、网络失败、超时重试；业务错误（400/422/500 ai_failed 等）不重试，立即上抛。
 */
function callApiRetry(fullPath, data = {}, method = "POST") {
  // 冷启动/503/网络抖动自动重试，最多 3 次（首次 1.2s、二次 3.2s 退避）。
  // 云托管实例从 0 冷启动常需数秒，单次重试往往不够，3 次覆盖绝大多数情况。
  let attempt = 0;
  const attemptFn = () => {
    attempt += 1;
    return callApi(fullPath, data, method).catch((e) => {
      const status = e && e.status;
      const msg = String((e && (e.message || e.errMsg)) || "");
      // 5xx 一律按瞬时重试（含 500：冷启动/DB 未就绪时后端会返 500，不能直接判失败）
      const retriable =
        !status || status >= 500 || status === 408 || status === 429 || /timeout|timed-?out|超时/iu.test(msg);
      if (retriable && attempt < 3) {
        const wait = attempt === 1 ? 1200 : 3200;
        return new Promise((resolve) => setTimeout(resolve, wait)).then(attemptFn);
      }
      throw e;
    });
  };
  return attemptFn();
}

function apiErrorToast(e, fallback = "操作失败，请稍后再试") {
  // 让真实失败原因能看得到，别被笼统文案盖住。超时/网错/服务端分别给明确提示。
  let msg = (e && (e.message || e.errMsg)) || fallback;
  const m = String(msg);
  if (/timeout|timed?-?out|超时/iu.test(m)) {
    msg = "分析超时，请稍后再试";
  } else if (e && e.status === 502) {
    msg = "服务暂时不可用，请稍后重试";
  } else if (m.length > 15) {
    msg = fallback;
  }
  console.error("[api] 调用失败", e);
  wx.showToast({ title: msg.length > 15 ? fallback : msg, icon: "none" });
}

/** 预热：弹一次轻量端点，把云托管实例提前拉起，降低首次冷启动等待。 */
function warm() {
  return callApi("/healthz", {}, "GET").catch(() => null);
}

// ---- 类型占位（小程序无 TS，形状对齐 <原作>src/lib/api/analysis.ts） ----

/** 分诊预检（v21.17）：每次点击都联网核对一次；round=第几轮追问（防死循环安全阀）。免登录。 */
async function precheck(input, opts) {
  return callApiRetry("/api/precheck", { input, ...(opts || {}) });
}

/** 提交事件做深度分析。可带对齐后的来源（跳过分诊与重复搜索）。免登录。
 * 重要：分析耗时可达 30s+，远超 wx.cloud.callContainer 的 15s 硬超时，
 * 因此走「异步提交 task + 轮询」方案，内部自动轮询直到完成/超时。
 * 返回结构对齐旧版：成功时 {status:'diggable', result, …}。
 */
async function analyze(input, opts) {
  const payload = { input, ...(opts || {}) };
  const accept = await callApiRetry("/api/analyze", payload);
  if (accept && accept.status === "diggable") {
    return accept; // 兼容：极个别直接返回结果的分支
  }
  if (!accept || !accept.taskId) {
    throw new Error("analyze submit failed");
  }
  const taskId = accept.taskId;
  const deadline = Date.now() + 150 * 1000; // 最多等 150s（AI 冷启动/切换兜底通道时 60-120s 属正常）
  const step = 1000; // v21.6: 1s 轮询，结果准时拿到
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, step));
    const poll = await callApiRetry(
      `/api/analyses/${encodeURIComponent(taskId)}/poll`,
      {},
      "GET",
    );
    if (opts && typeof opts.onProgress === "function") opts.onProgress(poll);
    if (!poll) continue;
    if (poll.done) {
      if (poll.error) {
        const e = new Error(poll.error || "ai_failed");
        e.status = 502;
        throw e;
      }
      const result = poll.result;
      return {
        status: "diggable",
        result,
        id: result && result.id,
      };
    }
    // 未完成继续轮询
  }
  const t = new Error("分析超时，请稍后重试");
  t.status = 408;
  throw t;
}

/** 游走事件筛选：给宽泛同构方向，联网锁定最热/最典型具体事件。免登录。 */
async function walkFocus(payload) {
  return callApiRetry("/api/walk-focus", payload);
}

/** 对某一条判断继续深挖 / 质疑 / 反驳。返回文本。免登录。 */
async function drill(payload) {
  const data = await callApiRetry("/api/drill", payload);
  return data.text;
}

/** 「我不同意」：从某步开始重算下游。免登录。
 * 后端 /api/recompute 已异步化（POST 秒回 taskId，后台跑 AI），这里提交后轮询，
 * 避免同步调用撞 wx.cloud.callContainer 15s 超时（102002 → 前端"重算失败"）。
 * 返回 { result, changeNote, persisted }。
 */
async function recompute(payload, onProgress) {
  const accept = await callApiRetry("/api/recompute", payload);
  if (!accept || !accept.taskId) {
    throw new Error("recompute submit failed");
  }
  const taskId = accept.taskId;
  const deadline = Date.now() + 120 * 1000; // 重算一般 10-40s（骨架卡/早期步骤会整篇重推），给足 120s
  const step = 1000; // v21.7: 统一 1s 轮询
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, step));
    const poll = await callApiRetry(
      `/api/analyses/${encodeURIComponent(taskId)}/poll`,
      {},
      "GET",
    );
    if (typeof onProgress === "function") onProgress(poll);
    if (!poll) continue;
    if (poll.done) {
      if (poll.error) {
        const e = new Error(poll.error || "ai_failed");
        e.status = 502;
        throw e;
      }
      return poll.result;
    }
  }
  const t = new Error("分析超时，请稍后重试");
  t.status = 408;
  throw t;
}

/** 读取某次分析（云端）。免登录。 */
async function getAnalysis(id) {
  try {
    const data = await callApiRetry(`/api/analyses/${encodeURIComponent(id)}`, {}, "GET");
    return data.result || null;
  } catch (e) {
    if (e && e.status === 404) return null;
    throw e;
  }
}

/** 读取结构地图节点。免登录无 openid 时返回空。 */
async function getStructureMap() {
  const data = await callApiRetry("/api/structure-map", {}, "GET");
  return (data && data.nodes) || [];
}

/** 今日拆解列表（免登录）：近 7 天滚动，仅卡片元信息。失败返回空数组，不阻塞页面。 */
async function getContents() {
  try {
    const data = await callApiRetry("/api/contents", {}, "GET");
    return (data && data.items) || [];
  } catch (e) {
    return [];
  }
}

/** 今日拆解详情（免登录）：content.result 复用 8 步报告结构。 */
async function getContent(id) {
  const data = await callApiRetry(
    `/api/contents/${encodeURIComponent(id)}`,
    {},
    "GET",
  );
  return (data && data.content) || null;
}

/** 后置登录：把本地分析并入云端结构地图。 */
async function importLocalToCloud(analyses) {
  const data = await callApi("/api/structure-map/import", { analyses });
  return (data && data.imported) || 0;
}

// 云调用单包大小有限（网关会对超大请求回 -606001 system error）。
// 这里把本地分析分片上传，每片限制条数与体积，最后再拉一次全量。
// 微信云托管硬限制：单请求包不得超过 100KB（官方错误码 -606001）。
// 限制按 HTTP 字节数计；中文 UTF-8 每字占 3 字节，不能按字符数累加。
const SYNC_CHUNK_BYTES = 64 * 1024;

// UTF-8 字节数（含 JSON 转义后的实际传输字节），用于分片累计。
function utf8BytesOf(s) {
  let bytes = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) bytes += 1;
    else if (c < 0x800) bytes += 2;
    else if (c >= 0xd800 && c <= 0xdbff) {
      bytes += 4;
      i += 1;
    } else bytes += 3;
  }
  return bytes;
}

function chunkAnalyses(list, maxBytes) {
  const chunks = [];
  let cur = [];
  let curBytes = 0;
  const limit = maxBytes || SYNC_CHUNK_BYTES;
  for (const a of list || []) {
    const b = typeof a === "object" ? utf8BytesOf(JSON.stringify(a)) : 0;
    if (cur.length && curBytes + b > limit) {
      chunks.push(cur);
      cur = [];
      curBytes = 0;
    }
    cur.push(a);
    curBytes += b;
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}

/** 双向同步：分片上传本地缺失 + 拉取云端全量。返回 {pushed, analyses}。 */
async function syncStructureMap(localAnalyses) {
  const chunks = chunkAnalyses(localAnalyses || [], SYNC_CHUNK_BYTES);
  let pushed = 0;
  for (const chunk of chunks) {
    // pushOnly 只上传不回传全量，避免响应体过大再触发平台级 system error
    const data = await callApi("/api/structure-map/sync", {
      analyses: chunk,
      pushOnly: true,
    });
    pushed += (data && data.pushed) || 0;
  }
  const data = await callApi("/api/structure-map/sync", {
    analyses: [],
  });
  return { pushed, analyses: (data && data.analyses) || [] };
}

/** 生成只读分享快照，返回短码。免登录。 */
async function createShare(payload) {
  const data = await callApi("/api/share", payload);
  return data.code;
}

/** 读取只读分享快照。 */
async function getShare(code) {
  try {
    const data = await callApiRetry(
      `/api/share/${encodeURIComponent(code)}`,
      {},
      "GET",
    );
    return data.share || null;
  } catch (e) {
    if (e && e.status === 404) return null;
    throw e;
  }
}

/** 生成「清醒行动主义」行动方案。免登录。
 * 重要：走 AI，单次可达 20s+，远超 callContainer 15s 硬超时（否则云端报 102002）。
 * 因此同 analyze 一样走「异步提交 + 轮询」，内部自动轮询到完成/超时。
 * 兼容老实现：命中云端缓存时后端直接返回，无需轮询。
 */
async function getActionPlan(payload, onProgress) {
  const accept = await callApiRetry("/api/action", payload);
  // 命中缓存直接返回
  if (accept && accept.status === "done" && accept.result) {
    return accept.result.plan;
  }
  if (accept && accept.plan) return accept; // 兼容旧后端直返
  if (!accept || !accept.taskId) {
    throw new Error("action submit failed");
  }
  const taskId = accept.taskId;
  const deadline = Date.now() + 100 * 1000; // 最多等 100s
  const step = 1000; // v21.7: 统一 1s 轮询
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, step));
    const poll = await callApiRetry(
      `/api/action/${encodeURIComponent(taskId)}/poll`,
      {},
      "GET",
    );
    if (typeof onProgress === "function") onProgress(poll);
    if (!poll) continue;
    if (poll.done) {
      if (poll.error) {
        const e = new Error(poll.error || "ai_failed");
        e.status = 502;
        throw e;
      }
      const result = poll.result || {};
      return result.plan || result; // {plan, persisted, cached?}
    }
  }
  const t = new Error("分析超时，请稍后重试");
  t.status = 408;
  throw t;
}

/** 行动页某节「我不同意/追问」（异步提交 + 轮询，同 getActionPlan）。 */
async function recomputeAction(payload, onProgress) {
  const accept = await callApi("/api/action/recompute", payload);
  if (!accept || !accept.taskId) {
    // 兼容旧形态直返
    if (accept && accept.plan) return accept;
    throw new Error("recompute submit failed");
  }
  const taskId = accept.taskId;
  const deadline = Date.now() + 150 * 1000;
  const step = 1000; // v21.7: 统一 1s 轮询
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, step));
    const poll = await callApiRetry(
      `/api/action/${encodeURIComponent(taskId)}/poll`,
      {},
      "GET",
    );
    if (typeof onProgress === "function") onProgress(poll);
    if (!poll) continue;
    if (poll.done) {
      if (poll.error) {
        const e = new Error(poll.error || "ai_failed");
        e.status = 502;
        throw e;
      }
      const result = poll.result || {};
      return { plan: result.plan, stance: result.stance, changeNote: result.changeNote, persisted: result.persisted };
    }
  }
  const t = new Error("分析超时，请稍后重试");
  t.status = 408;
  throw t;
}

/** 读取云端已存行动方案。免登录/未存返回 null。 */
async function getSavedActionPlan(id) {
  try {
    const data = await callApiRetry(
      `/api/action?id=${encodeURIComponent(id)}`,
      {},
      "GET",
    );
    return data.plan || null;
  } catch (e) {
    return null;
  }
}


/** 生成「复杂环境行动」（异步提交 + 轮询，同 getActionPlan）。 */
async function getMethodPlan(payload, onProgress) {
  const accept = await callApiRetry("/api/method", payload);
  if (accept && accept.status === "done" && accept.result) {
    return accept.result.method || accept.result;
  }
  if (!accept || !accept.taskId) throw new Error("method submit failed");
  const taskId = accept.taskId;
  const deadline = Date.now() + 150 * 1000;
  const step = 1000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, step));
    const poll = await callApiRetry("/api/method/" + encodeURIComponent(taskId) + "/poll", {}, "GET");
    if (typeof onProgress === "function") onProgress(poll);
    if (!poll) continue;
    if (poll.done) {
      if (poll.error) {
        const e = new Error(poll.error || "ai_failed");
        e.status = 502;
        throw e;
      }
      const result = poll.result || {};
      return result.method || result;
    }
  }
  const t = new Error("分析超时，请稍后重试");
  t.status = 408;
  throw t;
}

/** 读取已算好的复杂局行动（缓存命中秒回，未命中返回 null）。 */
async function getSavedMethod(id) {
  try {
    const d = await callApiRetry("/api/method?id=" + encodeURIComponent(id), {}, "GET");
    return (d && d.result) || null;
  } catch (e) {
    return null;
  }
}

/** 云端已保存行动方案摘要列表。免登录返回空。 */
async function listSavedActionPlans() {
  try {
    const data = await callApiRetry("/api/action/list", {}, "GET");
    return data.items || [];
  } catch (e) {
    return [];
  }
}

/** 上报当前错误诊断到后端日志（体验版问题定位用；只增日志、失败静默）。 */
function reportError(kind, msg) {
  try {
    callApi("/api/client-log", {
      type: kind,
      msg: String(msg || "").slice(0, 160),
      diag: getDiag().slice(-8),
    }).catch(() => {});
  } catch (e) {
    /* ignore */
  }
}

module.exports = {
  callApi,
  warm,
  apiErrorToast,
  reportError,
  getDiag,
  precheck,
  analyze,
  walkFocus,
  drill,
  recompute,
  getAnalysis,
  getStructureMap,
  getContents,
  getContent,
  importLocalToCloud,
  syncStructureMap,
  createShare,
  getShare,
  getActionPlan,
  recomputeAction,
  getSavedActionPlan,
  listSavedActionPlans,
  getMethodPlan,
  getSavedMethod,
};
