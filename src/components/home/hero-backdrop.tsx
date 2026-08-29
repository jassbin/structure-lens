/**
 * 首页顶部装饰背景：呼应「结构透镜 / 层层穿透」主题。
 * 纯 SVG + 渐变，低透明度彩色几何，装饰用途（aria-hidden、pointer-events-none）。
 */
export function HeroBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 z-0 h-80 overflow-hidden"
      data-el="hero-backdrop"
    >
      {/* 蓝色渐变打底 */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(12,95,253,0.30) 0%, rgba(12,95,253,0.12) 42%, rgba(255,248,236,0) 100%)",
        }}
      />

      {/* 彩色模糊光斑：蓝 / 紫 / 琥珀，呼应主题配色 */}
      <div
        className="absolute -left-12 -top-10 h-48 w-48 rounded-full opacity-80 blur-3xl"
        style={{ background: "rgba(12,95,253,0.38)" }}
      />
      <div
        className="absolute -right-10 top-2 h-40 w-40 rounded-full opacity-70 blur-3xl"
        style={{ background: "rgba(107,92,255,0.34)" }}
      />
      <div
        className="absolute right-16 -top-6 h-24 w-24 rounded-full opacity-60 blur-3xl"
        style={{ background: "rgba(255,176,32,0.30)" }}
      />

      {/* 几何图案层：透镜同心圆 + 结构节点连线 + 剖面色块 */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 390 320"
        fill="none"
        preserveAspectRatio="xMidYMin slice"
      >
        <defs>
          <linearGradient id="hb-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0C5FFD" />
            <stop offset="100%" stopColor="#6B5CFF" />
          </linearGradient>
          <linearGradient id="hb-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#0C5FFD" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#6B5CFF" stopOpacity="0.15" />
          </linearGradient>
        </defs>

        {/* 透镜靶心：层层同心圆，呼应「锁定异常 · 层层下钻」 */}
        <g opacity="0.35" stroke="url(#hb-ring)">
          <circle cx="312" cy="70" r="60" strokeWidth="1.4" />
          <circle cx="312" cy="70" r="42" strokeWidth="1.4" />
          <circle cx="312" cy="70" r="24" strokeWidth="1.4" />
          <circle cx="312" cy="70" r="8" fill="#0C5FFD" stroke="none" opacity="0.9" />
        </g>

        {/* 结构拓扑：节点 + 连线，呼应「结构 / 关系」 */}
        <g opacity="0.5">
          <line x1="44" y1="60" x2="120" y2="104" stroke="url(#hb-line)" strokeWidth="1.4" />
          <line x1="120" y1="104" x2="196" y2="72" stroke="url(#hb-line)" strokeWidth="1.4" />
          <line x1="120" y1="104" x2="150" y2="176" stroke="url(#hb-line)" strokeWidth="1.4" />
          <circle cx="44" cy="60" r="5" fill="#0C5FFD" />
          <circle cx="120" cy="104" r="6.5" fill="#6B5CFF" />
          <circle cx="196" cy="72" r="5" fill="#FFB020" />
          <circle cx="150" cy="176" r="4.5" fill="#0C5FFD" />
        </g>

        {/* 剖面几何色块：三角 / 方块，呼应「穿透 · 剖开表层」 */}
        <rect
          x="60"
          y="150"
          width="26"
          height="26"
          rx="6"
          fill="#6B5CFF"
          opacity="0.22"
          transform="rotate(18 73 163)"
        />
        <path d="M250 150 L276 150 L263 128 Z" fill="#FFB020" opacity="0.28" />
        <rect
          x="292"
          y="150"
          width="20"
          height="20"
          rx="5"
          fill="#0C5FFD"
          opacity="0.24"
          transform="rotate(-12 302 160)"
        />
      </svg>
    </div>
  );
}
