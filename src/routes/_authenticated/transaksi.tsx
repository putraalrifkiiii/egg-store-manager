import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Printer, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, RouteError } from "@/components/app/page-header";
import { DateRange, parseDate } from "@/components/app/date-range";
import { Receipt } from "@/components/app/receipt";
import { PAGE_SIZE, saleDetailQuery, salesQuery } from "@/lib/store-api";
import { formatDateTime, formatRupiah, jakartaDate, shiftDate, PAYMENT_LABELS } from "@/lib/format";

type TrxSearch = { from?: string | undefined; to?: string | undefined; page?: number | undefined; q?: string | undefined };

export const Route = createFileRoute("/_authenticated/transaksi")({
  validateSearch: (s: Record<string, unknown>): TrxSearch => ({
    from: parseDate(s["from"]),
    to: parseDate(s["to"]),
    page: Number(s["page"]) > 0 ? Math.floor(Number(s["page"])) : undefined,
    q: typeof s["q"] === "string" && s["q"] ? s["q"] : undefined,
  }),
  loaderDeps: ({ search }) => search,
  head: () => ({
    meta: [
      { title: "Transaksi Penjualan — Kasir Toko Telur" },
      { name: "description", content: "Riwayat transaksi penjualan telur lengkap dengan struk." },
      { property: "og:title", content: "Transaksi Penjualan — Kasir Toko Telur" },
      { property: "og:description", content: "Riwayat transaksi penjualan telur lengkap dengan struk." },
    ],
  }),
  loader: ({ context, deps }) => {
    context.queryClient.ensureQueryData(salesQuery(resolve(deps)));
  },
  component: TransaksiPage,
  errorComponent: ({ error }) => <RouteError error={error} />,
});

function resolve(s: TrxSearch) {
  const today = jakartaDate();
  return { from: s.from ?? shiftDate(today, -6), to: s.to ?? today, page: s.page ?? 0, q: s.q ?? "" };
}

function TransaksiPage() {
  const search = Route.useSearch();
  const params = resolve(search);
  const navigate = useNavigate({ from: Route.fullPath });
  const { data } = useSuspenseQuery(salesQuery(params));
  const [q, setQ] = useState(params.q);
  const [selected, setSelected] = useState<string | null>(null);
  const pages = Math.max(1, Math.ceil(data.count / PAGE_SIZE));
  const pageTotal = data.rows.reduce((s, r) => s + Number(r.total), 0);

  return (
    <>
      <PageHeader title="Transaksi" description={`${data.count} transaksi pada periode ini`} />

      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <DateRange from={params.from} to={params.to} onChange={(r) => navigate({ search: (p) => ({ ...p, ...r, page: undefined }) })} />
        <form
          className="relative w-full max-w-xs"
          onSubmit={(e) => {
            e.preventDefault();
            navigate({ search: (p) => ({ ...p, q: q || undefined, page: undefined }) });
          }}
        >
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="No. struk / pelanggan, Enter" className="bg-card pl-9" />
        </form>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No. struk</TableHead>
              <TableHead>Waktu</TableHead>
              <TableHead>Pelanggan</TableHead>
              <TableHead>Bayar</TableHead>
              <TableHead>Kasir</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((s) => (
              <TableRow key={s.id} className="cursor-pointer" onClick={() => setSelected(s.id)}>
                <TableCell className="font-medium">{s.invoice_no}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(s.created_at)}</TableCell>
                <TableCell>{s.customer_name ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{PAYMENT_LABELS[s.payment_method] ?? s.payment_method}</Badge>
                </TableCell>
                <TableCell className="max-w-[180px] truncate text-muted-foreground">{s.cashier_email ?? "—"}</TableCell>
                <TableCell className="tabular text-right font-semibold">{formatRupiah(s.total)}</TableCell>
              </TableRow>
            ))}
            {data.rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  Tidak ada transaksi pada periode ini.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Halaman {params.page + 1} dari {pages} · total halaman ini <span className="tabular font-semibold text-foreground">{formatRupiah(pageTotal)}</span>
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={params.page === 0} onClick={() => navigate({ search: (p) => ({ ...p, page: params.page - 1 || undefined }) })}>
            Sebelumnya
          </Button>
          <Button variant="outline" size="sm" disabled={params.page + 1 >= pages} onClick={() => navigate({ search: (p) => ({ ...p, page: params.page + 1 }) })}>
            Berikutnya
          </Button>
        </div>
      </div>

      <SaleDialog id={selected} onClose={() => setSelected(null)} />
    </>
  );
}

function SaleDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data } = useQuery({ ...saleDetailQuery(id ?? ""), enabled: !!id });
  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Detail transaksi</DialogTitle>
        </DialogHeader>
        {data ? <Receipt sale={data.sale} items={data.items} /> : <p className="text-sm text-muted-foreground">Memuat…</p>}
        <DialogFooter>
          <Button onClick={() => window.print()} disabled={!data}>
            <Printer /> Cetak ulang
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
