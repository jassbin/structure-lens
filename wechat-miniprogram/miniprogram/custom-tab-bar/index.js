// 纯文字自定义 tabBar：首页(照妖) / 地图
Component({
  data: {
    selected: 0,
    list: [
      { pagePath: "/pages/home/home", text: "照妖", icon: "🔍" },
      { pagePath: "/pages/map/map", text: "地图", icon: "🗺️" },
    ],
  },

  methods: {
    switchTab(e) {
      const idx = e.currentTarget.dataset.index;
      const item = this.data.list[idx];
      if (idx === this.data.selected) return;
      wx.switchTab({ url: item.pagePath });
    },
  },
});
