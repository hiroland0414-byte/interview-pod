// src/app/interview/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { ModeTag } from "@/lib/questions";
import { expandCoreQuestions, expandAdditionalQuestions } from "@/lib/questions";

import { insertDeepDives } from "@/lib/interview/flow/insertDeepDives";
import type { InterviewQuestion } from "@/lib/interview/flow/buildQuestionQueue";

import { correctLightRealtime, correctStrictFinal } from "@/lib/speech/correct";
import type { QuestionType, Tone } from "@/lib/interview/deepDive/rules";

const BG_SRC = "/images/sky_cloud.jpg";

const MODE_LABEL: Record<ModeTag, string> = {
  A1: "病 院（診療放射線技師）",
  A2: "病 院（看護師）",
  B: "健 診／クリニック",
  C: "企 業（医療関連）",
};

function inferQuestionTypeFromSection(section?: string): QuestionType | null {
  const s = (section || "").toLowerCase();
  if (s.includes("motivation")) return "motivation";
  if (s.includes("self") || s.includes("pr")) return "self_pr";
  if (s.includes("gaku") || s.includes("challenge")) return "gakuchika";
  return null;
}

type SpeechRecognitionLike = any;

const asText = (v: unknown) => (v == null ? "" : String(v)).trim();

function toInterviewQuestion(x: any, mode: ModeTag, minCharsDefault = 120): InterviewQuestion | null {
  const id = asText(x?.id);
  const text = asText(x?.text) || asText(x?.question) || asText(x?.questionText);
  if (!id || !text) return null;

  const hint = asText(x?.hint) || asText(x?.subtitle) || asText(x?.notes) || "";
  const kind = (asText(x?.kind) || "core") as any;

  const depthLevel =
    typeof x?.depthLevel === "number"
      ? x.depthLevel
      : asText(x?.parentId)
      ? 1
      : String(kind).includes("depth")
      ? 1
      : 0;

  let minChars = minCharsDefault;
  if (typeof x?.minChars === "number" && Number.isFinite(x.minChars)) {
    minChars = x.minChars;
  } else {
    minChars = minCharsDefault;
  }

  return {
    id,
    text,
    hint,
    kind,
    parentId: asText(x?.parentId) || undefined,
    section: asText(x?.section) || undefined,
    depthLevel,
    minChars,
    mode,
  } as any;
}

function stripInterim(text: string) {
  return (text || "").replace(/\n?\[interim\][\s\S]*$/s, "").trim();
}

