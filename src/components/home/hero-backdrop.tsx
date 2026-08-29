/**
 * 首页顶部装饰背景：科幻风 —— 呼应「结构透镜 / 层层穿透」。
 * 暗色空间底 + 透视网格 + HUD 雷达同心圆 + 星座连线数据点 + 霓虹辉光。
 * 纯 SVG + 渐变，装饰用途（aria-hidden、pointer-events-none），不影响交互。
 */
export function HeroBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 z-0 h-96 overflow-hidden"
      data-el="hero-backdrop"
    >
      {/* 深空底 + 顶部霓虹渐隐 */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 78% 8%, rgba(107,92,255,0.35) 0%, rgba(12,95,253,0.22) 34%, rgba(6,10,30,0.9) 78%, rgba(255,248,236,0) 100%)",
        }}
      />

      {/* 霓虹辉光斑：蓝 / 紫 / 琥珀 */}
      <div
        className="absolute -left-16 -top-12 h-56 w-56 rounded-full opacity-70 blur-3xl"
        style={{ background: "rgba(12,95,253,0.45)" }}
      />
      <div
        className="absolute right-8 -top-8 h-48 w-48 rounded-full opacity-60 blur-3xl"
        style={{ background: "rgba(107,92,255,0.42)" }}
      />
      <div
        className="absolute left-28 top-10 h-28 w-28 rounded-full opacity-45 blur-3xl"
        style={{ background: "rgba(255,176,32,0.32)" }}
      />

      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 390 384"
        fill="none"
        preserveAspectRatio="xMidYMin slice"
      >
        <defs>
          <linearGradient id="hb-grid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6B5CFF" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#0C5FFD" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="hb-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#00E0FF" />
            <stop offset="55%" stopColor="#6B5CFF" />
            <stop offset="100%" stopColor="#0C5FFD" />
          </linearGradient>
          <linearGradient id="hb-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#00E0FF" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#6B5CFF" stopOpacity="0.1" />
          </linearGradient>
          <radialGradient id="hb-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#9DE7FF" />
            <stop offset="100%" stopColor="#0C5FFD" />
          </radialGradient>
          <filter id="hb-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="2.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* 透视网格：科幻地平线 */}
        <g stroke="url(#hb-grid)" strokeWidth="0.8" opacity="0.5">
          <line x1="0" y1="150" x2="390" y2="150" />
          <line x1="0" y1="120" x2="390" y2="120" />
          <line x1="0" y1="96" x2="390" y2="96" />
          <line x1="30" y1="60" x2="-40" y2="200" />
          <line x1="110" y1="60" x2="70" y2="200" />
          <line x1="200" y1="60" x2="200" y2="200" />
          <line x1="290" y1="60" x2="330" y2="200" />
          <line x1="370" y1="60" x2="440" y2="200" />
        </g>

        {/* HUD 雷达：发光同心圆 + 十字准星 —— 锁定异常·层层下钻 */}
        <g filter="url(#hb-glow)">
          <g stroke="url(#hb-ring)" fill="none">
            <circle cx="308" cy="78" r="66" strokeWidth="1.2" opacity="0.5" />
            <circle cx="308" cy="78" r="46" strokeWidth="1.3" opacity="0.7" />
            <circle cx="308" cy="78" r="26" strokeWidth="1.4" opacity="0.9" />
          </g>
          <line x1="308" y1="2" x2="308" y2="154" stroke="#00E0FF" strokeWidth="0.6" opacity="0.4" />
          <line x1="230" y1="78" x2="386" y2="78" stroke="#00E0FF" strokeWidth="0.6" opacity="0.4" />
          <circle cx="308" cy="78" r="7" fill="url(#hb-core)" />
        </g>

        {/* 星座连线 + 数据点 —— 结构 / 关系拓扑 */}
        <g filter="url(#hb-glow)">
          <line x1="40" y1="70" x2="118" y2="112" stroke="url(#hb-line)" strokeWidth="1.2" />
          <line x1="118" y1="112" x2="196" y2="80" stroke="url(#hb-line)" strokeWidth="1.2" />
          <line x1="118" y1="112" x2="150" y2="186" stroke="url(#hb-line)" strokeWidth="1.2" />
          <line x1="196" y1="80" x2="252" y2="132" stroke="url(#hb-line)" strokeWidth="1.2" />
          <circle cx="40" cy="70" r="3.4" fill="#00E0FF" />
          <circle cx="118" cy="112" r="4.6" fill="#6B5CFF" />
          <circle cx="196" cy="80" r="3.4" fill="#FFB020" />
          <circle cx="150" cy="186" r="3" fill="#00E0FF" />
          <circle cx="252" cy="132" r="3" fill="#6B5CFF" />
        </g>

        {/* 漂浮粒子 / 星点 */}
        <g fill="#9DE7FF" opacity="0.75">
          <circle cx="66" cy="150" r="1.3" />
          <circle cx="172" cy="44" r="1.1" />
          <circle cx="244" cy="58" r="1.4" />
          <circle cx="96" cy="60" r="1" />
          <circle cx="340" cy="150" r="1.2" />
          <circle cx="284" cy="176" r="1.1" />
          <circle cx="130" cy="164" r="1" />
        </g>
      </svg>
    </div>
  );
}
