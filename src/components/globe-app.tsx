import { useLayoutEffect, useState } from "react";
import { GlobeOverlay } from "@/components/globe-overlay";
import { GlobeScene } from "@/components/globe-scene";
import { useGlobeStore } from "@/lib/globe-store";

export function GlobeApp() {
  const [mounted, setMounted] = useState(false);

  useLayoutEffect(() => {
    setMounted(true);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    useGlobeStore.getState().setReducedMotion(reduced);
  }, []);

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-bg text-fg">
      {mounted ? <GlobeScene /> : <div className="absolute inset-0 bg-bg" aria-hidden />}
      <GlobeOverlay />
    </main>
  );
}