export default function InterviewPage() {
  const router = useRouter();

  const [mode, setMode] = useState<ModeTag>("A1");
  const [queue, setQueue] = useState<InterviewQuestion[]>([]);
  const [index, setIndex] = useState(0);

  const [answer, setAnswer] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // ヒント表示（カード）
  const [hintOpen, setHintOpen] = useState(false);

  // Next連打・非同期崩れ防止
  const [isAdvancing, setIsAdvancing] = useState(false);

  // 音声入力
  const [listening, setListening] = useState(false);
  const recogRef = useRef<SpeechRecognitionLike | null>(null);

  // ✅ ユーザーが「録音継続したい」意思（onend対策）
  const wantListeningRef = useRef(false);
  // ✅ 認識された “最終全文” の変化監視（増殖対策）
  const lastFinalAllRef = useRef("");
  // ✅ 録音開始時点のテキスト（手入力分）を保持
  const baseTextRef = useRef("");

  const currentQ = queue[index];
  const modeLabel = useMemo(() => MODE_LABEL[mode], [mode]);

  // 質問が切り替わったらヒントは閉じる
  useEffect(() => {
    setHintOpen(false);
  }, [index]);

  const charCount = useMemo(() => (answer || "").replace(/\s/g, "").length, [answer]);
  const minChars = useMemo(() => currentQ?.minChars ?? 120, [currentQ]);

  // ---- 質問タイプ判定（追加＝制限なし）----
  const kindStr = String((currentQ as any)?.kind ?? "");
  const idStr = String((currentQ as any)?.id ?? "");

  const isAdditional = idStr.toLowerCase().startsWith("add") || kindStr === "additional";

  const isThreeMajorMain =
    kindStr === "core" &&
    (currentQ?.depthLevel ?? 0) === 0 &&
    !!inferQuestionTypeFromSection(currentQ?.section);

  // 深掘りは必ず制限あり（depthLevel>0 は制限側）
  const isCoreOrDeepDive = !isAdditional || (currentQ?.depthLevel ?? 0) > 0;

  // 文字数制限：三大質問＋深掘りのみ有効（追加は常にOK）
  const isValid = isCoreOrDeepDive ? charCount >= minChars : true;

  const progress = useMemo(() => {
    if (!queue.length) return 0;
    return Math.min(1, Math.max(0, (index + 1) / queue.length));
  }, [queue.length, index]);

  // -----------------------------
  // 初期化：mode + 質問ロード
  // -----------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;

    const m = sessionStorage.getItem("kcareer.session.mode") as ModeTag | null;
    if (!m) {
      router.replace("/start");
      return;
    }
    setMode(m);

    const ac = new AbortController();

    (async () => {
      try {
        setIsLoading(true);

        const [coreRes, addRes] = await Promise.all([
          fetch("/questions/core_questions.csv", { signal: ac.signal }),
          fetch("/questions/additional_questions.csv", { signal: ac.signal }),
        ]);

        if (!coreRes.ok) throw new Error("core_questions.csv の読み込みに失敗しました");
        if (!addRes.ok) throw new Error("additional_questions.csv の読み込みに失敗しました");

        const [coreText, addText] = await Promise.all([coreRes.text(), addRes.text()]);

        const coreItems = expandCoreQuestions(coreText);
        const additionalItems = expandAdditionalQuestions(addText, m);

        const core = (coreItems || [])
          .map((x) => toInterviewQuestion(x, m, 120))
          .filter(Boolean) as InterviewQuestion[];

        const additional = (additionalItems || [])
          .map((x) => toInterviewQuestion({ ...(x as any), kind: "additional" }, m, 120))
          .filter(Boolean) as InterviewQuestion[];

        const q = [...core, ...additional];

        // 三大質問“本体”だけ minChars を維持、それ以外は 120
        const normalized = q.map((qq: any) => {
          const depth = qq?.depthLevel ?? 0;
          const section = String(qq?.section ?? "").toLowerCase();

          const isThreeMajorMain2 =
            depth === 0 &&
            (section.includes("motivation") ||
              section.includes("self") ||
              section.includes("pr") ||
              section.includes("gaku") ||
              section.includes("challenge"));

          if (isThreeMajorMain2) return qq;
          return { ...qq, minChars: 120 };
        });

        setQueue(normalized);
        setIndex(0);
        setAnswer("");
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        console.error(e);
        alert(String(e));
      } finally {
        setIsLoading(false);
      }
    })();

    return () => ac.abort();
  }, [router]);

  // -----------------------------
  // 音声入力セットアップ（Android/Chrome向けの安定版）
  // -----------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    const recog: SpeechRecognitionLike = new SR();
    recog.lang = "ja-JP";
    recog.interimResults = true;

    // ✅ 端末差が激しいので false + onend自動復帰が安定しやすい
    recog.continuous = false;

