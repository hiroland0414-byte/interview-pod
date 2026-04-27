"use client";

import Image from "next/image";
import ModeTabs from "./ModeTabs";

export default function Header({ facility }: { facility: string }) {
  return (
    <header className="w-full max-w-[360px] mx-auto text-center mb-3">
      <div className="mb-2 flex justify-center">
        {/* /public/logo.png */}
        <Image src="/logo.png" alt="logo" width={220} height={44} priority />
      </div>
      {facility && (
        <p className="text-[18px] font-bold text-red-600 leading-tight">{facility}</p>
      )}
      <h2 className="text-[22px] font-extrabold text-slate-900 mt-1">面接トレーニング</h2>
      <div className="mt-2">
        <ModeTabs />
      </div>
    </header>
  );
}
