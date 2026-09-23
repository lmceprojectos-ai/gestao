"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((e) => {
        console.error("Falha ao registar service worker:", e);
      });
    }
  }, []);
  return null;
}
