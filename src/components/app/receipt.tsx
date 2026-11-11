import type { Sale, SaleItem } from "@/lib/store-api";
import { formatDateTime, formatQty, formatRupiah, PAYMENT_LABELS } from "@/lib/format";

export function Receipt({ sale, items }: { sale: Sale; items: SaleItem[] }) {
  return (
    <div className="print-area rounded-xl border border-dashed bg-card p-5 font-mono text-xs text-card-foreground">
      <div className="text-center">
        <p className="font-display text-base font-extrabold">TOKO TELUR</p>
        <p className="text-muted-foreground">Struk Penjualan</p>
      </div>
      <div className="my-3 border-t border-dashed" />
      <div className="space-y-0.5">
        <p>No: {sale.invoice_no}</p>
        <p>Tgl: {formatDateTime(sale.created_at)}</p>
        {sale.customer_name && <p>Pelanggan: {sale.customer_name}</p>}
        {sale.cashier_email && <p>Kasir: {sale.cashier_email}</p>}
      </div>
      <div className="my-3 border-t border-dashed" />
      <div className="space-y-2">
        {items.map((i) => (
          <div key={i.id}>
            <p>{i.product_name}</p>
            <div className="flex justify-between text-muted-foreground">
              <span>
                {formatQty(i.quantity)} {i.unit} × {formatRupiah(i.price)}
              </span>
              <span className="text-card-foreground">{formatRupiah(i.subtotal)}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="my-3 border-t border-dashed" />
      <div className="space-y-0.5">
        <div className="flex justify-between text-sm font-bold">
          <span>TOTAL</span>
          <span>{formatRupiah(sale.total)}</span>
        </div>
        <div className="flex justify-between">
          <span>Bayar ({PAYMENT_LABELS[sale.payment_method] ?? sale.payment_method})</span>
          <span>{formatRupiah(sale.paid)}</span>
        </div>
        <div className="flex justify-between">
          <span>Kembali</span>
          <span>{formatRupiah(sale.change)}</span>
        </div>
      </div>
      <div className="my-3 border-t border-dashed" />
      <p className="text-center text-muted-foreground">Terima kasih, semoga berkah!</p>
    </div>
  );
}
