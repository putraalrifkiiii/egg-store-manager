import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Kasir Toko Telur — Penjualan & Stok Telur" },
      { name: "description", content: "Kelola penjualan, stok, produk, dan laporan omzet toko telur Anda." },
      { property: "og:title", content: "Kasir Toko Telur" },
      { property: "og:description", content: "Kelola penjualan, stok, produk, dan laporan omzet toko telur Anda." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    throw redirect({ to: data.session ? "/dashboard" : "/auth" });
  },
  component: () => null,
});
