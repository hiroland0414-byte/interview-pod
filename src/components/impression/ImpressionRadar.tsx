"use client";

import React from "react";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from "recharts";
import { ImpressionRadarItem } from "@/lib/impression/types";

type Props = { items: ImpressionRadarItem[] };

export function ImpressionRadar({ items }: Props) {
  const data = items.map((i) => ({
    name: i.label,
    score: i.score,
  }));

  return (
    <div style={{ width: "100%", height: 260 }}>
      <ResponsiveContainer>
        <RadarChart data={data}>
          <PolarGrid />
          <PolarAngleAxis dataKey="name" tick={{ fontSize: 12 }} />
          <PolarRadiusAxis domain={[0, 100]} tickCount={6} />
          <Radar dataKey="score" fillOpacity={0.2} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
