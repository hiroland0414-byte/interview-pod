// src/lib/feedback/impressionAnalysis.ts

export type ImpressionAxisKey =
  | "expression" // 表情・ジェスチャー（テキストからの代理指標）
  | "voice"      // 声の明るさ・抑揚（ポジ語などからの代理指標）
  | "structure"  // 話の構成・まとまり
  | "openness"   // 自己開示・人柄の見え方
  | "stability"; // 落ち着き・聞きやすさ（フィラー語の少なさ等）

export type ImpressionScores = {
  expression: number;
  voice: number;
  structure: number;
  openness: number;
  stability: number;
};

export type ImpressionRecord = {
  id: string;
  timestamp: number;
  name: string;
  transcript: string;
  scores: ImpressionScores;
};

const STORAGE_KEY = "kcareer.impression.history.v1";

function normalizeJa(text: string): string {
  return (text || "")
    .replace(/\s+/g, " ")
    .replace(/　+/g, " ")
    .trim();
}

function tokenizeJa(text: string): string[] {
  const t = normalizeJa(text);
  if (!t) return [];
  return t.split(/[ 、。・，．!！?？\n\r\t]+/).filter(Boolean);
}

function clampScore(v: number): number {
  const n = Math.round(v);
  if (n < 1) return 1;
  if (n > 5) return 5;
  return n;
}

// テキストから印象スコアをざっくり算出（将来は音声・表情も加点予定）
export function analyzeImpressionText(raw: string): ImpressionScores {
  const text = normalizeJa(raw);
  const tokens = tokenizeJa(text);
  const len = text.length;

  // ポジティブっぽい語
  const positiveWords = [
    "楽しい",
    "好き",
    "やりがい",
    "嬉しい",
    "ワクワク",
    "興味",
    "魅力",
    "前向き",
    "挑戦",
  ];

  const fillerWords = ["えー", "えっと", "その", "なんか", "あの"];

  const structureMarkers = [
    "まず",
    "次に",
    "最後に",
    "一つ目",
    "二つ目",
    "三つ目",
    "一つめ",
    "二つめ",
    "三つめ",
  ];

  const selfOpenWords = [
    "趣味",
    "サークル",
    "部活",
    "アルバイト",
    "バイト",
    "性格",
    "家族",
    "友人",
    "休日",
    "最近",
  ];

  // カウント用
  const countContains = (dict: string[]): number => {
    let count = 0;
    for (const w of tokens) {
      for (const d of dict) {
        if (w.includes(d)) {
          count++;
          break;
        }
      }
    }
    return count;
  };

  const posCount = countContains(positiveWords);
  const fillerCount = countContains(fillerWords);
  const structCount = countContains(structureMarkers);
  const openCount = countContains(selfOpenWords);

  // 各軸のスコア（1〜5）をざっくり決める

  // 1) expression: 長さ＋ポジ語で上がる
  let expression = 2;
  if (len >= 80) expression += 1;
  if (len >= 160) expression += 1;
  if (posCount >= 2) expression += 1;
  expression = clampScore(expression);

  // 2) voice: ポジ語・あいさつっぽさ
  const hasGreet = /よろしく|本日は|今日は|おねがい|お願いします|ありがとうございました/.test(
    text
  );
  let voice = 2;
  if (posCount >= 1) voice += 1;
  if (posCount >= 3) voice += 1;
  if (hasGreet) voice += 1;
  voice = clampScore(voice);

  // 3) structure: 構成語＋長さ
  let structure = 2;
  if (structCount >= 1) structure += 2; // 構成語があれば一気に上がる
  if (len >= 120) structure += 1;
  structure = clampScore(structure);

  // 4) openness: 自己開示語＋長さ
  let openness = 2;
  if (openCount >= 1) openness += 1;
  if (openCount >= 3) openness += 1;
  if (len >= 120) openness += 1;
  openness = clampScore(openness);

  // 5) stability: フィラーの少なさ＋長さ
  let stability = 3;
  if (fillerCount >= 3) stability -= 1;
  if (fillerCount >= 6) stability -= 1;
  if (len >= 120 && fillerCount <= 3) stability += 1;
  stability = clampScore(stability);

  return {
    expression,
    voice,
    structure,
    openness,
    stability,
  };
}

// ---- ローカルストレージで履歴管理（最新＋前回比較用） ----

export function loadImpressionHistory(): ImpressionRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ImpressionRecord[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function saveImpressionHistory(list: ImpressionRecord[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function addImpressionRecord(
  name: string,
  transcript: string,
  scores: ImpressionScores
): { current: ImpressionRecord; previous?: ImpressionRecord } {
  const now = Date.now();
  const rec: ImpressionRecord = {
    id: `imp_${now}`,
    timestamp: now,
    name,
    transcript,
    scores,
  };

  let history = loadImpressionHistory();
  const previous =
    history.length > 0 ? history[history.length - 1] : undefined;

  history = [...history, rec];
  // 履歴は直近20件だけ保持
  if (history.length > 20) {
    history = history.slice(history.length - 20);
  }
  saveImpressionHistory(history);

  return { current: rec, previous };
}
