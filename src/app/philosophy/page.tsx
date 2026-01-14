// src/app/philosophy/page.tsx
"use client";

import { useRouter } from "next/navigation";

export default function PhilosophyPage() {
  const router = useRouter();

  const closeAndGoStart = () => {
    try {
      localStorage.setItem("kcareer.hasSeenPhilosophy", "true");
    } catch {}
    router.replace("/start");
  };

  return (
    <main className="min-h-[100svh] w-full bg-[#0b1f3a] flex justify-center">
      <div className="w-full max-w-[430px] px-4 pt-6 pb-10">
        {/* “古い地図”カード */}
        <article
          className={[
            "rounded-[22px] border border-white/25 shadow-2xl overflow-hidden",
            "bg-[#f7f3e8]",
          ].join(" ")}
        >
          {/* ヘッダー（地図感） */}
          <header className="px-5 pt-6 pb-4 bg-[#f3ecd9] border-b border-black/10">
            <p className="text-[11px] font-semibold text-slate-700/90">K-career / Philosophy</p>

            <h1 className="mt-2 text-[24px] font-extrabold text-slate-900 tracking-wide">
              未来へのアプローチ
            </h1>
            <p className="mt-1 text-[12px] font-semibold text-slate-700">
              ― 正解ではなく、目印を探すために ―
            </p>

            <div className="mt-4 rounded-xl bg-white/60 border border-black/10 px-4 py-3">
              <p className="text-[12px] leading-relaxed text-slate-800">
                このアプリに書かれているのは、未来の<strong>正解</strong>ではありません。
                <br />
                書かれているのは、<strong>近づき方（アプローチ）</strong>だけです。
              </p>
            </div>
          </header>

          {/* 本文 */}
          <section className="px-5 py-5 text-slate-900">
            <div className="text-[12px] leading-relaxed space-y-4">
              <h2 className="text-[14px] font-extrabold">はじめに</h2>
              <p>
                この画面を開いたあなたは、「うまく話せるようになりたい」「面接で失敗したくない」
                そんな気持ちを、少なからず持っていると思います。
                <br />
                でも、このアプリはあなたを評価するためのものではありません。
                <br />
                ここは、<strong>安心して試していい場所</strong>です。
              </p>

              <h2 className="text-[14px] font-extrabold">このアプリが大切にしていること</h2>

              <h3 className="text-[13px] font-extrabold">1. 上手に話す必要はありません</h3>
              <p>
                噛んでもいい。言い直してもいい。言葉が詰まっても問題ありません。
                <br />
                医療の現場で大切なのは、完璧な言葉よりも、
                <strong>落ち着いて向き合おうとする姿勢</strong>です。
                <br />
                このアプリでは、「うまさ」よりも「今のあなたがどう見えるか」を大切にしています。
              </p>

              <h3 className="text-[13px] font-extrabold">2. 他人と比べるためのものではありません</h3>
              <p>
                結果やフィードバックは、誰かと比べるためのものではありません。
                <br />
                比べる相手は、<strong>前回のあなた</strong>だけです。
                <br />
                昨日より少し落ち着いて話せた。前より目線を意識できた。それだけで十分な前進です。
              </p>

              <h3 className="text-[13px] font-extrabold">3. 印象アップは「内容を評価しません」</h3>
              <p>
                印象アップモードでは、話している内容は評価しません。
                <br />
                見ているのは、声の出し方・表情・目線・安定感だけです。
                <br />
                これは、<strong>話す中身を気にせず練習してほしい</strong>という意図からです。
              </p>

              <h2 className="text-[14px] font-extrabold">おすすめの使い方（強制ではありません）</h2>
              <ol className="list-decimal pl-5 space-y-2">
                <li>
                  <strong>印象アップを1回だけやる</strong>：うまくいかなくて構いません。「こう見えるんだ」と気づければ十分。
                </li>
                <li>
                  <strong>面接トレーニングに進む</strong>：内容よりも、落ち着きや伝わり方を意識。
                </li>
                <li>
                  <strong>結果を最後まで読む</strong>：途中で閉じず、一度は全部目を通す。
                </li>
                <li>
                  <strong>保存する</strong>：今すぐ見返さなくてもOK。あなたが歩いた道の記録になる。
                </li>
              </ol>

              <h2 className="text-[14px] font-extrabold">フィードバックの読み方</h2>
              <p>
                フィードバックは、あなたを否定する文章ではありません。
                <br />
                少し厳しく感じる部分があっても、それは「次に伸ばせる場所」が見えている証拠です。
                <br />
                一度に直そうとしなくて大丈夫。<strong>一つだけ意識して、次に進めば十分</strong>です。
              </p>

              <h2 className="text-[14px] font-extrabold">よくある誤解</h2>
              <div className="space-y-2">
                <p>
                  <strong>Q. 短くしか話せませんでした</strong>
                  <br />
                  → 問題ありません。要点が伝われば十分です。
                </p>
                <p>
                  <strong>Q. 緊張して声が震えました</strong>
                  <br />
                  → 多くの人がそうです。緊張は準備している証拠です。
                </p>
                <p>
                  <strong>Q. フィードバックが厳しく感じます</strong>
                  <br />
                  → 改善点が見える＝成長の方向が分かった、ということです。
                </p>
              </div>

              <h2 className="text-[14px] font-extrabold">最後に</h2>
              <p>
                面接は、才能を見せる場ではありません。
                <br />
                「この人と一緒に働くイメージができるか」「安心して任せられそうか」を感じてもらう場です。
                <br />
                焦らなくていい。迷っていい。立ち止まってもいい。
                <br />
                <strong>あなたは、すでに未来へ向かっています。</strong>
              </p>

              <p className="text-[11px] text-slate-700 mt-4">
                ※ このアプリは個人のスマートフォンで使うことを前提にしています。
                <br />
                ※ 保存されたデータはあなた自身の振り返りのためのものです。
              </p>
            </div>

            {/* ボタン */}
            <div className="mt-6 flex items-center justify-center">
              <button
                type="button"
                onClick={closeAndGoStart}
                className={[
                  "h-[48px] px-8 rounded-full font-extrabold text-[15px]",
                  "bg-slate-900 text-white shadow-lg hover:bg-slate-800 transition-all",
                ].join(" ")}
              >
                地図をたたんで進む
              </button>
            </div>

            {/* ちいさな補助 */}
            <p className="mt-3 text-center text-[10px] text-slate-600">
              ※いつでも /start から再表示できます
            </p>
          </section>
        </article>
      </div>
    </main>
  );
}
