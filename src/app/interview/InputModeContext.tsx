"use client";

import { createContext, useContext, useMemo, useState } from "react";
export type InputMode = "text" | "voice";

type Ctx = {
  mode: InputMode;
  setMode: (m: InputMode) => void;
};

const C = createContext<Ctx | null>(null);

export function InputModeProvider({ children }: { children: React.ReactNode }) {
  const initial =
    (typeof window !== "undefined"
      ? (sessionStorage.getItem("kcareer.session.inputMode") as InputMode | null)
      : null) ?? "text";

  const [mode, setModeState] = useState<InputMode>(initial);

  const setMode = (m: InputMode) => {
    setModeState(m);
    if (typeof window !== "undefined") {
      // 既定は初期選択だが、ユーザーが切替たらその時点の選択も保存
      sessionStorage.setItem("kcareer.session.inputMode", m);
    }
  };

  const value = useMemo(() => ({ mode, setMode }), [mode]);
  return <C.Provider value={value}>{children}</C.Provider>;
}

export const useInputMode = () => {
  const v = useContext(C);
  if (!v) throw new Error("InputModeProvider missing");
  return v;
};
