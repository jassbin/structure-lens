// 解忧列表：已生成的行动方案列表（云端 + 本地兜底）
const api = require("../../utils/api");
const local = require("../../utils/local");

Page({
  data: {
    items: [],
    loading: true,
  },

  onShow() {
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
    }
    this.load();
  },

  async onPullDownRefresh() {
    await this.load();
    wx.stopPullDownRefresh();
  },

  async load() {
    this.setData({ loading: true });
    try {
      const items = await api.listSavedActionPlans();
      // 云端为空时，用本地分析补兜底展示（可再生成）
      if (!items || items.length === 0) {
        const localItems = local
          .getAllLocalAnalyses()
          .map((a) => ({
            id: a.id,
            input: a.input,
            verdict: a.verdict,
            headline: "查看 → 生成行动方案",
          }));
        this.setData({ items: localItems, loading: false });
        return;
      }
      this.setData({ items, loading: false });
    } catch (e) {
      // 云端失败 → 本地兜底
      const localItems = local
        .getAllLocalAnalyses()
        .map((a) => ({
          id: a.id,
          input: a.input,
          verdict: a.verdict,
          headline: "查看 → 生成行动方案",
        }));
      this.setData({ items: localItems, loading: false });
    }
  },

  onTapItem(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/action/action?id=${encodeURIComponent(id)}` });
  },
});