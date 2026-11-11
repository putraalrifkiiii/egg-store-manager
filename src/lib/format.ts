const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export function formatRupiah(value: number | string | null | undefined): string {
  return rupiah.format(Number(value ?? 0));
}

export function formatQty(value: number | string | null | undefined): string {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(Number(value ?? 0));
}

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

export function formatDayShort(value: string): string {
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(value + "T00:00:00Z"),
  );
}

/** Calendar date (YYYY-MM-DD) in the shop's timezone (Asia/Jakarta). */
export function jakartaDate(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(d);
}

export function shiftDate(date: string, days: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Start of a Jakarta calendar day as an ISO timestamp, for filtering timestamptz columns. */
export function jakartaDayStartIso(date: string): string {
  return new Date(date + "T00:00:00+07:00").toISOString();
}

export const PAYMENT_LABELS: Record<string, string> = {
  tunai: "Tunai",
  qris: "QRIS",
  transfer: "Transfer",
};

export const UNITS = ["kg", "butir", "tray", "peti", "pack"] as const;
export const CATEGORIES = ["Ayam Ras", "Ayam Kampung", "Bebek", "Puyuh", "Olahan", "Lainnya"] as const;
