import { create } from "zustand";
import { LOCATIONS } from "./locations";

type GlobeStore = {
  selectedId: string | null;
  hoveredId: string | null;
  interacting: boolean;
  autoRotate: boolean;
  listOpen: boolean;
  reducedMotion: boolean;
  select: (id: string) => void;
  clear: () => void;
  setHovered: (id: string | null) => void;
  setInteracting: (value: boolean) => void;
  setAutoRotate: (value: boolean) => void;
  toggleAutoRotate: () => void;
  setListOpen: (value: boolean) => void;
  setReducedMotion: (value: boolean) => void;
  cycle: (direction: 1 | -1) => void;
};

export const useGlobeStore = create<GlobeStore>((set, get) => ({
  selectedId: null,
  hoveredId: null,
  interacting: false,
  autoRotate: true,
  listOpen: false,
  reducedMotion: false,
  select: (id) => set({ selectedId: id, autoRotate: false }),
  clear: () => set({ selectedId: null }),
  setHovered: (id) => set({ hoveredId: id }),
  setInteracting: (value) => set({ interacting: value }),
  setAutoRotate: (value) => set({ autoRotate: value }),
  toggleAutoRotate: () =>
    set((state) => {
      const next = !state.autoRotate;
      return { autoRotate: next, selectedId: next ? null : state.selectedId };
    }),
  setListOpen: (value) => set({ listOpen: value }),
  setReducedMotion: (value) => set({ reducedMotion: value, autoRotate: value ? false : get().autoRotate }),
  cycle: (direction) => {
    const { selectedId } = get();
    const index = LOCATIONS.findIndex((item) => item.id === selectedId);
    const next =
      index < 0
        ? direction === 1
          ? 0
          : LOCATIONS.length - 1
        : (index + direction + LOCATIONS.length) % LOCATIONS.length;
    const id = LOCATIONS[next]?.id;
    if (id) set({ selectedId: id, autoRotate: false });
  },
}));
