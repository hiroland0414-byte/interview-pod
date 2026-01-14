// src/components/InterviewRadar.tsx
"use client";

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";

type RadarScores = Record<string, number>;

type Props = {
  current: RadarScores;
  previous?: RadarScores | null;
  // 軸順を固定したい場合に渡す（なければ current のキー順）
  axes?: string[];
};

export default function InterviewRadar({ current, previous, axes }: Props) {
  const axisList = axes?.length ? axes : Object.keys(current);

  const data = axisList.map((k) => ({
    axis: k,
    current: clamp(current[k]),
    previous: previous ? clamp(previous[k]) : undefined,
  }));

  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="70%">
          <PolarGrid />
          <PolarAngleAxis
            dataKey="axis"
            tick={{ fontSize: 10 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fontSize: 9 }}
            tickCount={5}
          />

          {/* 前回（太め） */}
          {previous && (
            <Radar
              name="前回"
              dataKey="previous"
              stroke="#64748b"
              fill="#94a3b8"
              fillOpacity={0.08}
              strokeWidth={4}
              isAnimationActive={false}
            />
          )}

          {/* 今回（濃いオレンジ線 + 薄いオレンジ塗り） */}
          <Radar
            name="今回"
            dataKey="current"
            stroke="#ea580c"
            fill="#fdba74"
            fillOpacity={0.35}
            strokeWidth={2}
            isAnimationActive={false}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

function clamp(v: unknown) {
  const n = typeof v === "number" ? v : Number(v);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}
