import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, RouteError } from "@/components/app/page-header";
import { productsQuery, type Product } from "@/lib/store-api";
import { CATEGORIES, UNITS, formatQty, formatRupiah } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/produk")({
  head: () => ({
    meta: [
      { title: "Manajemen Produk — Kasir Toko Telur" },
      { name: "description", content: "Tambah, ubah, dan atur harga produk telur." },
      { property: "og:title", content: "Manajemen Produk — Kasir Toko Telur" },
      { property: "og:description", content: "Tambah, ubah, dan atur harga produk telur." },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(productsQuery());
  },
  component: ProdukPage,
  errorComponent: ({ error }) => <RouteError error={error} />,
});

type FormState = {
  name: string;
  category: string;
  unit: string;
  price: string;
  cost_price: string;
  min_stock: string;
  stock: string;
};

const emptyForm: FormState = { name: "", category: "Ayam Ras", unit: "kg", price: "", cost_price: "", min_stock: "0", stock: "0" };

function ProdukPage() {
  const { data: products } = useSuspenseQuery(productsQuery());
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [toDelete, setToDelete] = useState<Product | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["products"] });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        category: form.category,
        unit: form.unit,
        price: Number(form.price) || 0,
        cost_price: Number(form.cost_price) || 0,
        min_stock: Number(form.min_stock) || 0,
      };
      if (!payload.name) throw new Error("Nama produk wajib diisi");
      if (editing) {
        const { error } = await supabase.from("products").update(payload).eq("id", editing.id);
        if (error) throw new Error(error.message);
      } else {
        const { data, error } = await supabase.from("products").insert({ ...payload, stock: 0 }).select("id").single();
        if (error) throw new Error(error.message);
        const initial = Number(form.stock) || 0;
        if (initial > 0) {
          const r = await supabase.rpc("adjust_stock", { _product_id: data.id, _type: "in", _quantity: initial, _note: "Stok awal" });
          if (r.error) throw new Error(r.error.message);
        }
      }
    },
    onSuccess: () => {
      refresh();
      queryClient.invalidateQueries({ queryKey: ["stock_movements"] });
      setOpen(false);
      toast.success(editing ? "Produk diperbarui" : "Produk ditambahkan");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async (p: Product) => {
      const { error } = await supabase.from("products").update({ is_active: !p.is_active }).eq("id", p.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (p: Product) => {
      const { error } = await supabase.from("products").delete().eq("id", p.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      refresh();
      setToDelete(null);
      toast.success("Produk dihapus");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      name: p.name,
      category: p.category,
      unit: p.unit,
      price: String(p.price),
      cost_price: String(p.cost_price),
      min_stock: String(p.min_stock),
      stock: String(p.stock),
    });
    setOpen(true);
  }

  const rows = products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const margin = (Number(form.price) || 0) - (Number(form.cost_price) || 0);

  return (
    <>
      <PageHeader
        title="Produk"
        description={`${products.length} produk terdaftar`}
        actions={
          <Button onClick={openNew}>
            <Plus /> Tambah produk
          </Button>
        }
      />

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari produk…" className="bg-card pl-9" />
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produk</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead className="text-right">Harga jual</TableHead>
              <TableHead className="text-right">Harga modal</TableHead>
              <TableHead className="text-right">Margin</TableHead>
              <TableHead className="text-right">Stok</TableHead>
              <TableHead className="text-center">Aktif</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((p) => {
              const m = Number(p.price) - Number(p.cost_price);
              return (
                <TableRow key={p.id} className={p.is_active ? "" : "opacity-60"}>
                  <TableCell>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">per {p.unit}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{p.category}</Badge>
                  </TableCell>
                  <TableCell className="tabular text-right font-semibold">{formatRupiah(p.price)}</TableCell>
                  <TableCell className="tabular text-right text-muted-foreground">{formatRupiah(p.cost_price)}</TableCell>
                  <TableCell className="tabular text-right">
                    <span className={m < 0 ? "text-destructive" : "text-success"}>{formatRupiah(m)}</span>
                  </TableCell>
                  <TableCell className="tabular text-right">
                    {formatQty(p.stock)} {p.unit}
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch checked={p.is_active} onCheckedChange={() => toggle.mutate(p)} aria-label={`Aktifkan ${p.name}`} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(p)} aria-label={`Ubah ${p.name}`}>
                      <Pencil />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setToDelete(p)} aria-label={`Hapus ${p.name}`}>
                      <Trash2 />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                  Belum ada produk.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Ubah produk" : "Tambah produk"}</DialogTitle>
          </DialogHeader>
          <form
            id="product-form"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
            className="grid gap-4 sm:grid-cols-2"
          >
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="name">Nama produk</Label>
              <Input id="name" value={form.name} onChange={set("name")} placeholder="Telur Ayam Ras" required />
            </div>
            <div className="space-y-1.5">
              <Label>Kategori</Label>
              <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Satuan</Label>
              <Select value={form.unit} onValueChange={(v) => setForm((f) => ({ ...f, unit: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="price">Harga jual (Rp)</Label>
              <Input id="price" type="number" min={0} value={form.price} onChange={set("price")} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cost">Harga modal (Rp)</Label>
              <Input id="cost" type="number" min={0} value={form.cost_price} onChange={set("cost_price")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="min">Batas stok minimum</Label>
              <Input id="min" type="number" min={0} step="any" value={form.min_stock} onChange={set("min_stock")} />
            </div>
            {!editing && (
              <div className="space-y-1.5">
                <Label htmlFor="stock">Stok awal</Label>
                <Input id="stock" type="number" min={0} step="any" value={form.stock} onChange={set("stock")} />
              </div>
            )}
            <p className="text-sm text-muted-foreground sm:col-span-2">
              Margin per {form.unit}: <span className={margin < 0 ? "font-semibold text-destructive" : "font-semibold text-success"}>{formatRupiah(margin)}</span>
              {editing && " · Ubah stok lewat menu Stok Barang."}
            </p>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type="submit" form="product-form" disabled={save.isPending}>
              {save.isPending ? "Menyimpan…" : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus {toDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Riwayat stok produk ini ikut terhapus. Riwayat penjualan tetap tersimpan. Jika hanya ingin menyembunyikan dari kasir, matikan saja tombol Aktif.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={() => toDelete && remove.mutate(toDelete)}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
