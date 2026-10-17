import { create } from "zustand";

/**
 * Transient UI state shared across islands (not persisted). The cart drawer
 * lives in the Navbar but product cards open it ("Ver carrito").
 */
interface UiState {
  cartDrawerOpen: boolean;
  setCartDrawerOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>()((set) => ({
  cartDrawerOpen: false,
  setCartDrawerOpen: (open) => set({ cartDrawerOpen: open }),
}));

export const useCartDrawerOpen = () => useUiStore((state) => state.cartDrawerOpen);

export const openCartDrawer = () => useUiStore.getState().setCartDrawerOpen(true);
