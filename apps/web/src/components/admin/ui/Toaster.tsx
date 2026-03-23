"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      theme="dark"
      position="bottom-right"
      richColors
      toastOptions={{
        style: {
          background: "var(--color-navy-900, #0a1628)",
          border: "1px solid var(--color-navy-800, #172033)",
          color: "white",
        },
      }}
    />
  );
}
