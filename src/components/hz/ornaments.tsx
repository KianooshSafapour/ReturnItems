// عناصر تزئینی فرهنگی — الهام‌گرفته از هنر رفسنجان، کرمان و ایران
// شمسه هشت‌پر، شاخه زیتون، پسته، قوس ایرانی، نقش کاشی، کویر لوت

export function BrandEmblem({ size = 44, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label="نشان هایپر زیتون"
    >
      <defs>
        <linearGradient id="em-g1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--chart-1)" />
          <stop offset="1" stopColor="var(--chart-3)" />
        </linearGradient>
        <linearGradient id="em-g2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--chart-2)" />
          <stop offset="1" stopColor="var(--chart-3)" />
        </linearGradient>
      </defs>
      <path
        d="M32 2l6.5 13L51 11l-4 12.5L59 30l-12 6.5L51 49l-12.5-4L32 58l-6.5-13L13 49l4-12.5L5 30l12-6.5L13 11l12.5 4z"
        fill="url(#em-g1)"
        opacity="0.92"
      />
      <circle cx="32" cy="30" r="15" fill="var(--background)" />
      <path
        d="M20 40c6-14 16-22 26-24"
        stroke="url(#em-g2)"
        strokeWidth="2.6"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M26 32c-6-1-9-5-9-9 5 0 9 3 10 8zM33 26c-1-6 2-10 6-12 1 5-2 9-6 12zM40 22c-2-5 0-10 3-13 2 5 0 10-3 13z"
        fill="url(#em-g2)"
      />
      <ellipse cx="24" cy="38" rx="3.6" ry="5" fill="url(#em-g2)" transform="rotate(-20 24 38)" />
      <ellipse cx="31" cy="32" rx="3.6" ry="5" fill="url(#em-g2)" transform="rotate(-30 31 32)" />
      <circle cx="32" cy="50" r="4" fill="url(#em-g2)" />
    </svg>
  );
}

/** جداکننده تذهیبی با شمسه مرکزی */
export function IlluminatedDivider({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`} aria-hidden="true">
      <div className="divider-illumination flex-1" />
      <svg width="18" height="18" viewBox="0 0 24 24" className="text-primary shrink-0">
        <path
          d="M12 1l2.6 5.2L20 4l-2.2 5.4L23 12l-5.2 2.6L20 20l-5.4-2.2L12 23l-2.6-5.2L4 20l2.2-5.4L1 12l5.2-2.6L4 4l5.4 2.2z"
          fill="currentColor"
          opacity="0.85"
        />
      </svg>
      <div className="divider-illumination flex-1" />
    </div>
  );
}

/** موتیف پسته — برای بخش‌های خالی و تزئین */
export function PistachioMotif({ className = "", size = 72 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true">
      <ellipse cx="32" cy="34" rx="16" ry="21" fill="var(--chart-1)" opacity="0.22" />
      <ellipse cx="32" cy="34" rx="16" ry="21" fill="none" stroke="var(--chart-1)" strokeWidth="2" />
      <path d="M32 13c-8 10-8 30 0 42" stroke="var(--chart-3)" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <ellipse cx="32" cy="34" rx="8" ry="13" fill="var(--chart-2)" opacity="0.75" />
      <path d="M32 24c3 5 3 15 0 20" stroke="var(--chart-3)" strokeWidth="1.6" fill="none" opacity="0.6" />
    </svg>
  );
}

/** منظره کویر لوت و نخل‌های رفسنجان — سربرگ صفحه ورود */
export function DesertScene({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 160" className={className} preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <linearGradient id="ds-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--chart-1)" stopOpacity="0.16" />
          <stop offset="1" stopColor="var(--chart-1)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[
        [30, 20], [70, 45], [110, 15], [160, 38], [210, 18], [260, 42], [310, 22], [355, 40],
        [50, 70], [140, 60], [240, 66], [330, 58],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 1.8 : 1} fill="var(--chart-2)" opacity={0.5 + (i % 3) * 0.15} />
      ))}
      <circle cx="320" cy="38" r="22" fill="var(--chart-2)" opacity="0.2" />
      <circle cx="320" cy="38" r="14" fill="var(--chart-2)" opacity="0.35" />
      <path d="M0 160L60 96l40 38 46-58 54 62 48-40 60 52 40-30 52 40v0H0z" fill="var(--primary)" opacity="0.14" />
      <path d="M0 160l70-40 50 30 60-44 66 48 56-24 98 30H0z" fill="var(--primary)" opacity="0.22" />
      {[52, 348].map((x, i) => (
        <g key={i} transform={`translate(${x} 158) scale(1.1)`} opacity="0.8">
          <path d="M0 0L1-34" stroke="var(--chart-3)" strokeWidth="3" />
          {[-60, -30, 0, 30, 60].map((a, j) => (
            <path
              key={j}
              d={`M1 -34 q ${a / 3} -8 ${a / 2} -2`}
              stroke="var(--chart-1)"
              strokeWidth="2"
              fill="none"
              opacity="0.75"
            />
          ))}
        </g>
      ))}
      <path d="M0 160q80-26 160-8t240-18v26z" fill="var(--chart-3)" opacity="0.25" />
      <rect x="0" y="0" width="400" height="160" fill="url(#ds-sky)" />
    </svg>
  );
}
