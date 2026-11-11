import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowDownToLine, ArrowUpFromLine, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, RouteError, StatCard } from "@/components/app/page-header";
import { adjustStock, movementsQuery, productsQuery, type Product } from "@/lib/store-api";
import { formatDateTime, formatQty, formatRupiah } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/stok")({
  head: () => ({
    meta: [
      { title: "Stok Barang — Kasir Toko Telur" },
      { name: "description", content: "Pantau stok telur, catat barang masuk, keluar, dan penyesuaian." },
      { property: "og:title", content: "Stok Barang — Kasir Toko Telur" },
      { property: "og:description", content: "Pantau stok telur, catat barang masuk, keluar, dan penyesuaian." },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(productsQuery());
    context.queryClient.ensureQueryData(movementsQuery());
  },
  component: StokPage,
  errorComponent: ({ error }) => <RouteError error={error} />,
});

type Mode = "in" | "out" | "adjust";
const MODE_LABEL: Record<Mode, string> = { in: "Stok masuk", out: "Stok keluar", adjust: "Penyesuaian stok" };
const MOVE_LABEL: Record<string, { label: string; variant: "success" | "danger" | "warning" | "secondary" }> = {
  in: { label: "Masuk", variant: "success" },
  out: { label: "Keluar", variant: "danger" },
  adjust: { label: "Penyesuaian", variant: "warning" },
  sale: { label: "Penjualan", variant: "secondary" },
};

function StokPage() {
  const { data: products } = useSuspenseQuery(productsQuery());
  const { data: movements } = useSuspenseQuery(movementsQuery());
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<{ product: Product; mode: Mode } | null>(null);
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");

  const mutation = useMutation({
    mutationFn: adjustStock,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["stock_movements"] });
      toast.success("Stok diperbarui");
      setTarget(null);
    },
    onError: (e: Error) => toast.error("Gagal memperbarui stok", { description: e.message }),
  });

  function open(product: Product, mode: Mode) {
    setTarget({ product, mode });
    setQty(mode === "adjust" ? String(product.stock) : "");
    setNote("");
  }

  const stockValue = products.reduce((s, p) => s + Number(p.stock) * Number(p.cost_price), 0);
  const low = products.filter((p) => p.is_active && Number(p.stock) <= Number(p.min_stock)).length;

  return (
    <>
      <PageHeader title="Stok Barang" description="Catat telur masuk dari peternak, barang rusak/pecah, atau hasil hitung ulang." />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard tone="yolk" label="Nilai stok (harga modal)" value={formatRupiah(stockValue)} />
        <StatCard label="Jumlah produk" value={String(products.length)} />
        <StatCard label="Perlu ditambah" value={`${low} produk`} hint="Stok di bawah batas minimum" />
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produk</TableHead>
              <TableHead className="text-right">Stok</TableHead>
              <TableHead className="text-right">Minimum</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((p) => {
              const stock = Number(p.stock);
              const min = Number(p.min_stock);
              const status = stock <= 0 ? { l: "Habis", v: "danger" as const } : stock <= min ? { l: "Menipis", v: "warning" as const } : { l: "Aman", v: "success" as const };
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="tabular text-right font-semibold">
                    {formatQty(stock)} {p.unit}
                  </TableCell>
                  <TableCell className="tabular text-right text-muted-foreground">
                    {formatQty(min)} {p.unit}
                  </TableCell>
                  <TableCell>
                    <Badge variant={status.v}>{status.l}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => open(p, "in")}>
                        <ArrowDownToLine /> Masuk
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => open(p, "out")}>
                        <ArrowUpFromLine /> Keluar
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => open(p, "adjust")} aria-label={`Sesuaikan stok ${p.name}`}>
                        <SlidersHorizontal />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <h2 className="mb-3 mt-10 text-xl font-bold">Riwayat mutasi stok</h2>
      <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Waktu</TableHead>
              <TableHead>Produk</TableHead>
              <TableHead>Jenis</TableHead>
              <TableHead className="text-right">Perubahan</TableHead>
              <TableHead className="text-right">Stok akhir</TableHead>
              <TableHead>Keterangan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movements.map((m) => {
              const t = MOVE_LABEL[m.type] ?? { label: m.type, variant: "secondary" as const };
              const q = Number(m.quantity);
              return (
                <TableRow key={m.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(m.created_at)}</TableCell>
                  <TableCell>{m.products?.name ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={t.variant}>{t.label}</Badge>
                  </TableCell>
                  <TableCell className={`tabular text-right font-semibold ${q < 0 ? "text-destructive" : "text-success"}`}>
                    {q > 0 ? "+" : ""}
                    {formatQty(q)}
                  </TableCell>
                  <TableCell className="tabular text-right">
                    {formatQty(m.stock_after)} {m.products?.unit}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{m.note ?? "—"}</TableCell>
                </TableRow>
              );
            })}
            {movements.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  Belum ada mutasi stok.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent className="max-w-md">
          {target && (
            <>
              <DialogHeader>
                <DialogTitle>{MODE_LABEL[target.mode]}</DialogTitle>
                <DialogDescription>
                  {target.product.name} · stok sekarang {formatQty(target.product.stock)} {target.product.unit}
                </DialogDescription>
              </DialogHeader>
              <form
                id="stock-form"
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  mutation.mutate({ productId: target.product.id, type: target.mode, quantity: Number(qty), note });
                }}
              >
                <div className="space-y-1.5">
                  <Label htmlFor="qty">{target.mode === "adjust" ? `Stok sebenarnya (${target.product.unit})` : `Jumlah (${target.product.unit})`}</Label>
                  <Input id="qty" type="number" min={0} step="any" value={qty} onChange={(e) => setQty(e.target.value)} required autoFocus />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="note">Keterangan</Label>
                  <Input
                    id="note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={target.mode === "in" ? "Kiriman peternak" : target.mode === "out" ? "Telur pecah / rusak" : "Hasil hitung ulang"}
                  />
                </div>
              </form>
              <DialogFooter>
                <Button variant="outline" onClick={() => setTarget(null)}>
                  Batal
                </Button>
                <Button type="submit" form="stock-form" disabled={mutation.isPending || qty === ""}>
                  Simpan
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
