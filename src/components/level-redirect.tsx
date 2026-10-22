"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_LEVEL, isLevel, LAST_LEVEL_STORAGE_KEY } from "@/lib/levels";

/** Opens the level the user studied last (stored in this browser), N2 otherwise. */
export function LevelRedirect() {
  const router = useRouter();

  useEffect(() => {
    const last = localStorage.getItem(LAST_LEVEL_STORAGE_KEY) ?? "";
    router.replace(`/${isLevel(last) ? last : DEFAULT_LEVEL}`);
  }, [router]);

  return (
    <main className="grid min-h-screen place-items-center bg-[#f6f7f4] text-sm text-zinc-500">
      불러오는 중…
    </main>
  );
}
