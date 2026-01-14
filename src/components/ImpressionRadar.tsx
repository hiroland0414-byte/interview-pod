// src/components/ImpressionRadar.tsx
"use client";

import React, { useMemo } from "react";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import type { ImpressionScores } from "@/lib/impression/evaluateImpression";

type Props = {
  current: ImpressionScores;
  previous?: ImpressionScores | null;
};

export function ImpressionRadar({ current, previous }: Props) {
  const data = useMemo(() => {
    const rows = [
      { axis: "姿勢", key: "posture" as const },
      { axis: "表情", key: "facialExpression" as const },
      { axis: "声", key: "voiceTone" as const },
      { axis: "テンポ", key: "pace" as const },
      { axis: "視線", key: "eyeContact" as const },
    ];

    return rows.map((r) => ({
      axis: r.axis,
      current: current[r.key],
      previous: previous ? previous[r.key] : undefined,
    }));
  }, [current, previous]);

  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="75%">
          <PolarGrid />
          <PolarAngleAxis dataKey="axis" tick={{ fontSize: 12 }} />
          <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} />

          {/* 前回：紺（下に描く＝奥） */}
          {previous && (
            <Radar
              name="前回"
              dataKey="previous"
              stroke="#0b2a5b"        // 紺ライン
              fill="#0b2a5b"          // 薄紺塗り（opacityで薄くする）
              fillOpacity={0.15}
              strokeWidth={2}
              isAnimationActive={false}
            />
          )}

          {/* 今回：オレンジ（後に描く＝最前面） */}
          <Radar
            name="今回"
            dataKey="current"
            stroke="#ff8a00"          // オレンジライン
            fill="#ff8a00"            // 薄オレンジ塗り（opacityで薄くする）
            fillOpacity={0.20}
            strokeWidth={3}
            isAnimationActive={false}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
