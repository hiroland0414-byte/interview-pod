// src/components/UpperBodyGuide.tsx
"use client";

export function UpperBodyGuide({ show }: { show: boolean }) {
  if (!show) return null;

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      {/* 背景をほんのり暗くして線を見やすく（不要ならrectごと削除OK） */}
      <rect x="0" y="0" width="100" height="100" fill="rgba(0,0,0,0.10)" />

      {/* 頭のガイド */}
      <ellipse
        cx="50"
        cy="27"
        rx="13"
        ry="16"
        fill="none"
        stroke="rgba(255,255,255,0.95)"
        strokeWidth="0.9"
      />

      {/* 肩〜上半身のガイド */}
      <path
        d="M25 62
           C 32 50, 40 44, 50 44
           C 60 44, 68 50, 75 62
           C 76 66, 72 71, 66 74
           C 60 77, 55 79, 50 79
           C 45 79, 40 77, 34 74
           C 28 71, 24 66, 25 62 Z"
        fill="none"
        stroke="rgba(255,255,255,0.95)"
        strokeWidth="0.9"
        strokeLinejoin="round"
      />

      {/* 中央ガイド（任意） */}
      <line
        x1="50"
        y1="12"
        x2="50"
        y2="90"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="0.6"
        strokeDasharray="2 2"
      />
    </svg>
  );
}
