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

function toInterviewQuestion(
  x: any,
  mode: ModeTag,
  minCharsDefault = 120
): InterviewQuestion | null {
  const id = asText(x?.id);
  const text = asText(x?.text) || asText(x?.question) || asText(x?.questionText);
  if (!id || !text) return null;

  const hint = asText(x?.hint) || "";
  const kind = (asText(x?.kind) || "core") as any;

  const depthLevel =
    typeof x?.depthLevel === "number"
      ? x.depthLevel
      : asText(x?.parentId)
      ? 1
      : 0;

  const minChars =
    typeof x?.minChars === "number" && Number.isFinite(x.minChars)
      ? x.minChars
      : minCharsDefault;

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

  const [hintOpen, setHintOpen] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);

  /** 音声入力 */
  const [listening, setListening] = useState(false);
  const recogRef = useRef<SpeechRecognitionLike | null>(null);

  /** 確定済みテキスト（無音停止・再開でも消えない核） */
  const committedRef = useRef<string>("");

  /** ユーザーが明示的に止めたか */
  const stopRequestedRef = useRef<boolean>(false);

  /** 無音停止後の再開制御 */
  const restartTimerRef = useRef<number | null>(null);

  const currentQ = queue[index];
  const modeLabel = MODE_LABEL[mode];

  useEffect(() => {
    setHintOpen(false);
  }, [index]);

  const charCount = useMemo(
    () => answer.replace(/\s/g, "").length,
    [answer]
  );

  const minChars = currentQ?.minChars ?? 120;

  const kindStr = String((currentQ as any)?.kind ?? "");
  const idStr = String((currentQ as any)?.id ?? "");

  const isAdditional =
    idStr.toLowerCase().startsWith("add") || kindStr === "additional";

  const isThreeMajorMain =
    kindStr === "core" &&
    (currentQ?.depthLevel ?? 0) === 0 &&
    !!inferQuestionTypeFromSection(currentQ?.section);

  const isCoreOrDeepDive = !isAdditional || (currentQ?.depthLevel ?? 0) > 0;

  const isValid = isCoreOrDeepDive ? charCount >= minChars : true;

  const progress = queue.length
    ? Math.min(1, (index + 1) / queue.length)
    : 0;

  /** 初期化 */
  useEffect(() => {
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

        const coreItems = expandCoreQuestions(await coreRes.text());
        const addItems = expandAdditionalQuestions(await addRes.text(), m);

        const core = coreItems
          .map((x) => toInterviewQuestion(x, m))
          .filter(Boolean) as InterviewQuestion[];

        const add = addItems
          .map((x) =>
            toInterviewQuestion({ ...(x as any), kind: "additional" }, m)
          )
          .filter(Boolean) as InterviewQuestion[];

        setQueue([...core, ...add]);
        setIndex(0);
        setAnswer("");
        committedRef.current = "";
      } finally {
        setIsLoading(false);
      }
    })();

    return () => ac.abort();
  }, [router]);

  /** 音声認識 */
  useEffect(() => {
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SR) return;

    const recog: SpeechRecognitionLike = new SR();
    recog.lang = "ja-JP";
    recog.interimResults = true;
    recog.continuous = false;

    recog.onresult = (e: any) => {
      let interim = "";
      let finalText = "";

      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0]?.transcript ?? "";
        if (e.results[i].isFinal) finalText += t;
        else interim += t;
      }

      if (finalText) {
        committedRef.current = (
          committedRef.current + correctLightRealtime(finalText)
        ).trimStart();
      }

      setAnswer(
        (committedRef.current + correctLightRealtime(interim)).trimStart()
      );
    };

    recog.onend = () => {
      if (!stopRequestedRef.current) {
        restartTimerRef.current = window.setTimeout(() => {
          try {
            recog.start();
            setListening(true);
          } catch {}
        }, 200);
      } else {
        setListening(false);
      }
    };

    recog.onerror = () => setListening(false);

    recogRef.current = recog;

    return () => {
      if (restartTimerRef.current)
        window.clearTimeout(restartTimerRef.current);
      try {
        stopRequestedRef.current = true;
        recog.stop();
      } catch {}
    };
  }, []);

  async function stopAndFinalizeSpeech() {
    stopRequestedRef.current = true;
    try {
      recogRef.current?.stop();
    } catch {}
    const fixed = correctStrictFinal(stripInterim(answer)).text;
    committedRef.current = fixed;
    setAnswer(fixed);
    setListening(false);
    return fixed;
  }

  async function toggleSpeech() {
    if (!recogRef.current) return;

    if (listening) {
      await stopAndFinalizeSpeech();
      return;
    }

    committedRef.current = stripInterim(answer);
    stopRequestedRef.current = false;

    try {
      recogRef.current.start();
      setListening(true);
    } catch {}
  }

  function goModeSelect() {
    try {
      stopRequestedRef.current = true;
      recogRef.current?.stop();
    } catch {}
    setListening(false);
    router.push("/start");
  }

  function clearAnswer() {
    committedRef.current = "";
    setAnswer("");
  }

  async function onNext() {
    if (!currentQ || isLoading || isAdvancing) return;
    setIsAdvancing(true);

    try {
      const text = await stopAndFinalizeSpeech();
      if (isCoreOrDeepDive && text.replace(/\s/g, "").length < minChars) return;

      const nextIndex = index + 1;
      if (nextIndex >= queue.length) {
        router.push("/interview/finish");
        return;
      }

      setIndex(nextIndex);
      setAnswer("");
      committedRef.current = "";
    } finally {
      setIsAdvancing(false);
    }
  }

  return (
    <main className="relative w-full h-[100svh] flex justify-center bg-slate-100">
      <div className="w-[440px] max-w-[92vw] h-[100svh] pt-2 pb-6">
        <div className="relative h-full rounded-[28px] overflow-hidden shadow-2xl">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${BG_SRC})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
          <div className="absolute inset-0 bg-sky-950/35" />

          <div className="relative h-full overflow-y-auto px-3 pt-4 pb-6">
            <h1 className="text-center text-[28px] font-extrabold text-white">
              面接トレーニング
            </h1>
            <p className="text-center text-red-400 font-bold">{modeLabel}</p>

            <div className="mt-4 bg-white/85 rounded-2xl p-4">
              <p className="font-extrabold text-[18px]">
                {currentQ?.text ?? ""}
              </p>

              <textarea
                className="mt-3 w-full min-h-[200px] rounded-xl border p-3"
                value={answer}
                onChange={(e) => {
                  setAnswer(e.target.value);
                  committedRef.current = e.target.value;
                }}
              />

              <div className="mt-2 text-sm">
                {charCount}文字
                {isCoreOrDeepDive && ` / ${minChars}以上`}
              </div>

              <div className="mt-3 flex justify-between items-center">
                <button
                  className="w-14 h-14 rounded-full bg-white"
                  onClick={toggleSpeech}
                >
                  {listening ? "⏹" : "🎤"}
                </button>
              </div>
            </div>

            {/* ボタン列 */}
            <div className="mt-6 flex gap-2">
              <button
                className="flex-1 h-[56px] rounded-full bg-white"
                onClick={goModeSelect}
              >
                モード選択
              </button>
              <button
                className="flex-1 h-[56px] rounded-full bg-amber-200"
                onClick={clearAnswer}
              >
                再入力
              </button>
              <button
                className="flex-1 h-[56px] rounded-full bg-sky-300"
                onClick={onNext}
                disabled={!isValid}
              >
                次へ
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
