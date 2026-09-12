import { Compass, MapPin, Pause, Play, X } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useGlobeStore } from "@/lib/globe-store";
import { formatCoord, getLocation, LOCATIONS } from "@/lib/locations";
import { cn } from "@/lib/utils";

export function GlobeOverlay() {
  const selectedId = useGlobeStore((s) => s.selectedId);
  const hoveredId = useGlobeStore((s) => s.hoveredId);
  const autoRotate = useGlobeStore((s) => s.autoRotate);
  const listOpen = useGlobeStore((s) => s.listOpen);
  const select = useGlobeStore((s) => s.select);
  const clear = useGlobeStore((s) => s.clear);
  const setHovered = useGlobeStore((s) => s.setHovered);
  const toggleAutoRotate = useGlobeStore((s) => s.toggleAutoRotate);
  const setListOpen = useGlobeStore((s) => s.setListOpen);
  const cycle = useGlobeStore((s) => s.cycle);
  const selected = getLocation(selectedId);
  const activeId = hoveredId ?? selectedId;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (event.key === "Escape") {
        clear();
        setListOpen(false);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        cycle(1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        cycle(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clear, cycle, setListOpen]);

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div className="scene-scrim absolute inset-0" aria-hidden />
      <header className="pointer-events-auto absolute top-0 left-0 p-5 pt-[max(1.25rem,env(safe-area-inset-top))] sm:p-7">
        <p className="rise-in font-sans text-xs tracking-widest text-muted uppercase">Living atlas</p>
        <h1 className="rise-in rise-in-delay-1 font-display mt-1 text-4xl leading-tight tracking-tight text-fg italic sm:text-5xl">
          Meridian
        </h1>
        <p className="rise-in rise-in-delay-2 mt-2 max-w-xs text-sm text-muted">
          Drag to spin. Touch a light, or a name, to rest there.
        </p>
      </header>

      <div className="pointer-events-auto absolute top-0 right-0 p-5 pt-[max(1.25rem,env(safe-area-inset-top))] sm:p-7">
        <Button
          variant="quiet"
          size="compact"
          onClick={toggleAutoRotate}
          aria-pressed={autoRotate}
          aria-label={autoRotate ? "Pause auto-rotate" : "Resume auto-rotate"}
          className="gap-2 text-muted"
        >
          {autoRotate ? <Pause className="size-4" strokeWidth={1.75} /> : <Play className="size-4" strokeWidth={1.75} />}
          <span className="hidden sm:inline">{autoRotate ? "Orbiting" : "Paused"}</span>
        </Button>
      </div>

      <aside
        className={cn(
          "pointer-events-auto absolute right-5 bottom-5 hidden w-[22rem] flex-col gap-3 md:flex",
          "sm:right-7 sm:bottom-7",
        )}
      >
        <LocationDetail selected={selected} onClear={clear} />
        <nav
          aria-label="Featured places"
          className="flex max-h-[min(52vh,28rem)] flex-col overflow-hidden rounded-xl bg-surface/82 p-3 shadow-[var(--shadow-panel)]"
        >
          <div className="mb-2 flex items-center justify-between px-2 pt-1">
            <p className="text-xs tracking-widest text-muted uppercase">Featured</p>
            <p className="font-sans text-xs text-faint tabular-nums">{LOCATIONS.length}</p>
          </div>
          <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto pr-1">
            {LOCATIONS.map((place) => {
              const current = place.id === activeId;
              const on = place.id === selectedId;
              return (
                <li key={place.id}>
                  <button
                    type="button"
                    onClick={() => select(place.id)}
                    onPointerEnter={() => setHovered(place.id)}
                    onPointerLeave={() => setHovered(null)}
                    aria-current={on ? "true" : undefined}
                    className={cn(
                      "flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-left transition-[background-color,color,box-shadow] duration-(--motion-quick) ease-(--ease-out)",
                      current ? "bg-surface-2 text-fg" : "text-muted hover:bg-surface-2/80 hover:text-fg",
                    )}
                  >
                    <span
                      className={cn(
                        "size-1.5 shrink-0 rounded-full",
                        on ? "bg-accent" : "bg-faint",
                      )}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-fg">{place.name}</span>
                      <span className="block truncate text-xs text-faint">{place.region}</span>
                    </span>
                    <span className="shrink-0 text-xs text-faint tabular-nums">
                      {formatCoord(place.lat, place.lng).split("  ")[0]}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      <div
        className={cn(
          "pointer-events-auto absolute inset-x-0 bottom-0 md:hidden",
          "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        )}
      >
        <div
          className={cn(
            "mx-3 overflow-hidden rounded-t-xl bg-surface/90 shadow-[var(--shadow-panel)]",
            "transition-[max-height] duration-(--motion-slow) ease-(--ease-smooth-out)",
            listOpen ? "max-h-[72vh]" : "max-h-44",
          )}
        >
          <button
            type="button"
            className="flex w-full items-center justify-center pt-2 pb-1"
            onClick={() => setListOpen(!listOpen)}
            aria-expanded={listOpen}
            aria-label={listOpen ? "Collapse places" : "Expand places"}
          >
            <span className="h-1 w-10 rounded-full bg-fg/20" />
          </button>
          <div className="flex items-start justify-between gap-3 px-4 pb-3">
            <div className="min-w-0">
              <p className="text-xs tracking-widest text-muted uppercase">
                {selected ? selected.region : "Featured places"}
              </p>
              <p className="font-display truncate text-2xl leading-tight text-fg italic">
                {selected ? selected.name : "Twelve rooms of the Earth"}
              </p>
            </div>
            <Button
              variant="quiet"
              size="icon"
              onClick={() => setListOpen(!listOpen)}
              aria-label="Toggle places list"
            >
              <Compass className="size-4" strokeWidth={1.75} />
            </Button>
          </div>
          {listOpen ? (
            <ul className="max-h-[48vh] space-y-0.5 overflow-y-auto px-3 pb-3">
              {LOCATIONS.map((place) => {
                const on = place.id === selectedId;
                return (
                  <li key={place.id}>
                    <button
                      type="button"
                      onClick={() => {
                        select(place.id);
                        setListOpen(false);
                      }}
                      className={cn(
                        "flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-left",
                        on ? "bg-surface-2 text-fg" : "text-muted",
                      )}
                    >
                      <MapPin className="size-3.5 shrink-0" strokeWidth={1.75} />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">
                        {place.name}
                      </span>
                      <span className="text-xs text-faint">{place.region}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : selected ? (
            <p className="px-4 pb-4 text-sm text-muted">{selected.blurb}</p>
          ) : (
            <p className="px-4 pb-4 text-sm text-muted">Swipe the globe, or open the list of lights.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function LocationDetail({
  selected,
  onClear,
}: {
  selected: ReturnType<typeof getLocation>;
  onClear: () => void;
}) {
  if (!selected) {
    return (
      <div className="rounded-xl bg-surface/70 px-5 py-4 shadow-[var(--shadow-panel)]">
        <p className="text-xs tracking-widest text-muted uppercase">Now</p>
        <p className="font-display mt-1 text-2xl leading-tight text-fg italic">In orbit</p>
        <p className="mt-2 text-sm text-muted">
          Twelve rooms of the Earth. Drag the globe, or pick a light.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-surface/82 px-5 py-4 shadow-[var(--shadow-panel)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs tracking-widest text-muted uppercase">{selected.region}</p>
          <h2 className="font-display mt-1 text-3xl leading-tight tracking-tight text-fg italic">
            {selected.name}
          </h2>
        </div>
        <Button variant="ghost" size="icon" onClick={onClear} aria-label="Clear selection" className="shrink-0">
          <X className="size-4" strokeWidth={1.75} />
        </Button>
      </div>
      <p className="mt-2 text-xs text-faint tabular-nums">{formatCoord(selected.lat, selected.lng)}</p>
      <p className="mt-3 text-sm text-muted">{selected.blurb}</p>
    </div>
  );
}
