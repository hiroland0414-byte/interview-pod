// src/app/start/page.tsx（完成版：初回は/philosophyへ＋以後は小さな入口）
"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { initSession, type ModeTag } from "@/lib/usage/session";

type ModeButton = { mode: ModeTag; label: string; icon: string };

const MODES: ModeButton[] = [
  { mode: "A1", label: "病院（診療放射線技師）", icon: "/icons/a1.png" },
  { mode: "A2", label: "病院（看護師）", icon: "/icons/a2.png" },
  { mode: "B", label: "健診／クリニック", icon: "/icons/b.png" },
  { mode: "C", label: "企業（医療関連）", icon: "/icons/c.png" },
];

// アイコンの見た目を統一したい時はここだけ触る
const ICON_BOX = 54; // 48〜64の間で調整が気持ちいい

export default function StartPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<ModeTag | "IMPRESSION" | "HUB" | null>(
    null
  );
  const [isNavigating, setIsNavigating] = useState(false);

  // ★追加：初回判定が終わるまで start を描画しない
  const [gateReady, setGateReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const seen = localStorage.getItem("kcareer.hasSeenPhilosophy");
      if (!seen) {
        router.replace("/philosophy");
        return; // ★startを見せない
      }
    } catch {
      // noop
    }

    setGateReady(true);
  }, [router]);

  // ★判定が終わるまで何も描画しない（チラつき解消）
  if (!gateReady) return null;

  const goInterview = (mode: ModeTag) => {
    if (isNavigating) return;
    initSession(mode);
    setSelected(mode);
    setIsNavigating(true);
    window.setTimeout(() => router.push("/interview"), 300);
  };

  const goImpression = () => {
    if (isNavigating) return;
    setSelected("IMPRESSION");
    setIsNavigating(true);
    window.setTimeout(() => router.push("/impression"), 200);
  };

  // 変更点：終了 → アプリ選択（kc-lp）へ
  const goHub = () => {
    if (isNavigating) return;
    setSelected("HUB");
    setIsNavigating(true);

    try {
      sessionStorage.clear();
    } catch {}

    // Hub URL（ENV優先、なければ固定URL）
    const hubUrl =
      process.env.NEXT_PUBLIC_HUB_URL ?? "https://kc-lp.vercel.app";

    window.setTimeout(() => {
      // 外部URLへ確実に遷移（Next routerでもOKだが確実性重視）
      window.location.href = hubUrl;
    }, 200);
  };

  const disabledUnlessSelected = (key: string) =>
    isNavigating && selected !== key;

  // ボタン内レイアウト（アイコン大きめ＋左寄せ）
  const ButtonInner = ({ icon, label }: { icon: string; label: string }) => {
    return (
      <span className="flex w-full items-center gap-4">
        {/* アイコン枠 */}
        <span
          className="relative shrink-0 overflow-hidden rounded-xl bg-white/20 border border-white/30"
          style={{ width: ICON_BOX, height: ICON_BOX }}
        >
          <Image src={icon} alt="" fill className="object-cover" />
        </span>

        {/* テキスト */}
        <span
          className="min-w-0 text-left text-[18px] font-extrabold text-white leading-snug"
          style={{ textShadow: "0 2px 2px rgba(0,0,0,0.45)" }}
        >
          {label}
        </span>
      </span>
    );
  };

  return (
    <div className="fixed inset-0 overflow-hidden bg-slate-900">
      {/* 背景は CSS background（ズーム伸び対策） */}
      <div
        className="relative mx-auto h-full w-full max-w-[390px] overflow-hidden"
        style={{
          backgroundImage: "url(/images/sky_cloud.jpg)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* overlay */}
        <div className="absolute inset-0 bg-black/10" />

        {/* コンテンツ */}
        <div className="relative z-10 flex h-full w-full items-start justify-center px-4 pt-6 pb-5">
          <div
            className={[
              "w-full rounded-[28px] border-2 border-white/35 bg-white/10 backdrop-blur-xl",
              "shadow-[0_18px_40px_rgba(0,0,0,0.22)]",
              "px-4 py-5",
              "max-h-[calc(100%-16px)] overflow-y-auto",
            ].join(" ")}
          >
            <div className="flex flex-col items-center">
              {/* ロゴ */}
              <div className="relative w-full overflow-hidden rounded-xl">
                <Image
                  src="/logo.png"
                  alt="K-career"
                  width={1400}
                  height={300}
                  priority
                  className="h-auto w-full select-none"
                />
              </div>

              {/* タイトル */}
              <div className="mt-4 text-center">
                <h1
                  className="text-[18px] font-extrabold tracking-wide text-white"
                  style={{ textShadow: "0 2px 2px rgba(0,0,0,0.45)" }}
                >
                  医療系面接 基礎トレーナー（β版）
                </h1>
                <p
                  className="mt-2 text-[14px] font-semibold text-white/90"
                  style={{ textShadow: "0 1px 1px rgba(0,0,0,0.35)" }}
                >
                  Dialogue Trainer for Medical Interview
                </p>
              </div>

              {/* ボタン群 */}
              <div className="mt-5 w-full pb-2">
                {/* 印象力アップ（最上段） */}
                <div className="mb-5">
                  <button
                    type="button"
                    onClick={goImpression}
                    disabled={disabledUnlessSelected("IMPRESSION")}
                    className={[
                      "w-full rounded-full border-2 px-5 py-1.0 transition-all",
                      "backdrop-blur-md",
                      selected === "IMPRESSION"
                        ? "border-white/70 bg-lime-300/90"
                        : "border-white/45 bg-lime-200/40 hover:bg-lime-200/50",
                      disabledUnlessSelected("IMPRESSION")
                        ? "opacity-60"
                        : "opacity-100",
                      selected !== "IMPRESSION" ? "impression-pulse" : "",
                    ].join(" ")}
                  >
                    <ButtonInner
                      icon="/icons/impression.png"
                      label="印象力アップ（非言語）"
                    />
                  </button>
                </div>

                {/* おすすめ文（橋渡し） */}
                <div className="mb-4 text-center">
                  <p className="text-[14px] font-extrabold text-emerald-200">
                    面接トレーニングに入る前におすすめ
                  </p>

                  {/* =====================================================
                      B案：小さな入口（思想マニュアル）
                     ===================================================== */}
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => router.push("/philosophy")}
                      className="text-[11px] font-semibold text-white/80 underline underline-offset-4 hover:text-white"
                      disabled={isNavigating}
                    >
                      📜 未来へのアプローチ（思想マニュアル）
                    </button>
                  </div>
                </div>

                {/* 面接トレーニング */}
                <div className="space-y-3">
                  <div className="mt-2 mb-2 text-center">
                    <p className="text-[18px] font-extrabold text-yellow-200">
                      --- 面接トレーニング ---
                    </p>
                  </div>

                  {MODES.map((m) => {
                    const active = selected === m.mode;
                    const disabled = disabledUnlessSelected(m.mode);
                    return (
                      <button
                        key={m.mode}
                        type="button"
                        onClick={() => goInterview(m.mode)}
                        disabled={disabled}
                        className={[
                          "w-full rounded-full border-2 px-5 py-2.0 transition-all",
                          "backdrop-blur-md",
                          active
                            ? "border-white/70 bg-sky-300/60"
                            : "border-white/45 bg-sky-400/40 hover:bg-sky-200/45",
                          disabled ? "opacity-60" : "opacity-100",
                        ].join(" ")}
                      >
                        <ButtonInner icon={m.icon} label={m.label} />
                      </button>
                    );
                  })}
                </div>

                {/* 変更点：終了 → アプリ選択へ（位置・見た目は維持） */}
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={goHub}
                    disabled={disabledUnlessSelected("HUB")}
                    className={[
                      "rounded-full border-2 px-6 py-2.0 text-center transition-all",
                      "backdrop-blur-md",
                      selected === "HUB"
                        ? "border-white/70 bg-red-300/85"
                        : "border-white/45 bg-red-300/80 hover:bg-yellow-200/40",
                      disabledUnlessSelected("HUB") ? "opacity-60" : "opacity-100",
                    ].join(" ")}
                  >
                    <span
                      className="text-[14px] font-extrabold text-white"
                      style={{ textShadow: "0 2px 2px rgba(0,0,0,0.45)" }}
                    >
                      アプリ選択へ
                    </span>
                  </button>
                </div>

                <div className="mt-4 text-center text-[10px] font-semibold text-white/85">
                  Presented by HIROSHI KOYAMA（K-career）
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-2 left-0 right-0 z-10 px-4 text-center text-[10px] font-semibold text-white/85">
          ※ 録音を使う場合、ブラウザのマイク許可が必要です
        </div>
      </div>
    </div>
  );
}