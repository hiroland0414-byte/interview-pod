import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],

  // 👇 動的クラスの取りこぼし防止（safelist）
  safelist: [
    "bg-sky-50",
    "bg-sky-100",
    "bg-sky-200",
    "border-sky-300",
    "border-sky-400",
    "hover:bg-sky-50",
    "text-sky-900",
    "text-slate-800",
    "text-slate-900",
    "shadow-sm",
  ],

  theme: {
    extend: {
      colors: {
        brand: {
          light: "#e6f2ff",   // ページ背景（淡い水色）
          primary: "#2563eb", // メインブルー
          accent: "#3b82f6",  // 補助ブルー
        },
        ink: {
          base: "#0f172a", // 文字ベース
          soft: "#334155", // サブ文字
        },
      },
      borderRadius: {
        xl2: "1.25rem", // 共通カード角丸
      },
      boxShadow: {
        card: "0 6px 24px -8px rgba(2,32,71,0.12)", // 柔らかい影
      },
      fontFamily: {
        sans: ['"Noto Sans JP"', "ui-sans-serif", "system-ui"],
      },
    },
  },

  plugins: [],
};

export default config;
