export type InputMode = "text" | "voice";

export type SessionMeta = {
  inputMode: InputMode;
  switches: { at: number; from: InputMode; to: InputMode }[]; // 非常時切替履歴（最大1回）
};
