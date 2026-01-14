// src/app/page.tsx
"use client";

export default function Page() {
  if (typeof window !== "undefined") {
    window.location.href = "/start";
  }
  return null;
}
