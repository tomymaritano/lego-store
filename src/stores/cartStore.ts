import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Product } from "@/types";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  stock: number;
}

interface CartState {
  cart: CartItem[];
  addItem: (item: Product, quantity: number) => void;
  removeItem: (id: string) => void;
  increaseQuantity: (id: string) => void;
  decreaseQuantity: (id: string) => void;
  clearCart: () => void;
  isInCart: (id: string) => boolean;
  getTotalQuantity: () => number;
  getTotalPrice: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      cart: [],

      addItem: (item: Product, quantity: number) => {
        set((state) => {
          const existing = state.cart.find((i) => i.id === item.id);

          if (existing) {
            return {
              cart: state.cart.map((prod) =>
                prod.id === item.id
                  ? { ...prod, quantity: Math.min(prod.quantity + quantity, prod.stock) }
                  : prod
              ),
            };
          }

          const newItem: CartItem = {
            id: item.id,
            name: item.name,
            price: item.price,
            image: item.img,
            quantity: Math.min(quantity, item.stock),
            stock: item.stock,
          };

          return { cart: [...state.cart, newItem] };
        });
      },

      removeItem: (id: string) => {
        set((state) => ({
          cart: state.cart.filter((item) => item.id !== id),
        }));
      },

      increaseQuantity: (id: string) => {
        set((state) => ({
          cart: state.cart.map((item) =>
            item.id === id && item.quantity < item.stock
              ? { ...item, quantity: item.quantity + 1 }
              : item
          ),
        }));
      },

      decreaseQuantity: (id: string) => {
        set((state) => ({
          cart: state.cart.map((item) =>
            item.id === id && item.quantity > 1
              ? { ...item, quantity: item.quantity - 1 }
              : item
          ),
        }));
      },

      clearCart: () => set({ cart: [] }),

      isInCart: (id: string) => get().cart.some((item) => item.id === id),

      getTotalQuantity: () => get().cart.reduce((acc, item) => acc + item.quantity, 0),

      getTotalPrice: () => get().cart.reduce((acc, item) => acc + item.quantity * item.price, 0),
    }),
    {
      name: "lego-cart-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ cart: state.cart }),
    }
  )
);
