"use client";

import { useRouter } from "next/navigation";

const BG_SRC = "/images/sky_cloud.jpg";

export default function ImpressionGuidePage() {
  const router = useRouter();

  return (
    <main className="relative w-full h-[100svh] overflow-hidden flex justify-center bg-slate-100">
      <div className="w-[390px] max-w-[92vw] h-[100svh] flex items-start justify-center pt-2 pb-6">
        <div className="relative w-full rounded-[28px] overflow-hidden shadow-2xl border border-white/30">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${BG_SRC})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
              filter: "saturate(1.05) contrast(1.02)",
              transform: "scale(1.03)",
            }}
          />
          <div className="absolute inset-0 bg-sky-950/35" />

          <div className="relative px-5 pt-4 pb-5">
            <div className="mt-4 text-center">
              <h1
                className="text-[28px] font-extrabold text-white tracking-wide"
                style={{ textShadow: "0 2px 10px rgba(0,0,0,0.35)" }}
              >
                印象アップモード
              </h1>
              <p
                className="mt-1 text-[13px] font-semibold text-white/95"
                style={{ textShadow: "0 2px 10px rgba(0,0,0,0.35)" }}
              >
                Non-verbal Feedback (voice / face)
              </p>
              <p className="mt-2 text-[12px] font-extrabold text-red-500">全モード共通</p>
            </div>

            <div className="mt-4 rounded-[22px] border-2 border-white/55 p-4 bg-sky-100/85 shadow-[0_10px_30px_rgba(0,0,0,0.18)]">
              {/* 枠①：録画時の注意 */}
              <div className="rounded-2xl bg-white/70 border border-white/70 p-3">
                <div className="text-[13px] font-extrabold text-slate-800 mb-2">
                  録画についての確認
                </div>
                <div className="text-[12px] font-semibold text-slate-700 leading-relaxed">
                  <p>
                    このモードは 話の内容は評価しません。
                    <br />
                    声・無音・表情（顔検出）・安定感のみを見ますので、声のトーンや明瞭さ、口角のアップ、口を大きめに開く、目線を合わせるなど、普段以上に強調して下さい。
                  </p>
                  <p className="mt-2">
                    スタート後、5秒カウントダウンしてから録画（評価）を開始します。
                    <br />
                    録画時間は最大60秒です。
                    <br />
                    30秒以上で評価できます（終了は30秒経過後）。
                  </p>
                </div>
              </div>

              {/* 枠②：自己紹介（例） */}
              <div className="mt-3 rounded-2xl bg-white/70 border border-white/70 p-3">
                <div className="text-[13px] font-extrabold text-slate-800 mb-2">
                  自己紹介の例（話し方の参考）
                </div>
                <ul className="text-[12px] font-semibold text-slate-700 leading-relaxed list-disc pl-5">
                  <li>大学名・氏名</li>
                  <li>学んできたこと</li>
                  <li>長所</li>
                  <li>趣味・部活・出身地</li>
                  <li>ボランティア活動・アルバイト経験</li>
                  <li>最後に一言（本日はよろしくお願いします）</li>
                </ul>
                <p className="text-[12px] font-extrabold text-slate-800 mt-2">
                  一つひとつが長くならないように、ポイントを話せばOK
                </p>
              </div>

              {/* スタート（recordへ。auto=1でrecord側が即カウントへ） */}
              <button
                type="button"
                className="mt-4 w-full h-[48px] rounded-full font-extrabold text-[16px] shadow-lg bg-sky-300 text-slate-900 hover:bg-sky-200 transition-all"
                onClick={() => router.push("/impression/record?auto=1")}
              >
                スタート
              </button>
            </div>

            <p className="mt-3 text-center text-[11px] font-semibold text-white/90">
              ※Android/Chrome 推奨（カメラ・マイク許可が必要）
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
