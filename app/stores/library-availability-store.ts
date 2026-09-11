// @aspect aspect:library-grounded-research
import { create } from "zustand";

/**
 * Whether the current reader has an available library context, known to the
 * client before search submit. The default source is the reader's internal
 * reviewed-papers library. The research shell renders first, then the
 * post-mount library bootstrap endpoint seeds this store, so the result header basis toggle
 * can be made available as soon as results render — not only after a response carries
 * `metadata.libraryContextAvailable`.
 *
 * @aspect aspect:library-grounded-research
 */
interface LibraryAvailabilityState {
  available: boolean;
  setAvailable: (available: boolean) => void;
}

export const useLibraryAvailabilityStore = create<LibraryAvailabilityState>((set) => ({
  available: false,
  setAvailable: (available) => {
    set({ available });
  },
}));
