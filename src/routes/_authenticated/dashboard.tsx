import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { AlertTriangle, Coins, ReceiptText, ShoppingBasket, TrendingUp } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader, RouteError, StatCard } from "@/components/app/page-header";
import { dailyQuery, productsQuery, recentSalesQuery, topProductsQuery } from "@/lib/store-api";
import { formatDayShort, formatDateTime, formatQty, formatRupiah, jakartaDate, shiftDate, PAYMENT_LABELS } from "@/lib/format";

const range = () => {
  const today = jakartaDate();
  return { today, from: shiftDate(today, -13), monthStart: today.slice(0, 8) + "01" };
};

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard Omzet — Kasir Toko Telur" },
      { name: "description", content: "Ringkasan omzet, laba, transaksi, dan stok menipis toko telur." },
      { property: "og:title", content: "Dashboard Omzet — Kasir Toko Telur" },
      { property: "og:description", content: "Ringkasan omzet, laba, transaksi, dan stok menipis toko telur." },
    ],
  }),
  loader: ({ context }) => {
    const r = range();
    context.queryClient.ensureQueryData(dailyQuery(r.from, r.today));
    context.queryClient.ensureQueryData(productsQuery());
    context.queryClient.ensureQueryData(recentSalesQuery());
    context.queryClient.ensureQueryData(topProductsQuery(r.monthStart, r.today, 5));
  },
  component: Dashboard,
  errorComponent: ({ error }) => <RouteError error={error} />,
});

const chartConfig = {
  revenue: { label: "Omzet", color: "var(--chart-1)" },
  profit: { label: "Laba", color: "var(--chart-2)" },
} satisfies ChartConfig;

function Dashboard() {
  const r = range();
  const { data: daily } = useSuspenseQuery(dailyQuery(r.from, r.today));
  const { data: products } = useSuspenseQuery(productsQuery());
  const { data: recent } = useSuspenseQuery(recentSalesQuery());
  const { data: top } = useSuspenseQuery(topProductsQuery(r.monthStart, r.today, 5));

  const today = daily[daily.length - 1] ?? { revenue: 0, profit: 0, transactions: 0 };
  const yesterday = daily[daily.length - 2] ?? { revenue: 0 };
  const week = daily.slice(-7).reduce((s, d) => s + d.revenue, 0);
  const lowStock = products.filter((p) => p.is_active && Number(p.stock) <= Number(p.min_stock));
  const diff = yesterday.revenue > 0 ? ((today.revenue - yesterday.revenue) / yesterday.revenue) * 100 : null;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Ringkasan omzet dan kondisi toko hari ini."
        actions={
          <Button asChild size="lg" className="shadow-yolk">
            <Link to="/kasir">
              <ShoppingBasket /> Buka Kasir
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          tone="yolk"
          label="Omzet hari ini"
          value={formatRupiah(today.revenue)}
          icon={<Coins className="h-4 w-4" />}
          hint={diff === null ? "Belum ada pembanding kemarin" : `${diff >= 0 ? "+" : ""}${diff.toFixed(0)}% dari kemarin`}
        />
        <StatCard label="Laba kotor hari ini" value={formatRupiah(today.profit)} icon={<TrendingUp className="h-4 w-4" />} hint="Omzet dikurangi harga modal" />
        <StatCard label="Transaksi hari ini" value={String(today.transactions)} icon={<ReceiptText className="h-4 w-4" />} hint={`Omzet 7 hari: ${formatRupiah(week)}`} />
        <StatCard
          label="Stok menipis"
          value={`${lowStock.length} produk`}
          icon={<AlertTriangle className="h-4 w-4" />}
          hint={lowStock.length ? "Segera tambah stok" : "Semua stok aman"}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <section className="rounded-2xl border bg-card p-5 shadow-soft xl:col-span-2">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-lg font-bold">Omzet 14 hari terakhir</h2>
            <span className="tabular text-sm text-muted-foreground">{formatRupiah(daily.reduce((s, d) => s + d.revenue, 0))}</span>
          </div>
          <ChartContainer config={chartConfig} className="h-[260px] w-full">
            <AreaChart data={daily} margin={{ left: 4, right: 8 }}>
              <defs>
                <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-revenue)" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="var(--color-revenue)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="day" tickLine={false} axisLine={false} tickFormatter={formatDayShort} minTickGap={16} />
              <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={(v) => (v >= 1e6 ? `${v / 1e6}jt` : v >= 1e3 ? `${v / 1e3}rb` : String(v))} />
              <ChartTooltip
                content={<ChartTooltipContent labelFormatter={(v) => formatDayShort(String(v))} formatter={(v, name) => `${chartConfig[name as keyof typeof chartConfig]?.label}: ${formatRupiah(Number(v))}`} />}
              />
              <Area dataKey="revenue" type="monotone" stroke="var(--color-revenue)" strokeWidth={2.5} fill="url(#fillRevenue)" />
              <Area dataKey="profit" type="monotone" stroke="var(--color-profit)" strokeWidth={2} fill="transparent" />
            </AreaChart>
          </ChartContainer>
        </section>

        <section className="rounded-2xl border bg-card p-5 shadow-soft">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">Stok menipis</h2>
            <Link to="/stok" className="text-sm font-medium text-primary-deep hover:underline">Kelola stok</Link>
          </div>
          {lowStock.length === 0 ? (
            <p className="text-sm text-muted-foreground">Semua produk di atas batas minimum.</p>
          ) : (
            <ul className="space-y-3">
              {lowStock.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">{p.name}</span>
                  <Badge variant={Number(p.stock) <= 0 ? "danger" : "warning"} className="tabular">
                    {formatQty(p.stock)} {p.unit}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border bg-card p-5 shadow-soft">
          <h2 className="mb-4 text-lg font-bold">Produk terlaris bulan ini</h2>
          {top.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada penjualan bulan ini.</p>
          ) : (
            <ol className="space-y-3">
              {top.map((t, i) => (
                <li key={t.product_name + t.unit} className="flex items-center gap-3">
                  <span className="egg-shape flex h-8 w-7 items-center justify-center bg-accent text-xs font-bold text-accent-foreground">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{t.product_name}</p>
                    <p className="text-xs text-muted-foreground">{formatQty(t.quantity)} {t.unit} terjual</p>
                  </div>
                  <span className="tabular text-sm font-semibold">{formatRupiah(t.revenue)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="rounded-2xl border bg-card p-5 shadow-soft">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">Transaksi terbaru</h2>
            <Link to="/transaksi" className="text-sm font-medium text-primary-deep hover:underline">Lihat semua</Link>
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada transaksi. Mulai dari menu Kasir.</p>
          ) : (
            <ul className="divide-y">
              {recent.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium">{s.invoice_no}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(s.created_at)} · {PAYMENT_LABELS[s.payment_method] ?? s.payment_method}</p>
                  </div>
                  <span className="tabular text-sm font-semibold">{formatRupiah(s.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
