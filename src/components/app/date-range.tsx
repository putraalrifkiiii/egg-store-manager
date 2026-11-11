import { Input } from "@/components/ui/input";
import { jakartaDate, shiftDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export function presets() {
  const today = jakartaDate();
  return [
    { label: "Hari ini", from: today, to: today },
    { label: "7 hari", from: shiftDate(today, -6), to: today },
    { label: "30 hari", from: shiftDate(today, -29), to: today },
    { label: "Bulan ini", from: today.slice(0, 8) + "01", to: today },
  ];
}

export function DateRange({ from, to, onChange }: { from: string; to: string; onChange: (r: { from: string; to: string }) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {presets().map((p) => (
        <button
          key={p.label}
          onClick={() => onChange({ from: p.from, to: p.to })}
          className={cn(
            "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
            p.from === from && p.to === to ? "border-transparent bg-foreground text-background" : "bg-card hover:bg-accent",
          )}
        >
          {p.label}
        </button>
      ))}
      <div className="flex items-center gap-1.5">
        <Input type="date" value={from} max={to} onChange={(e) => e.target.value && onChange({ from: e.target.value, to })} className="h-9 w-auto bg-card" aria-label="Dari tanggal" />
        <span className="text-muted-foreground">–</span>
        <Input type="date" value={to} min={from} onChange={(e) => e.target.value && onChange({ from, to: e.target.value })} className="h-9 w-auto bg-card" aria-label="Sampai tanggal" />
      </div>
    </div>
  );
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export function parseDate(v: unknown): string | undefined {
  return typeof v === "string" && DATE_RE.test(v) ? v : undefined;
}
