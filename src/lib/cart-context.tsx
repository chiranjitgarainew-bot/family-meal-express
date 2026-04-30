import { createContext, useContext, useState, type ReactNode } from "react";
import type { MealType } from "./cutoff";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  meal_type: MealType;
  qty: number;
}

interface CartCtx {
  items: CartItem[];
  add: (item: Omit<CartItem, "qty">) => void;
  remove: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  clear: () => void;
  replaceAll: (next: CartItem[]) => void;
  total: number;
  count: number;
  mealType: MealType | null;
}

const Ctx = createContext<CartCtx | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const add: CartCtx["add"] = (item) => {
    setItems((cur) => {
      // enforce single meal_type per cart
      if (cur.length && cur[0].meal_type !== item.meal_type) return cur;
      const ex = cur.find((i) => i.id === item.id);
      if (ex) return cur.map((i) => (i.id === item.id ? { ...i, qty: i.qty + 1 } : i));
      return [...cur, { ...item, qty: 1 }];
    });
  };
  const remove = (id: string) => setItems((c) => c.filter((i) => i.id !== id));
  const setQty = (id: string, qty: number) =>
    setItems((c) => (qty <= 0 ? c.filter((i) => i.id !== id) : c.map((i) => (i.id === id ? { ...i, qty } : i))));
  const clear = () => setItems([]);

  const total = items.reduce((s, i) => s + i.price * i.qty, 0);
  const count = items.reduce((s, i) => s + i.qty, 0);
  const mealType = items[0]?.meal_type ?? null;

  return <Ctx.Provider value={{ items, add, remove, setQty, clear, total, count, mealType }}>{children}</Ctx.Provider>;
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart inside CartProvider");
  return c;
}
