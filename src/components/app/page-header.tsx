import type { ReactNode } from "react";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-3xl font-extrabold sm:text-4xl">{title}</h1>
        {description && <p className="mt-1 text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: "default" | "yolk";
}) {
  const yolk = tone === "yolk";
  return (
    <div
      className={
        yolk
          ? "rounded-2xl bg-yolk p-5 text-primary-foreground shadow-yolk"
          : "rounded-2xl border bg-card p-5 shadow-soft"
      }
    >
      <div className="flex items-start justify-between">
        <p className={yolk ? "text-sm font-medium text-primary-foreground/80" : "text-sm font-medium text-muted-foreground"}>
          {label}
        </p>
        {icon && (
          <span className={yolk ? "rounded-lg bg-card/30 p-2" : "rounded-lg bg-accent p-2 text-accent-foreground"}>{icon}</span>
        )}
      </div>
      <p className="tabular mt-3 font-display text-2xl font-extrabold sm:text-3xl">{value}</p>
      {hint && <div className={yolk ? "mt-1 text-xs text-primary-foreground/75" : "mt-1 text-xs text-muted-foreground"}>{hint}</div>}
    </div>
  );
}

export function RouteError({ error }: { error: unknown }) {
  return (
    <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-6 text-sm">
      Gagal memuat data: {error instanceof Error ? error.message : String(error)}
    </div>
  );
}
