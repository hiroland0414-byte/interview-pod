// src/app/impression/record/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const BG_SRC = "/images/sky_cloud.jpg";

type Phase = "idle" | "countdown" | "recording";

type SelfCheck = {
  eye?: "good" | "mid" | "bad";
  voice?: "good" | "mid" | "bad";
};

type ImpressionSnap = {
  trainedAt: string;
  seconds: number;
  score?: number; // データ不足時は undefined
  feedback: string; // 先頭が【データ不足】なら強調表示
  meta?: {
    faceMissingRatio?: number;
    faceCheckAvailable?: boolean;
  };
  radar?: {
    items: [string, string, string, string, string];
    values: [number, number, number, number, number];
  };
  selfCheck?: SelfCheck; // result側で更新して保存
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
function nowIso() {
  return new Date().toISOString();
}

export default function ImpressionRecordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const auto = searchParams.get("auto") === "1";

  // ---- 仕様パラメータ ----
  const MAX_SEC = 60;
  const MIN_SEC = 30;
  const COUNTDOWN_SEC = 5;

  // ---- state ----
  const [phase, setPhase] = useState<Phase>("idle");
  const [countdown, setCountdown] = useState<number>(COUNTDOWN_SEC);
  const [recordedSec, setRecordedSec] = useState<number>(0);
  const canFinish = recordedSec >= MIN_SEC;

  const [errorMsg, setErrorMsg] = useState<string>("");

  // ---- media refs ----
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // ---- timers ----
  const countdownTimerRef = useRef<number | null>(null);
  const recordTimerRef = useRef<number | null>(null);

  // ---- face detect (optional) ----
  const faceTimerRef = useRef<number | null>(null);
  const faceMissingTickRef = useRef<number>(0);
  const faceTickRef = useRef<number>(0);
  const faceCheckAvailableRef = useRef<boolean>(false);

  // ---- progress ----
  const progress = useMemo(() => {
    if (phase !== "recording") return 0;
    return clamp(recordedSec / MAX_SEC, 0, 1);
  }, [phase, recordedSec]);

  // ---- ガイド表示（録画中は薄く）----
  const guideOpacity = phase === "recording" ? 0.2 : 1.0;

  // -----------------------------
  // utilities: cleanup
  // -----------------------------
  function clearTimers() {
    if (countdownTimerRef.current) window.clearInterval(countdownTimerRef.current);
    countdownTimerRef.current = null;

    if (recordTimerRef.current) window.clearInterval(recordTimerRef.current);
    recordTimerRef.current = null;

    if (faceTimerRef.current) window.clearInterval(faceTimerRef.current);
    faceTimerRef.current = null;
  }

  function stopStream() {
    const s = streamRef.current;
    if (s) {
      s.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {}
      });
    }
    streamRef.current = null;

    if (videoRef.current) {
      try {
        videoRef.current.srcObject = null;
      } catch {}
    }
  }

  function hardResetToIdle() {
    clearTimers();

    // recorder stop
    try {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
    } catch {}
    recorderRef.current = null;
    chunksRef.current = [];

    stopStream();

    faceMissingTickRef.current = 0;
    faceTickRef.current = 0;
    faceCheckAvailableRef.current = false;

    setRecordedSec(0);
    setCountdown(COUNTDOWN_SEC);
    setPhase("idle");
  }

  useEffect(() => {
    return () => {
      try {
        hardResetToIdle();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -----------------------------
  // setup media + recorder
  // -----------------------------
  async function ensureStream(): Promise<MediaStream> {
    if (streamRef.current) return streamRef.current;

    const s = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: true,
    });

    streamRef.current = s;

    if (videoRef.current) {
      videoRef.current.srcObject = s;
      try {
        await videoRef.current.play();
      } catch {}
    }

    return s;
  }

  async function setupFaceDetector() {
    const FaceDetectorCtor = (window as any).FaceDetector;
    if (!FaceDetectorCtor) {
      faceCheckAvailableRef.current = false;
      return;
    }

    faceCheckAvailableRef.current = true;
    const detector = new FaceDetectorCtor({ fastMode: true, maxDetectedFaces: 1 });

    if (faceTimerRef.current) window.clearInterval(faceTimerRef.current);
    faceTimerRef.current = window.setInterval(async () => {
      try {
        const v = videoRef.current;
        if (!v) return;
        if (v.readyState < 2) return;

        faceTickRef.current += 1;
        const faces = await detector.detect(v);
        if (!faces || faces.length === 0) faceMissingTickRef.current += 1;
      } catch {
        // detect失敗は未検出扱いにしない
      }
    }, 500);
  }

  function startRecorder(stream: MediaStream) {
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream);
    recorderRef.current = recorder;

    recorder.ondataavailable = (ev: BlobEvent) => {
      if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
    };

    // 1秒ごとにチャンク
    recorder.start(1000);
  }

  async function startRecording() {
    const stream = await ensureStream();
    await setupFaceDetector();
    startRecorder(stream);
  }

  async function stopRecording(): Promise<Blob | null> {
    const recorder = recorderRef.current;
    if (!recorder) return null;

    return new Promise((resolve) => {
      const finalize = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "video/webm" });
        resolve(blob);
      };

      try {
        recorder.onstop = finalize;
        recorder.stop();
      } catch {
        finalize();
      }
    });
  }

  // -----------------------------
  // start flow: button => countdown
  // -----------------------------
  async function onStart() {
    setErrorMsg("");
    if (phase === "countdown" || phase === "recording") return;

    try {
      await ensureStream();
    } catch (e) {
      console.error(e);
      setErrorMsg("録画を開始できませんでした（カメラ・マイク許可を確認してください）");
      return;
    }

    faceMissingTickRef.current = 0;
    faceTickRef.current = 0;

    setCountdown(COUNTDOWN_SEC);
    setRecordedSec(0);
    setPhase("countdown");
  }

