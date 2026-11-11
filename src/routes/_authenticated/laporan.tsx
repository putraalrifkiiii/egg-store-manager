import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Download } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, RouteError, StatCard } from "@/components/app/page-header";
import { DateRange, parseDate } from "@/components/app/date-range";
import { dailyQuery, paymentQuery, topProductsQuery } from "@/lib/store-api";
import { formatDayShort, formatQty, formatRupiah, jakartaDate, PAYMENT_LABELS } from "@/lib/format";

type Search = { from?: string | undefined; to?: string | undefined };

export const Route = createFileRoute("/_authenticated/laporan")({
  validateSearch: (s: Record<string, unknown>): Search => ({ from: parseDate(s["from"]), to: parseDate(s["to"]) }),
  loaderDeps: ({ search }) => search,
  head: () => ({
    meta: [
      { title: "Laporan Penjualan — Kasir Toko Telur" },
      { name: "description", content: "Laporan omzet, laba, produk terlaris, dan metode pembayaran." },
      { property: "og:title", content: "Laporan Penjualan — Kasir Toko Telur" },
      { property: "og:description", content: "Laporan omzet, laba, produk terlaris, dan metode pembayaran." },
    ],
  }),
  loader: ({ context, deps }) => {
    const r = resolve(deps);
    context.queryClient.ensureQueryData(dailyQuery(r.from, r.to));
    context.queryClient.ensureQueryData(topProductsQuery(r.from, r.to, 20));
    context.queryClient.ensureQueryData(paymentQuery(r.from, r.to));
  },
  component: LaporanPage,
  errorComponent: ({ error }) => <RouteError error={error} />,
});

function resolve(s: Search) {
  const today = jakartaDate();
  return { from: s.from ?? today.slice(0, 8) + "01", to: s.to ?? today };
}

const chartConfig = {
  revenue: { label: "Omzet", color: "var(--chart-1)" },
  profit: { label: "Laba", color: "var(--chart-2)" },
} satisfies ChartConfig;

function downloadCsv(name: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function LaporanPage() {
  const r = resolve(Route.useSearch());
  const navigate = useNavigate({ from: Route.fullPath });
  const { data: daily } = useSuspenseQuery(dailyQuery(r.from, r.to));
  const { data: top } = useSuspenseQuery(topProductsQuery(r.from, r.to, 20));
  const { data: payments } = useSuspenseQuery(paymentQuery(r.from, r.to));

  const revenue = daily.reduce((s, d) => s + d.revenue, 0);
  const profit = daily.reduce((s, d) => s + d.profit, 0);
  const trx = daily.reduce((s, d) => s + d.transactions, 0);

  function exportCsv() {
    downloadCsv(`laporan-${r.from}_${r.to}.csv`, [
      ["Tanggal", "Transaksi", "Omzet", "Laba kotor"],
      ...daily.map((d) => [d.day, d.transactions, d.revenue, d.profit]),
      ["TOTAL", trx, revenue, profit],
    ]);
  }

  return (
    <>
      <PageHeader
        title="Laporan"
        description="Omzet dan laba per periode."
        actions={
          <Button variant="outline" onClick={exportCsv}>
            <Download /> Unduh CSV
          </Button>
        }
      />
      <div className="mb-6">
        <DateRange from={r.from} to={r.to} onChange={(v) => navigate({ search: v })} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard tone="yolk" label="Total omzet" value={formatRupiah(revenue)} />
        <StatCard label="Laba kotor" value={formatRupiah(profit)} hint={revenue ? `Margin ${((profit / revenue) * 100).toFixed(1)}%` : undefined} />
        <StatCard label="Jumlah transaksi" value={String(trx)} />
        <StatCard label="Rata-rata per transaksi" value={formatRupiah(trx ? revenue / trx : 0)} />
      </div>

      <section className="mt-6 rounded-2xl border bg-card p-5 shadow-soft">
        <h2 className="mb-4 text-lg font-bold">Omzet & laba harian</h2>
        <ChartContainer config={chartConfig} className="h-[280px] w-full">
          <BarChart data={daily}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="day" tickLine={false} axisLine={false} tickFormatter={formatDayShort} minTickGap={12} />
            <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={(v) => (v >= 1e6 ? `${v / 1e6}jt` : v >= 1e3 ? `${v / 1e3}rb` : String(v))} />
            <ChartTooltip
              content={<ChartTooltipContent labelFormatter={(v) => formatDayShort(String(v))} formatter={(v, name) => `${chartConfig[name as keyof typeof chartConfig]?.label}: ${formatRupiah(Number(v))}`} />}
            />
            <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[6, 6, 0, 0]} />
            <Bar dataKey="profit" fill="var(--color-profit)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <section className="overflow-hidden rounded-2xl border bg-card shadow-soft xl:col-span-2">
          <h2 className="p-5 pb-2 text-lg font-bold">Penjualan per produk</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produk</TableHead>
                <TableHead className="text-right">Terjual</TableHead>
                <TableHead className="text-right">Omzet</TableHead>
                <TableHead className="text-right">Laba</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {top.map((t) => (
                <TableRow key={t.product_name + t.unit}>
                  <TableCell className="font-medium">{t.product_name}</TableCell>
                  <TableCell className="tabular text-right">
                    {formatQty(t.quantity)} {t.unit}
                  </TableCell>
                  <TableCell className="tabular text-right font-semibold">{formatRupiah(t.revenue)}</TableCell>
                  <TableCell className="tabular text-right text-success">{formatRupiah(t.profit)}</TableCell>
                </TableRow>
              ))}
              {top.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    Belum ada penjualan pada periode ini.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </section>

        <section className="rounded-2xl border bg-card p-5 shadow-soft">
          <h2 className="mb-4 text-lg font-bold">Metode pembayaran</h2>
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada data.</p>
          ) : (
            <ul className="space-y-4">
              {payments.map((p) => {
                const pct = revenue ? (p.revenue / revenue) * 100 : 0;
                return (
                  <li key={p.payment_method}>
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{PAYMENT_LABELS[p.payment_method] ?? p.payment_method}</span>
                      <span className="tabular font-semibold">{formatRupiah(p.revenue)}</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-yolk" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {p.transactions} transaksi · {pct.toFixed(0)}%
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
