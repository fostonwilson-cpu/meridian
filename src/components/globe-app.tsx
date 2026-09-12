import { lazy, Suspense, useLayoutEffect, useState } from "react";
import { GlobeOverlay } from "@/components/globe-overlay";
import { useGlobeStore } from "@/lib/globe-store";

const GlobeScene = lazy(async () => {
  const mod = await import("@/components/globe-scene");
  return { default: mod.GlobeScene };
});

export function GlobeApp() {
  const [mounted, setMounted] = useState(false);

  useLayoutEffect(() => {
    setMounted(true);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    useGlobeStore.getState().setReducedMotion(reduced);
  }, []);

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-bg text-fg">
      {mounted ? (
        <Suspense fallback={<div className="absolute inset-0 bg-bg" aria-hidden />}>
          <GlobeScene />
        </Suspense>
      ) : (
        <div className="absolute inset-0 bg-bg" aria-hidden />
      )}
      <GlobeOverlay />
    </main>
  );
}
