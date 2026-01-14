"use client";

import * as React from "react";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
};

export default function Button({ className = "", ...props }: Props) {
  return (
    <button
      {...props}
      className={[
        "inline-flex items-center justify-center",
        "rounded-full font-extrabold shadow-lg transition-all",
        className,
      ].join(" ")}
    />
  );
}
