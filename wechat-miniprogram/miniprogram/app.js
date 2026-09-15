// 应用入口：初始化小程序云开发 + 配置微信云托管调用参数
// envId        —— 小程序云开发环境 ID（wx.cloud.init 用）
// containerEnvId —— 微信云托管的环境 ID（wx.cloud.callContainer 的 config.env 用）
// containerName —— 云托管服务名（X-WX-SERVICE 头）
const ENV_ID = "xiaochengxu-d1gvftu21ecf29e"; // 云开发（云数据库/云函数）
const CONTAINER_ENV_ID = "prod-d8gvfrnwzd049d403"; // 微信云托管环境
const CONTAINER_NAME = "structure-lens"; // 云托管服务名（与线上服务一致）

App({
  globalData: {
    envId: ENV_ID,
    containerEnvId: CONTAINER_ENV_ID,
    containerName: CONTAINER_NAME,
    // 诊断用：云环境 SDK 版本 / 云能力是否可用（配合长按版本号弹窗）
    sdkVersion: "",
    cloudAvailable: false,
    cloudCallAvailable: false,
    cloudInitError: "",
    // 免登录本地持久化的分析存本地；云同步由 callContainer 自动带 openid 完成
  },

  onLaunch() {
    // 启动即记录云能力状态；请求失败时先自查，避免反复试错
    let sdkVersion = "";
    try {
      const sys = wx.getSystemInfoSync ? wx.getSystemInfoSync() : null;
      sdkVersion = (sys && sys.SDKVersion) || "";
    } catch (e) { /* ignore */ }
    this.globalData.sdkVersion = sdkVersion;

    let cloudOk = false;
    let cloudCallOk = false;
    let initErr = "";
    try {
      if (!wx.cloud) {
        initErr = "wx.cloud 不存在（基础库过旧或未开通云开发）";
      } else {
        cloudOk = true;
        cloudCallOk = typeof wx.cloud.callContainer === "function";
        wx.cloud.init({ env: ENV_ID, traceUser: true });
      }
    } catch (e) {
      initErr = String((e && (e.message || e.errMsg)) || e);
    }
    this.globalData.cloudAvailable = cloudOk;
    this.globalData.cloudCallAvailable = cloudCallOk;
    this.globalData.cloudInitError = initErr;
    console.warn("[jieyu] sdk=" + sdkVersion + " cloud=" + cloudOk + " callContainer=" + cloudCallOk + " initErr=" + initErr);

    // 启动即静默预热 + 自动同步：降低第一次“照一照”的云实例冷启动等待
    try {
      const api = require("./utils/api");
      api.warm().catch(() => {});
      const autoSync = require("./utils/auto-sync");
      autoSync.sync();
    } catch (e) { /* 静默 */ }
  },

  onShow() {
    // 前台常驻轻量预热：每 15s 一次 healthz，让实例在用户点照一照前就被拉起
    if (this._warmTimer) clearInterval(this._warmTimer);
    this._warmTimer = setInterval(() => {
      try {
        const api = require("./utils/api");
        api.warm().catch(() => {});
      } catch (e) { /* silent */ }
    }, 15000);
  },

  onHide() {
    if (this._warmTimer) { clearInterval(this._warmTimer); this._warmTimer = null; }
  },
});