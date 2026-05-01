// Cut-off time utilities.
// Lunch must be ordered before 10:00 same-day. Dinner before 17:00 same-day.
// Future-date orders allowed any time.

export type MealType = "lunch" | "dinner";

export const DEFAULT_CUTOFFS: Record<MealType, string> = {
  lunch: "10:00",
  dinner: "17:00",
};

export function todayISO(): string {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

export function isPastCutoff(
  deliveryDate: string,
  meal: MealType,
  cutoffs: Record<MealType, string> = DEFAULT_CUTOFFS,
): boolean {
  const today = todayISO();
  if (deliveryDate > today) return false; // future date — always allowed
  if (deliveryDate < today) return true; // past date — never allowed
  const [h, m] = cutoffs[meal].split(":").map(Number);
  const now = new Date();
  const cutoff = new Date();
  cutoff.setHours(h, m, 0, 0);
  return now >= cutoff;
}

/** True if user can still edit/cancel an order (before its cut-off). */
export function canEditOrder(deliveryDate: string, meal: MealType, status: string, cutoffs = DEFAULT_CUTOFFS) {
  if (!["pending", "confirmed"].includes(status)) return false;
  return !isPastCutoff(deliveryDate, meal, cutoffs);
}

export function formatCutoffMessage(meal: MealType, cutoffs = DEFAULT_CUTOFFS): string {
  const t = cutoffs[meal];
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = ((h + 11) % 12) + 1;
  return `Order ${meal} before ${h12}:${String(m).padStart(2, "0")} ${period}`;
}

export function inr(n: number): string {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export function formatDate(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "short", day: "numeric", month: "short",
  });
}

export function nextNDates(n: number): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const tz = d.getTimezoneOffset() * 60000;
    out.push(new Date(d.getTime() - tz).toISOString().slice(0, 10));
  }
  return out;
}
