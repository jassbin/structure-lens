// 结构地图：自动响应（无需客户按钮），本地 + 云端双向同步。节点 hits≥2 点亮 verified。
const local = require("../../utils/local");
const autoSync = require("../../utils/auto-sync");

const ROOT_LABELS = {
  extraction: "提取-分配",
  delegation: "委托-执行",
  power: "权力竞争-均衡",
};

const ROOT_CLASS = {
  extraction: "badge-strong",
  delegation: "badge-info",
  power: "badge-danger",
};

Page({
  data: {
    nodes: [],
    loading: true,
    summary: "",
    ROOT_LABELS,
    ROOT_CLASS,
  },

  onShow() {
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
    this.loadLocal();
    // 自动同步（登录态由云托管自动注入，不需用户操作）
    autoSync.sync();
  },

  async onPullDownRefresh() {
    await autoSync.sync();
    this.loadLocal();
    wx.stopPullDownRefresh();
  },

  loadLocal() {
    const nodes = (local.getLocalStructureMap() || []).map((n) => {
      const a = (local.getAllLocalAnalyses() || []).find(
        (x) => x && x.skeleton && x.skeleton.name === n.name,
      );
      return { ...n, question: (a && (a.input || a.verdict)) || (n.events && n.events[0]) || "" };
    });
    this.setData({ nodes, loading: false, summary: this.buildSummary(nodes) });
  },

  buildSummary(nodes) {
    const total = nodes.length;
    const verified = nodes.filter((n) => n.state === "verified").length;
    if (total === 0) return "";
    return `你挖了 ${total} 件事，已点亮的套路 ${verified} 种`;
  },

  onTapNode(e) {
    const name = e.currentTarget.dataset.name;
    const events = e.currentTarget.dataset.events || [];
    const analyses = local.getAllLocalAnalyses();
    let match = analyses.find((a) => a.skeleton && a.skeleton.name === name);
    if (!match) {
      match = analyses.find((a) => events.indexOf(a.verdict) >= 0 || events.indexOf(a.input) >= 0);
    }
    if (match) {
      wx.navigateTo({ url: `/pages/report/report?id=${encodeURIComponent(match.id)}` });
    }
  },
});