function onBack() {
  try {
    hardResetToIdle(); // 録画/タイマー/ストリーム全部停止（= マイクOFF）
  } catch {}
  router.push("/start"); // ✅ モード選択画面へ
}

  // ✅ 要件：ページ入場でプレビュー。auto=1なら即カウント開始
  useEffect(() => {
    if (phase !== "idle") return;
    setErrorMsg("");

    (async () => {
      try {
        await ensureStream();
        if (auto) {
          faceMissingTickRef.current = 0;
          faceTickRef.current = 0;
          setCountdown(COUNTDOWN_SEC);
          setRecordedSec(0);
          setPhase("countdown");
        }
      } catch (e) {
        console.error(e);
        setErrorMsg("カメラ・マイクの許可が必要です（Android/Chrome 推奨）");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, auto]);

  // -----------------------------
  // countdown effect
  // -----------------------------
  useEffect(() => {
    if (phase !== "countdown") return;

    if (countdownTimerRef.current) window.clearInterval(countdownTimerRef.current);
    countdownTimerRef.current = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownTimerRef.current) window.clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
          setPhase("recording");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownTimerRef.current) {
        window.clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
    };
  }, [phase]);

  // -----------------------------
  // recording phase effect
  // -----------------------------
  useEffect(() => {
    if (phase !== "recording") return;

    setErrorMsg("");
    setRecordedSec(0);

    (async () => {
      try {
        await startRecording();
      } catch (e) {
        console.error(e);
        setErrorMsg("録画を開始できませんでした（カメラ・マイク許可を確認してください）");
        setPhase("idle");
        return;
      }

      if (recordTimerRef.current) window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = window.setInterval(() => {
        setRecordedSec((prev) => {
          const next = prev + 1;
          if (next >= MAX_SEC) {
            if (recordTimerRef.current) window.clearInterval(recordTimerRef.current);
            recordTimerRef.current = null;
            void stopAndGoResult("timeout", MAX_SEC);
            return MAX_SEC;
          }
          return next;
        });
      }, 1000);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // -----------------------------
  // evaluate（無音は評価しない：顔未検出のみデータ不足理由に採用）
  // -----------------------------
  function mapSelf(v?: "good" | "mid" | "bad") {
    if (v === "good") return 15;
    if (v === "mid") return 8;
    if (v === "bad") return 0;
    return 8; // 未入力は中間扱い（resultで更新）
  }

  function buildResult(seconds: number): ImpressionSnap {
    const faceTicks = faceTickRef.current;
    const faceMissingTicks = faceMissingTickRef.current;
    const faceCheckAvailable = faceCheckAvailableRef.current;

    const faceMissingRatio =
      faceCheckAvailable && faceTicks > 0 ? faceMissingTicks / faceTicks : undefined;

    const tooShort = seconds < MIN_SEC;
    const tooFaceMissing = faceCheckAvailable && (faceMissingRatio ?? 1) >= 0.6;

    const baseMeta = { faceMissingRatio, faceCheckAvailable };

    // ---- C：データ不足 ----
    if (tooShort || tooFaceMissing) {
      const reasons: string[] = [];
      if (tooShort) reasons.push(`録画時間が${MIN_SEC}秒未満`);
      if (tooFaceMissing) reasons.push("顔の未検出が多い（枠外が多い）");

      return {
        trainedAt: nowIso(),
        seconds,
        score: undefined,
        feedback:
          "【データ不足】\n" +
          "点数表示は行いません。\n" +
          `理由：${reasons.join("／")}\n\n` +
          "【やること（2つだけ）】\n" +
          "① 顔が枠内に入る距離・角度に固定（机に肘／スマホ固定）\n" +
          `② ${MIN_SEC}秒以上、途切れずに話す（内容は何でもOK）`,
        meta: baseMeta,
      };
    }

    // ---- 点数（100）----
    // 時間：30→0、60→25
    const timeScore = clamp(((seconds - MIN_SEC) / (MAX_SEC - MIN_SEC)) * 25, 0, 25);

    // 顔の安定：欠落0→45
    const faceScore = faceCheckAvailable
      ? clamp((1 - (faceMissingRatio ?? 0)) * 45, 0, 45)
      : 0;

    // セルフ（未入力は中間）
    const selfEye = mapSelf(undefined);
    const selfVoice = mapSelf(undefined);

    // FaceDetector無し端末の再配分（破綻防止）
    const base = faceCheckAvailable
      ? faceScore + timeScore + selfEye + selfVoice
      : timeScore + clamp((selfEye / 15) * 25, 0, 25) + clamp((selfVoice / 15) * 25, 0, 25) + 25;

    const score = Math.round(clamp(base, 0, 100));

    // ---- A/B 判定 ----
    const needImprove = (faceCheckAvailable && (faceMissingRatio ?? 0) >= 0.25) || seconds < 40;
    const grade = needImprove ? "B" : "A";

    // ---- レーダー（0-100）----
    const vStability = faceCheckAvailable
      ? Math.round(clamp((1 - (faceMissingRatio ?? 0)) * 100, 0, 100))
      : 60;

    const vTempo = Math.round(clamp(50 + ((seconds - MIN_SEC) / 30) * 40, 50, 90));
    const vEye = 60; // resultで更新
    const vVoice = 60; // resultで更新
    const vExpression = 55; // 現状は仮（後で表情検出が入ったら置換）

    const radar = {
      items: ["姿勢・安定感", "表情", "目線", "声の明瞭さ", "話すテンポ"],
      values: [vStability, vExpression, vEye, vVoice, vTempo],
    } as ImpressionSnap["radar"];

    // ---- 次の一手（1つ）----
    let nextAction = "次回は「目線をカメラ付近に固定」だけをテーマに録画しましょう。";
    if (faceCheckAvailable && (faceMissingRatio ?? 0) >= 0.25) {
      nextAction = "次回は「顔が枠から出ない距離・角度の固定」だけをテーマに録画しましょう。";
    } else if (seconds < 40) {
      nextAction = "次回は「冒頭3秒（挨拶→名乗り→一言）を固定」だけをテーマに録画しましょう。";
    }

    const header = grade === "A" ? "【総評（評価OK：良好）】\n" : "【総評（評価OK：要改善）】\n";
    const body =
      grade === "A"
        ? "第一印象は「安定感」で決まります。今回は大きく崩れていません。この状態を“再現”できれば勝ちです。\n\n"
        : "第一印象は「安定感」で決まります。今回は“もったいない癖”が少し出ています。直せば一気に上がります。\n\n";

    const good =
      "【良かったところ】\n" +
      "・30秒以上話せている時点で、評価に必要なデータは取れています。\n\n";

    const improve =
      "【改善ポイント（優先度順）】\n" +
      "① 目線（カメラ付近）を固定\n" +
      "② 語尾を飲み込まず言い切る\n" +
      "③ 表情：口角を少し上げる\n\n";

    const next = `【次の一手（1つだけ）】\n・${nextAction}`;

    return {
      trainedAt: nowIso(),
      seconds,
      score,
      feedback: header + body + good + improve + next,
      meta: baseMeta,
      radar,
      selfCheck: {},
    };
  }

  function saveSnapToSession(s: ImpressionSnap) {
    sessionStorage.setItem("kcareer.impression.snap", JSON.stringify(s));
  }

  // -----------------------------
  // stop + evaluate -> result page
  // -----------------------------
  async function stopAndGoResult(reason: "manual" | "timeout", secOverride?: number) {
    if (recordTimerRef.current) window.clearInterval(recordTimerRef.current);
    recordTimerRef.current = null;

    if (faceTimerRef.current) window.clearInterval(faceTimerRef.current);
    faceTimerRef.current = null;

    const sec = typeof secOverride === "number" ? secOverride : recordedSec;

    try {
      await stopRecording();
    } catch {}

    stopStream();

    const result = buildResult(sec);
    saveSnapToSession(result);

    router.push("/impression/result");
  }

  async function onFinish() {
    if (phase !== "recording") return;
    if (!canFinish) return;
    await stopAndGoResult("manual");
  }

  // -----------------------------
  // render
  // -----------------------------
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
            {/* title */}
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

            {/* =========================
               recording UI（広め）
               ========================= */}
            <div className="mt-4 rounded-[22px] border-2 border-white/55 p-4 bg-sky-100/85 shadow-[0_10px_30px_rgba(0,0,0,0.18)]">
              <div className="relative rounded-2xl overflow-hidden border border-white/70 bg-black/10">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="w-full h-[48svh] object-cover bg-black"
                />

                {/* ガイド（スクエア枠は常に／顔肩は録画中薄く） */}
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                  <div
                    className="w-[72%] h-[88%] rounded-[28px] border-2 border-white/70 bg-white/5
                               shadow-[inset_0_0_0_2px_rgba(255,255,255,0.08)]"
                  />
                  <svg
                    className="absolute w-[72%] h-[88%] transition-opacity duration-200"
                    viewBox="0 0 100 140"
                    fill="none"
                    aria-hidden="true"
                    style={{ opacity: guideOpacity }}
                  >
                    <ellipse
                      cx="50"
                      cy="55"
                      rx="42"
                      ry="55"
                      stroke="rgba(255,255,255,0.75)"
                      strokeWidth="2"
                    />
                    <path
                      d="M8 135c14-12 28-18 42-18s28 6 42 18"
                      stroke="rgba(255,255,255,0.65)"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>

                {/* カウントダウン表示 */}
                {phase === "countdown" && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center">
                    <div className="w-[86%] rounded-2xl bg-white/70 border border-white/70 px-4 py-6 text-center">
                      <p className="text-[14px] font-extrabold text-slate-800">まもなく開始</p>
                      <p className="text-[56px] font-extrabold text-sky-600 leading-none">
                        {countdown}
                      </p>
                      <p className="mt-1 text-[12px] font-semibold text-slate-700">
                        （{MIN_SEC}秒以上話してください）
                      </p>
                    </div>
                  </div>
                )}

                {/* 録画中オーバーレイ */}
                {phase === "recording" && (
                  <div className="absolute left-3 right-3 bottom-3 z-20 rounded-xl bg-white/70 border border-white/70 px-3 py-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[12px] font-bold text-slate-800">
                        録画中：{recordedSec}s / {MAX_SEC}s
                      </p>
                      <p
                        className={
                          canFinish
                            ? "text-[12px] font-extrabold text-emerald-700"
                            : "text-[12px] font-bold text-slate-500"
                        }
                      >
                        {canFinish ? "終了できます" : `終了は${MIN_SEC}s以降`}
                      </p>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${progress * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* エラーだけは下に出す（最小） */}
              {errorMsg && (
                <p className="mt-3 text-[12px] font-extrabold text-red-600 whitespace-pre-wrap">
                  {errorMsg}
                </p>
              )}

{/* buttons：モード選択＋次へ（スタート/終了） */}
<div className="mt-4 flex items-center justify-between gap-2">
  <button
    type="button"
    onClick={onBack}
    className="flex-1 h-[48px] rounded-full font-extrabold text-[16px] shadow-lg transition-all bg-sky-200/90 text-slate-900 hover:bg-sky-200 border border-white/70"
  >
    モード選択
  </button>

  <button
    type="button"
    onClick={phase === "idle" ? onStart : onFinish}
    disabled={phase === "countdown" || (phase === "recording" && !canFinish)}
    className={[
      "flex-1 h-[48px] rounded-full font-extrabold text-[16px] shadow-lg transition-all",
      phase === "idle"
        ? "bg-sky-300 text-slate-900 hover:bg-sky-200"
        : phase === "recording" && canFinish
          ? "bg-red-300 text-slate-900 hover:bg-red-200"
          : "bg-slate-300 text-slate-500 cursor-not-allowed",
    ].join(" ")}
  >
    {phase === "idle" ? "スタート" : "次へ"}
  </button>
</div>
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
