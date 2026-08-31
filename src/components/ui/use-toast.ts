import { create } from "zustand";

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant?: "default" | "success" | "destructive";
}

interface ToastState {
  toasts: ToastItem[];
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function toast(item: Omit<ToastItem, "id">) {
  const id = crypto.randomUUID();
  useToastStore.setState((s) => ({ toasts: [...s.toasts, { ...item, id }] }));
  return id;
}
