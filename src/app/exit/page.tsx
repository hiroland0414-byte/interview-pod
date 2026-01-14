// src/app/exit/page.tsx
"use client";

import { useRouter } from "next/navigation";

const BG_SRC = "/images/sky_cloud.jpg";

export default function ExitPage() {
  const router = useRouter();

  return (
    <main className="relative w-full h-[100svh] overflow-hidden flex justify-center bg-slate-900">
      <div
        className="relative mx-auto h-full w-full max-w-[390px] overflow-hidden"
        style={{
          backgroundImage: `url(${BG_SRC})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-sky-950/45" />

        <div className="relative z-10 flex h-full w-full items-center justify-center px-5">
          <div className="w-full rounded-[28px] border-2 border-white/35 bg-white/10 backdrop-blur-xl shadow-[0_18px_40px_rgba(0,0,0,0.22)] px-5 py-6 text-center">
            <h1
              className="text-[20px] font-extrabold text-white"
              style={{ textShadow: "0 2px 10px rgba(0,0,0,0.35)" }}
            >
              ご利用ありがとうございました
            </h1>

            <p className="mt-3 text-[13px] font-semibold text-white/90 leading-relaxed">
              この画面を閉じてください。
              <br />
              （ブラウザの「×」で終了できます）
            </p>

            <div className="mt-5">
              <button
                type="button"
                className="w-full h-[48px] rounded-full font-extrabold text-[15px] shadow-lg bg-white/80 text-slate-900 hover:bg-white transition-all border border-white/70"
                onClick={() => router.push("/start")}
              >
                モード選択へ戻る
              </button>
            </div>

            <p className="mt-3 text-[10px] font-semibold text-white/80">
              ※データはリセット済みです
            </p>
          </div>
        </div>

        <div className="absolute bottom-2 left-0 right-0 z-10 px-4 text-center text-[10px] font-semibold text-white/85">
          ※ 個人スマホではブラウザを閉じると終了です
        </div>
      </div>
    </main>
  );
}
