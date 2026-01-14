// src/app/interview/finish/ResultPdf.tsx
"use client";

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";

import type { ModeTag } from "@/lib/questions";
import type { FeedbackItem } from "@/lib/feedback/feedbackSession";

// 日本語フォント登録（public/ 配下を参照）
Font.register({
  family: "NotoSansJP",
  fonts: [
    { src: "/fonts/NotoSansJP-Regular.ttf", fontWeight: "normal" },
    { src: "/fonts/NotoSansJP-Bold.ttf", fontWeight: "bold" },
  ],
});

type QA = { questionText: string; answerText: string };

const MODE_LABEL: Record<ModeTag, string> = {
  A1: "病院（診療放射線技師）",
  A2: "病院／看護師",
  B: "健診／クリニック",
  C: "企業（医療関連）",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 34,
    paddingHorizontal: 28,
    fontFamily: "NotoSansJP",
    fontSize: 10.5,
    lineHeight: 1.45,
    color: "#0f172a",
  },
  header: { marginBottom: 14 },
  title: { fontSize: 16, fontWeight: "bold" },
  subtitle: { fontSize: 10, marginTop: 2, color: "#334155" },
  meta: { fontSize: 10, marginTop: 2, color: "#334155" },

  section: { marginTop: 12 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
  },

  card: {
    padding: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 6,
    marginBottom: 8,
  },
  q: { fontSize: 10.5, fontWeight: "bold", color: "#0f172a" },
  a: { marginTop: 4, fontSize: 10.5, color: "#334155" },

  fbTitle: { fontSize: 11, fontWeight: "bold", color: "#0f172a" },
  fbText: { marginTop: 4, fontSize: 10.5, color: "#0f172a" },

  note: { marginTop: 10, fontSize: 9, color: "#64748b" },
});

function formatDateJP(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function ResultPdfDoc(props: {
  mode: ModeTag;
  trainedAt: string;
  answers: QA[];
  orderedFeedback: FeedbackItem[];
  // TITLE_MAP相当は finish 側で文字列にして渡してもOKだが、今回は item.type をそのまま表示しない前提で titleを持たせる
  feedbackTitleOf: (t: FeedbackItem["type"]) => string;
}) {
  const { mode, trainedAt, answers, orderedFeedback, feedbackTitleOf } = props;

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>面接トレーニング結果</Text>
          <Text style={styles.subtitle}>Dialogue Trainer for Med. Interview</Text>
          <Text style={styles.meta}>モード：{MODE_LABEL[mode]}</Text>
          <Text style={styles.meta}>実施日時：{formatDateJP(trainedAt)}</Text>
        </View>

        {/* Answers */}
        <View style={styles.section} wrap>
          <Text style={styles.sectionTitle}>回答内容</Text>

          {answers.length === 0 ? (
            <Text>（回答データが見つかりません）</Text>
          ) : (
            answers.map((a, idx) => (
              <View key={idx} style={styles.card} wrap>
                <Text style={styles.q}>
                  Q{idx + 1}. {a.questionText}
                </Text>
                <Text style={styles.a}>{a.answerText || "（未入力）"}</Text>
              </View>
            ))
          )}
        </View>

        {/* Feedback */}
        <View style={styles.section} wrap>
          <Text style={styles.sectionTitle}>フィードバック（専門家の視点）</Text>

          {orderedFeedback.length === 0 ? (
            <Text>（フィードバックがありません）</Text>
          ) : (
            orderedFeedback.map((item) => (
              <View key={String(item.type)} style={styles.card} wrap>
                <Text style={styles.fbTitle}>【{feedbackTitleOf(item.type)}】</Text>
                <Text style={styles.fbText}>{item.text}</Text>
              </View>
            ))
          )}
        </View>

        <Text style={styles.note}>
          ※本PDFは入力内容を要約せず、そのまま保存しています。
        </Text>
      </Page>
    </Document>
  );
}
