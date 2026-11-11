import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Minus, Plus, Printer, Search, ShoppingBasket, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PageHeader, RouteError } from "@/components/app/page-header";
import { Receipt } from "@/components/app/receipt";
import { createSale, productsQuery, saleDetailQuery } from "@/lib/store-api";
import { addToCart, cartTotal, changeDue, lineSubtotal, setQuantity, stepFor, type CartLine } from "@/lib/cart";
import { formatQty, formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/kasir")({
  head: () => ({
    meta: [
      { title: "Kasir — Toko Telur" },
      { name: "description", content: "Catat penjualan telur dengan cepat dan cetak struk." },
      { property: "og:title", content: "Kasir — Toko Telur" },
      { property: "og:description", content: "Catat penjualan telur dengan cepat dan cetak struk." },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(productsQuery());
  },
  component: KasirPage,
  errorComponent: ({ error }) => <RouteError error={error} />,
});

function KasirPage() {
  const { data: products } = useSuspenseQuery(productsQuery());
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Semua");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [method, setMethod] = useState("tunai");
  const [paidInput, setPaidInput] = useState("");
  const [customer, setCustomer] = useState("");
  const [receiptId, setReceiptId] = useState<string | null>(null);

  const active = products.filter((p) => p.is_active);
  const categories = ["Semua", ...Array.from(new Set(active.map((p) => p.category)))];
  const shown = useMemo(
    () =>
      active.filter(
        (p) =>
          (category === "Semua" || p.category === category) &&
          p.name.toLowerCase().includes(search.trim().toLowerCase()),
      ),
    [active, category, search],
  );

  const total = cartTotal(cart);
  const paid = method === "tunai" ? Number(paidInput.replace(/\D/g, "")) || 0 : total;
  const change = changeDue(total, paid);

  const mutation = useMutation({
    mutationFn: createSale,
    onSuccess: (saleId) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["report"] });
      queryClient.invalidateQueries({ queryKey: ["stock_movements"] });
      setCart([]);
      setPaidInput("");
      setCustomer("");
      setReceiptId(saleId);
      toast.success("Transaksi berhasil disimpan");
    },
    onError: (e: Error) => toast.error("Transaksi gagal", { description: e.message }),
  });

  function checkout() {
    if (!cart.length) return;
    if (change === null) {
      toast.error("Uang dibayar kurang dari total");
      return;
    }
    mutation.mutate({
      items: cart.map((l) => ({ product_id: l.id, quantity: l.quantity })),
      paid,
      method,
      customer,
    });
  }

  const quickAmounts = Array.from(new Set([total, Math.ceil(total / 50000) * 50000, Math.ceil(total / 100000) * 100000])).filter((v) => v > 0);

  return (
    <>
      <PageHeader title="Kasir" description="Pilih produk, atur jumlah, lalu terima pembayaran." />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <section>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari produk…" className="h-11 bg-card pl-9" />
            </div>
          </div>
          <div className="mb-5 flex flex-wrap gap-2">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={cn(
                  "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                  c === category ? "border-transparent bg-foreground text-background" : "bg-card hover:bg-accent",
                )}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {shown.map((p) => {
              const stock = Number(p.stock);
              const inCart = cart.find((l) => l.id === p.id)?.quantity ?? 0;
              const empty = stock <= 0;
              return (
                <button
                  key={p.id}
                  disabled={empty || inCart >= stock}
                  onClick={() =>
                    setCart((c) => addToCart(c, { id: p.id, name: p.name, unit: p.unit, price: Number(p.price), stock }))
                  }
                  className={cn(
                    "group relative flex flex-col rounded-2xl border bg-card p-4 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0",
                    inCart > 0 && "border-primary ring-2 ring-primary/40",
                  )}
                >
                  <div className="egg-shape mb-3 h-10 w-8 bg-shell ring-1 ring-border transition-colors group-hover:bg-yolk" />
                  <p className="line-clamp-2 text-sm font-semibold leading-snug">{p.name}</p>
                  <p className="tabular mt-1 font-display text-lg font-extrabold">{formatRupiah(p.price)}</p>
                  <p className="text-xs text-muted-foreground">per {p.unit}</p>
                  <p className={cn("mt-2 text-xs", stock <= Number(p.min_stock) ? "font-semibold text-destructive" : "text-muted-foreground")}>
                    Stok {formatQty(stock)} {p.unit}
                  </p>
                  {inCart > 0 && (
                    <span className="tabular absolute right-3 top-3 rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
                      {formatQty(inCart)}
                    </span>
                  )}
                </button>
              );
            })}
            {shown.length === 0 && <p className="col-span-full text-sm text-muted-foreground">Produk tidak ditemukan.</p>}
          </div>
        </section>

        <aside className="h-fit rounded-2xl border bg-card shadow-soft lg:sticky lg:top-6">
          <div className="flex items-center gap-2 border-b p-4">
            <ShoppingBasket className="h-5 w-5 text-primary-deep" />
            <h2 className="text-lg font-bold">Keranjang</h2>
            {cart.length > 0 && (
              <button onClick={() => setCart([])} className="ml-auto text-xs text-muted-foreground hover:text-destructive">
                Kosongkan
              </button>
            )}
          </div>

          <div className="max-h-[38vh] space-y-3 overflow-y-auto p-4">
            {cart.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Ketuk produk untuk menambahkan.</p>}
            {cart.map((l) => {
              const step = stepFor(l.unit);
              return (
                <div key={l.id} className="rounded-xl bg-muted p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-snug">{l.name}</p>
                    <button onClick={() => setCart((c) => setQuantity(c, l.id, 0))} aria-label={`Hapus ${l.name}`} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="outline" className="h-8 w-8 bg-card" onClick={() => setCart((c) => setQuantity(c, l.id, l.quantity - step))} aria-label="Kurangi">
                        <Minus />
                      </Button>
                      <Input
                        type="number"
                        inputMode="decimal"
                        step={step}
                        min={0}
                        value={l.quantity}
                        onChange={(e) => setCart((c) => setQuantity(c, l.id, Number(e.target.value)))}
                        className="tabular h-8 w-16 bg-card text-center"
                        aria-label={`Jumlah ${l.name}`}
                      />
                      <Button size="icon" variant="outline" className="h-8 w-8 bg-card" onClick={() => setCart((c) => setQuantity(c, l.id, l.quantity + step))} aria-label="Tambah" disabled={l.quantity >= l.stock}>
                        <Plus />
                      </Button>
                      <span className="ml-1 text-xs text-muted-foreground">{l.unit}</span>
                    </div>
                    <span className="tabular text-sm font-semibold">{formatRupiah(lineSubtotal(l))}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-4 border-t p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="tabular font-display text-3xl font-extrabold">{formatRupiah(total)}</span>
            </div>

            <div className="space-y-1.5">
              <Label>Metode bayar</Label>
              <ToggleGroup type="single" value={method} onValueChange={(v) => v && setMethod(v)} className="grid grid-cols-3" variant="outline">
                <ToggleGroupItem value="tunai">Tunai</ToggleGroupItem>
                <ToggleGroupItem value="qris">QRIS</ToggleGroupItem>
                <ToggleGroupItem value="transfer">Transfer</ToggleGroupItem>
              </ToggleGroup>
            </div>

            {method === "tunai" && (
              <div className="space-y-1.5">
                <Label htmlFor="paid">Uang diterima</Label>
                <Input
                  id="paid"
                  inputMode="numeric"
                  value={paidInput ? new Intl.NumberFormat("id-ID").format(Number(paidInput.replace(/\D/g, ""))) : ""}
                  onChange={(e) => setPaidInput(e.target.value.replace(/\D/g, ""))}
                  placeholder="0"
                  className="tabular h-11 text-lg"
                />
                <div className="flex flex-wrap gap-1.5">
                  {quickAmounts.map((v, i) => (
                    <button key={v} onClick={() => setPaidInput(String(v))} className="rounded-md border bg-muted px-2.5 py-1 text-xs font-medium hover:bg-accent">
                      {i === 0 ? "Uang pas" : formatRupiah(v)}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between pt-1 text-sm">
                  <span className="text-muted-foreground">Kembalian</span>
                  <span className={cn("tabular font-semibold", change === null && total > 0 && "text-destructive")}>
                    {change === null ? (total > 0 ? "Uang kurang" : "—") : formatRupiah(change)}
                  </span>
                </div>
              </div>
            )}

            <Input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Nama pelanggan (opsional)" />

            <Button size="lg" className="h-12 w-full text-base shadow-yolk" disabled={!cart.length || change === null || mutation.isPending} onClick={checkout}>
              {mutation.isPending ? "Menyimpan…" : `Bayar ${formatRupiah(total)}`}
            </Button>
          </div>
        </aside>
      </div>

      <ReceiptDialog saleId={receiptId} onClose={() => setReceiptId(null)} />
    </>
  );
}

function ReceiptDialog({ saleId, onClose }: { saleId: string | null; onClose: () => void }) {
  const { data } = useQuery({ ...saleDetailQuery(saleId ?? ""), enabled: !!saleId });
  return (
    <Dialog open={!!saleId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Transaksi berhasil</DialogTitle>
        </DialogHeader>
        {data ? <Receipt sale={data.sale} items={data.items} /> : <p className="text-sm text-muted-foreground">Memuat struk…</p>}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Transaksi baru
          </Button>
          <Button onClick={() => window.print()} disabled={!data}>
            <Printer /> Cetak struk
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
