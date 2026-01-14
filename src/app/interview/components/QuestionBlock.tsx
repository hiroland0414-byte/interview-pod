"use client";

import RecorderBar from "./RecorderBar";
import { useInputMode } from "../InputModeContext";

export default function QuestionBlock({
  question, value, onChange, minChars, onNext, isLast
}: {
  question: string; value: string; onChange: (v:string)=>void;
  minChars?: number; onNext: ()=>void; isLast?: boolean;
}) {
  const { mode } = useInputMode();
  const canProceed = (minChars ?? 0) === 0 || value.trim().length >= (minChars ?? 0);

  return (
    <section className="w-full max-w-[360px] mx-auto">
      <p className="mt-1 mb-2 text-[17px] font-semibold text-slate-900">{question}</p>

      <textarea
        value={value}
        onChange={(e)=>onChange(e.target.value)}
        className="w-full min-h-[160px] px-3 py-3 border rounded-2xl outline-none text-[15px]
                   border-sky-200 focus:border-sky-400"
        placeholder=""
      />
      // src/app/interview/components/QuestionBlock.tsx（差分）
      <div className="mt-1 flex items-center justify-between">
        <span className={`text-xs ${canProceed? "text-slate-500":"text-rose-600"}`}>
           {value.trim().length}文字
        </span>
           {minChars ? <span className="text-xs text-slate-500">（{minChars}文字以上が必要）</span> : <span/>}
           {mode === "voice" && <RecorderBar onTranscript={onChange} />}
      </div>

      <div className="mt-5">
        <button
          disabled={!canProceed}
          className={`w-full rounded-full px-5 py-3 text-[16px] font-semibold border
            ${isLast? "bg-emerald-100 text-emerald-800 border-emerald-300"
                    : "bg-sky-100 text-sky-800 border-sky-300"}
            ${!canProceed ? "opacity-50 cursor-not-allowed" : ""}`}
          onClick={onNext}
        >
          {isLast? "フィードバックへ" : "次の質問へ"}
        </button>
      </div>
    </section>
  );
}
