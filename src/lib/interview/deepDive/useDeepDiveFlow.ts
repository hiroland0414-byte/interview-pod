// src/lib/interview/deepDive/useDeepDiveFlow.ts
"use client";

import { useCallback, useState } from "react";
import type { QuestionType, Tone } from "./rules";
import { generateDeepDiveQuestions } from "./generateDeepDiveQuestions";
import { evaluateThreeQuestions } from "../evaluate/evaluateThreeQuestions";

export function useDeepDiveFlow() {
  const [evalTone, setEvalTone] = useState<Tone>("strict");

  const [lastScore, setLastScore] = useState<number | null>(null);
  const [lastEvalText, setLastEvalText] = useState<string>("");

  const [deepDiveQs, setDeepDiveQs] = useState<string[]>([]);

  const run = useCallback(
    async (input: { type: QuestionType; answer: string }) => {
      const evalRes = evaluateThreeQuestions({
        type: input.type,
        answer: input.answer,
        tone: evalTone,
      });

      setLastScore(evalRes.score);
      setLastEvalText(evalRes.feedback);

      const qs = await generateDeepDiveQuestions({
        type: input.type,
        tone: evalTone,
        answer: input.answer,
        missingSignals: evalRes.missingSignals,
        maxQuestions: 3,
      });

      setDeepDiveQs(qs);
    },
    [evalTone]
  );

  const reset = useCallback(() => {
    setLastScore(null);
    setLastEvalText("");
    setDeepDiveQs([]);
  }, []);

  return {
    evalTone,
    setEvalTone,
    lastScore,
    lastEvalText,
    deepDiveQs,
    run,
    reset,
  };
}
