export function speakQuestion(text: string) {
  if (typeof window === "undefined") return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ja-JP";
    u.rate = 0.95; // ややゆっくり
    u.pitch = 1.0;
    u.volume = 1.0;
    window.speechSynthesis.cancel(); // 前の読み上げを停止
    window.speechSynthesis.speak(u);
  } catch {}
}

export function stopSpeaking() {
  if (typeof window === "undefined") return;
  try {
    window.speechSynthesis.cancel();
  } catch {}
}