recog.onresult = (event: any) => {
  // ✅ その回で確定した final だけ拾う（continuous=false前提）
  let finalText = "";
  for (let i = event.resultIndex; i < event.results.length; i++) {
    const r = event.results[i];
    if (r?.isFinal) finalText += String(r[0]?.transcript ?? "");
  }

  const fixed = correctLightRealtime(finalText).trim();

  // ✅ 何も確定してない時に、空で上書きしない
  if (!fixed) return;

  // ✅ 同じ確定文の連発を無視（増殖＆二重反映対策）
  if (fixed === lastFinalAllRef.current) return;
  lastFinalAllRef.current = fixed;

  // ✅ 「古いbase」ではなく、いまのbaseに追記して確定させる
  const next = (baseTextRef.current + fixed).trimStart();

  // ✅ 画面に反映
  setAnswer(next);

  // ✅ ここが本丸：確定したら base を最新に更新
  // これで無音→onend→再開しても、消えない
  baseTextRef.current = next;
};

    recog.onerror = () => {
      setListening(false);
      // onend 側で復帰（権限/一時エラーでも暴走しにくい）
    };

    recog.onend = () => {
      setListening(false);

      // ✅ ユーザーが「録音継続」意思なら自動復帰
      if (wantListeningRef.current) {
        window.setTimeout(() => {
          try {
            recog.start();
            setListening(true);
          } catch {
            // start失敗は無視（連打や権限など）
          }
        }, 250);
      }
    };

    recogRef.current = recog;

    return () => {
      wantListeningRef.current = false;
      try {
        recog.stop();
      } catch {}
      recogRef.current = null;
    };
  }, []);

  async function stopAndFinalizeSpeechIfNeeded(): Promise<string> {
    const rawNow = stripInterim(answer);

    if (!wantListeningRef.current) {
      return correctStrictFinal(rawNow).text;
    }

    wantListeningRef.current = false;
    try {
      recogRef.current?.stop?.();
    } catch {}

    const fixed = correctStrictFinal(rawNow).text;
    setAnswer(fixed);
    setListening(false);

    // 次回のためにリセット
    lastFinalAllRef.current = "";
    baseTextRef.current = fixed ? fixed + "" : "";

    return fixed;
  }

  async function toggleSpeech() {
    const recog = recogRef.current;
    if (!recog) {
      alert("このブラウザは音声入力に未対応です（Chrome/Android推奨）");
      return;
    }

    // stop
    if (wantListeningRef.current) {
      wantListeningRef.current = false;
      try {
        recog.stop();
      } catch {}
      setListening(false);
      return;
    }

    // start
    wantListeningRef.current = true;

    const base = stripInterim(answer);
    baseTextRef.current = base ? base + "" : "";
    lastFinalAllRef.current = "";

    try {
      recog.start();
      setListening(true);
    } catch {
      alert("音声入力を開始できませんでした（マイク許可を確認してください）");
      wantListeningRef.current = false;
      setListening(false);
    }
  }

  function saveAnswerToSession(q: InterviewQuestion, text: string) {
    if (typeof window === "undefined") return;

    const raw = sessionStorage.getItem("kcareer.session.answers");
    const arr: {
      questionText: string;
      answerText: string;
      kind?: string;
      section?: string;
      depthLevel?: number;
    }[] = raw ? JSON.parse(raw) : [];

    arr.push({
      questionText: q.text,
      answerText: text,
      kind: String((q as any)?.kind ?? ""),
      section: (q as any)?.section ? String((q as any).section) : undefined,
      depthLevel: typeof (q as any)?.depthLevel === "number" ? (q as any).depthLevel : undefined,
    });

    sessionStorage.setItem("kcareer.session.answers", JSON.stringify(arr));
  }

  // -----------------------------
  // 次へ：深掘り差し込み→進行
  // -----------------------------
  async function onNext() {
    if (!currentQ || isLoading) return;
    if (isAdvancing) return;
    setIsAdvancing(true);

    try {
      const finalized = await stopAndFinalizeSpeechIfNeeded();
      const cleaned = stripInterim(finalized);

      // 制限は「三大質問＋深掘り」だけ
      if (isCoreOrDeepDive) {
        if (cleaned.replace(/\s/g, "").length < minChars) return;
      }

      // 追加質問は空なら保存せず次へ
      if (cleaned.length > 0) {
        saveAnswerToSession(currentQ, cleaned);
      }

      // 三大質問の core本体だけ深掘り差し込み
      const k = String((currentQ as any).kind ?? "");
      const isCoreMain =
        (k === "core" || k === "coreDepth" || k === "core-depth") &&
        (currentQ.depthLevel ?? 0) === 0 &&
        !!currentQ.section;

      let nextQueue = queue;

      if (isCoreMain) {
        const qType = inferQuestionTypeFromSection(currentQ.section);
        if (qType) {
          const tone: Tone = "strict";
          nextQueue = await insertDeepDives({
            queue,
            atIndex: index,
            answer: cleaned,
            type: qType,
            tone,
            mode,
            maxDeepDives: 3,
          });

          // 三大質問本体以外は minChars=120 に固定（deepDiveも含む）
          nextQueue = nextQueue.map((qq: any) => {
            const depth = qq?.depthLevel ?? 0;
            const section = String(qq?.section ?? "").toLowerCase();

            const isThreeMajorMain2 =
              depth === 0 &&
              (section.includes("motivation") ||
                section.includes("self") ||
                section.includes("pr") ||
                section.includes("gaku") ||
                section.includes("challenge"));

            if (isThreeMajorMain2) return qq;
            return { ...qq, minChars: 120 };
          });

          setQueue(nextQueue);
        }
      }

      const nextIndex = index + 1;

      if (nextIndex >= nextQueue.length) {
        if (typeof window !== "undefined") {
          if (!sessionStorage.getItem("kcareer.session.trainedAt")) {
            sessionStorage.setItem("kcareer.session.trainedAt", new Date().toISOString());
          }
          sessionStorage.setItem("kcareer.session.mode", mode);

          // フィードバック生成（ローカル版）
          try {
            const rawAnswers = sessionStorage.getItem("kcareer.session.answers");
            const qa = rawAnswers ? JSON.parse(rawAnswers) : [];

            const { bundleAnswersSimple } = await import("@/lib/feedback/bundleSimple");
            const { generateFeedbackLocal } = await import("@/lib/feedback/generateLocal");
            const { saveFeedbackToSession } = await import("@/lib/feedback/sessionWriter");

            const bundles = bundleAnswersSimple(qa, mode);
            const items = generateFeedbackLocal(mode, bundles);
            saveFeedbackToSession(items);
          } catch (e) {
            console.error(e);
          }
        }

        router.push("/interview/finish");
        return;
      }

      setIndex(nextIndex);
      setAnswer("");

      // ✅ 次の質問へ行ったら、音声用の「ベース」も更新しておく（事故予防）
      baseTextRef.current = "";
      lastFinalAllRef.current = "";
    } finally {
      setIsAdvancing(false);
    }
  }

  const current = index + 1;
  const total = queue.length;

  // =============================
  // ✅ ここがスクロール修正の本丸
  // - main を h固定しない
  // - 中央カードに max-height + overflow-y-auto を持たせる
  // =============================
  return (
    <main className="min-h-[100svh] w-full bg-slate-100 flex justify-center">
      <div className="w-[390px] max-w-[92vw] px-3 pt-2 pb-6">
        <div className="relative w-full rounded-[28px] overflow-hidden shadow-2xl border border-white/30">
          {/* 背景 */}
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

          {/* ✅ スクロール領域 */}
          <div className="relative max-h-[calc(100svh-24px)] overflow-y-auto overscroll-contain">
            <div className="px-5 pt-4 pb-6">
              <div className="mt-4 text-center">
                <h1
                  className="text-[30px] font-extrabold text-white tracking-wide"
                  style={{ textShadow: "0 2px 10px rgba(0,0,0,0.35)" }}
                >
                  面接トレーニング
                </h1>
                <p
                  className="mt-1 text-[14px] font-semibold text-white/95"
                  style={{ textShadow: "0 2px 10px rgba(0,0,0,0.35)" }}
                >
                  Dialogue Trainer for Med. Interview
                </p>
                <p className="mt-2 text-[14px] font-extrabold text-red-500">{modeLabel}</p>
              </div>

              <div className="mt-4 rounded-[22px] border-2 border-white/55 p-4 bg-sky-100/85 shadow-[0_10px_30px_rgba(0,0,0,0.18)]">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold text-slate-700">進行</span>
                  <span className="text-[12px] font-bold text-slate-700">
                    {isLoading ? "-" : `${current} / ${total}`}
                  </span>
                </div>

                <div className="mt-2 h-3 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>

                <div className="mt-4 relative rounded-[18px] border border-white/70 bg-white/55 p-4">
                  {/* 質問文 */}
                  <div className="pr-10">
                    <p className="text-[18px] font-extrabold text-slate-800 leading-snug">
                      {isLoading ? "読み込み中..." : currentQ?.text || "（質問がありません）"}
                    </p>
                  </div>

                  {/* 「？」ボタン：三大質問のときだけ */}
                  {isThreeMajorMain && (
                    <button
                      type="button"
                      className="absolute top-3 right-3 w-8 h-8 rounded-full bg-sky-200/70 border border-white/70 flex items-center justify-center text-slate-700 font-black"
                      title="ヒント"
                      onClick={() => setHintOpen(true)}
                    >
                      ?
                    </button>
                  )}

                  {/* ヒントカード（モーダル） */}
                  {hintOpen && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center p-4">
                      <button
                        type="button"
                        className="absolute inset-0 bg-black/40"
                        onClick={() => setHintOpen(false)}
                        aria-label="close hint overlay"
                      />
                      <div className="relative w-full max-w-[320px] rounded-2xl bg-white p-4 shadow-xl border border-slate-200">
                        <div className="flex items-start justify-between">
                          <h3 className="text-[14px] font-extrabold text-slate-800">ヒント</h3>
                          <button
                            type="button"
                            className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-black"
                            onClick={() => setHintOpen(false)}
                            aria-label="close hint"
                          >
                            ×
                          </button>
                        </div>

                        <p className="mt-2 text-[13px] leading-relaxed text-slate-700 whitespace-pre-wrap">
                          {currentQ?.hint || "ヒントはありません"}
                        </p>

                        <div className="mt-4 flex justify-end">
                          <button
                            type="button"
                            className="rounded-xl bg-sky-200 px-4 py-2 text-[12px] font-bold text-slate-800"
                            onClick={() => setHintOpen(false)}
                          >
                            閉じる
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 回答欄 */}
                  <textarea
                    className="mt-3 w-full min-h-[220px] rounded-[16px] border border-slate-300 bg-white p-3 text-[14px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-300"
                    placeholder="ここに回答を入力してください。"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                  />

                  <div className="mt-2 flex items-center justify-between">
                    <div className="text-[12px] font-bold text-slate-700">
                      {charCount}文字
                      {isCoreOrDeepDive && (
                        <span className={isValid ? "text-emerald-700" : "text-red-500"}>
                          {" "}
                          （{minChars}文字以上が必要）
                        </span>
                      )}
                    </div>
                    <div className="text-[12px] font-bold text-slate-500">
                      kind:{" "}
                      <span className="text-slate-700">{String((currentQ as any)?.kind || "-")}</span>
                    </div>
                  </div>

                  <div className="mt-3 text-[12px] leading-relaxed text-slate-700 font-semibold">
                    <p>テキスト入力／音声入力のどちらも利用できます。</p>
                    <p>上手く認識しない場合はテキストで入力して下さい。</p>
                    <p>※「まる」と音声入力すると句点を付けられます。</p>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-[11px] text-slate-600 font-semibold">
                      Android/Chrome は右の🎤で音声入力。iPhone はキーボードのマイクをご利用ください。
                    </p>

                    <button
                      type="button"
                      className={[
                        "ml-3 shrink-0 w-14 h-14 rounded-full border-2 shadow flex items-center justify-center transition",
                        listening ? "bg-red-100 border-red-200" : "bg-white/80 border-slate-200",
                      ].join(" ")}
                      title="音声入力"
                      onClick={toggleSpeech}
                    >
                      <span className="text-[22px]">{listening ? "⏹" : "🎤"}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 次へ */}
              <div className="mt-5 flex justify-center pb-2">
                <button
                  type="button"
                  onClick={onNext}
                  disabled={!isValid || isLoading || !currentQ || isAdvancing}
                  className={[
                    "w-[240px] h-[56px] rounded-full font-extrabold text-[18px] shadow-lg transition-all",
                    isValid && !isLoading && currentQ && !isAdvancing
                      ? "bg-sky-300 text-slate-900 hover:bg-sky-200"
                      : "bg-slate-300 text-slate-500 cursor-not-allowed",
                  ].join(" ")}
                  style={{ textShadow: isValid ? "0 1px 0 rgba(255,255,255,0.35)" : "none" }}
                >
                  次へ
                </button>
              </div>

              {/* ちょい余白 */}
              <div className="h-2" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
