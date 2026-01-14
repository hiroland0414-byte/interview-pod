// src/app/interview/finish/pdf.tsx
import React from "react";
import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";

import type { ModeTag } from "@/lib/questions";
import type { FeedbackItem, FeedbackType } from "@/lib/feedback/feedbackSession";
import { TITLE_MAP } from "@/lib/feedback/feedbackSession";

type QA = { questionText: string; answerText: string };

const MODE_LABEL: Record<ModeTag, string> = {
  A1: "病院（診療放射線技師）",
  A2: "病院／看護師",
  B: "健診／クリニック",
  C: "企業（医療関連）",
};

// ✅ 改行正規化（Windows改行対策）
const normalizeNewlines = (s: string) => (s ?? "").replace(/\r\n/g, "\n");

// ✅ 日本語（スペース無し）でも 1文字単位で折り返す
// これが「1行のまま伸びて切れる」を止める最重要の一手
try {
  Font.registerHyphenationCallback((word) => word.split(""));
} catch {
  // noop
}

// 日本語フォント（推奨）
// ※ /public/fonts/ に置くと、ブラウザから /fonts/... で参照できます
try {
  Font.register({
    family: "NotoSansJP",
    fonts: [
      { src: "/fonts/NotoSansJP-Regular.ttf", fontWeight: "normal" },
      { src: "/fonts/NotoSansJP-Bold.ttf", fontWeight: "bold" },
    ],
  });
} catch {
  // フォント登録に失敗してもPDF生成自体は続行
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 28,
    paddingHorizontal: 28,
    backgroundColor: "#0b1f3a",
    fontFamily: "NotoSansJP",
    fontSize: 10.5,
    color: "#0f172a",
    lineHeight: 1.45,
  },

  headerWrap: {
    marginBottom: 14,
    textAlign: "center",
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#ffffff",
  },
  subtitle: {
    marginTop: 4,
    fontSize: 10,
    color: "rgba(255,255,255,0.92)",
  },
  meta: {
    marginTop: 6,
    fontSize: 9.5,
    color: "rgba(255,255,255,0.85)",
  },

  section: {
    marginTop: 10,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 12,
    padding: 10,
  },
  sectionTitle: {
    fontSize: 11.5,
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: 8,
  },

  card: {
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    padding: 8,
    marginBottom: 8,
  },
  qTitle: {
    fontSize: 10.5,
    fontWeight: "bold",
    color: "#0f172a",
  },

  // ✅ 「折り返し + 改行維持 + 欠け防止」
  body: {
    marginTop: 4,
    fontSize: 10.2,
    color: "#334155",
    lineHeight: 1.45,

    // これが効く：横に伸びようとする文章を縮めて折り返しさせる
    flexShrink: 1,
  },

  fbTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#0f172a",
  },
  warnBox: {
    marginTop: 6,
    borderRadius: 8,
    padding: 6,
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fed7aa",
  },
  warnText: { fontSize: 9.5, color: "#7c2d12", fontWeight: "bold" },

  footer: {
    position: "absolute",
    left: 28,
    right: 28,
    bottom: 14,
    textAlign: "center",
    fontSize: 9,
    color: "rgba(255,255,255,0.70)",
  },
});

function formatDateJP(iso: string) {
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}`;
  } catch {
    return iso;
  }
}

export function InterviewResultPdfDoc(props: {
  mode: ModeTag;
  trainedAt: string;
  answers: QA[];
  orderedFeedback: FeedbackItem[];
  qualityByType?: Partial<Record<FeedbackType, { ok: boolean; issues: string[] }>>;
}) {
  const { mode, trainedAt, answers, orderedFeedback, qualityByType } = props;

  return (
    <Document
      title={`面接トレーニング結果_${MODE_LABEL[mode]}_${formatDateJP(trainedAt)}`}
      author="K-career"
    >
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.headerWrap}>
          <Text style={styles.title}>面接トレーニング結果</Text>
          <Text style={styles.subtitle}>Dialogue Trainer for Med. Interview</Text>
          <Text style={styles.meta}>
            モード: {MODE_LABEL[mode]} ／ 回答内容とフィードバックの確認です。
          </Text>
          <Text style={styles.meta}>実施日時：{formatDateJP(trainedAt)}</Text>
        </View>

        {/* 回答内容 */}
        <View style={styles.section} wrap>
          <Text style={styles.sectionTitle}>回答内容</Text>

          {answers.length === 0 ? (
            <View style={styles.card} wrap>
              <Text style={styles.body} wrap>
                （回答データが見つかりません）
              </Text>
            </View>
          ) : (
            answers.map((a, idx) => (
              <View key={idx} style={styles.card} wrap>
                <Text style={styles.qTitle} wrap>
                  Q{idx + 1}. {a.questionText}
                </Text>

                {/* ✅ 改行を活かしつつ、スペース無し日本語でも折り返す */}
                <Text style={styles.body} wrap>
                  {normalizeNewlines(a.answerText ?? "")}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* フィードバック */}
        <View style={styles.section} wrap>
          <Text style={styles.sectionTitle}>フィードバック（専門家の視点）</Text>

          {orderedFeedback.length === 0 ? (
            <View style={styles.card} wrap>
              <Text style={styles.body} wrap>
                （フィードバックがありません）
              </Text>
            </View>
          ) : (
            orderedFeedback.map((item) => {
              const q = qualityByType?.[item.type];
              const showWarn = q ? !q.ok : false;

              return (
                <View key={item.type} style={styles.card} wrap>
                  <Text style={styles.fbTitle} wrap>
                    【{TITLE_MAP[item.type]}】
                  </Text>

                  {showWarn && q && (
                    <View style={styles.warnBox} wrap>
                      <Text style={styles.warnText} wrap>
                        ※フィードバック品質チェック：要改善
                      </Text>
                      <Text style={styles.body} wrap>
                        {q.issues.map((s) => `・${s}`).join("\n")}
                      </Text>
                    </View>
                  )}

                  <Text style={styles.body} wrap>
                    {normalizeNewlines(item.text ?? "")}
                  </Text>
                </View>
              );
            })
          )}
        </View>

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) => `K-career / ${pageNumber} / ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}
