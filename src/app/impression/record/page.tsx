// src/app/impression/record/page.tsx
import { Suspense } from "react";
import RecordClient from "./RecordClient";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <RecordClient />
    </Suspense>
  );
}
