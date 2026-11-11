import { Link, Outlet, useNavigate, useRouteContext } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  BarChart3,
  Boxes,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  ReceiptText,
  ShoppingBasket,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { EggLogo } from "./egg-logo";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/kasir", label: "Kasir", icon: ShoppingBasket },
  { to: "/produk", label: "Produk", icon: Package },
  { to: "/stok", label: "Stok Barang", icon: Boxes },
  { to: "/transaksi", label: "Transaksi", icon: ReceiptText },
  { to: "/laporan", label: "Laporan", icon: BarChart3 },
] as const;

function NavLinks({ onNavigate }: { onNavigate?: (() => void) | undefined }) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ to, label, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          activeProps={{
            className: "!bg-sidebar-primary !text-sidebar-primary-foreground shadow-yolk",
          }}
        >
          <Icon className="h-[18px] w-[18px]" />
          {label}
        </Link>
      ))}
    </nav>
  );
}

function SidebarBody({ onNavigate }: { onNavigate?: (() => void) | undefined }) {
  const { user } = useRouteContext({ from: "/_authenticated" });
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex h-full flex-col bg-sidebar p-4 text-sidebar-foreground">
      <div className="mb-8 flex items-center gap-3 px-2 pt-2">
        <EggLogo className="h-10 w-8" />
        <div>
          <p className="font-display text-lg font-extrabold leading-none">Toko Telur</p>
          <p className="text-xs text-sidebar-foreground/60">Kasir & Stok</p>
        </div>
      </div>
      <NavLinks onNavigate={onNavigate} />
      <div className="mt-auto rounded-xl border border-sidebar-border p-3">
        <p className="text-xs text-sidebar-foreground/60">Masuk sebagai</p>
        <p className="truncate text-sm font-medium">{user.email}</p>
        <button
          onClick={signOut}
          className="mt-3 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <LogOut className="h-4 w-4" /> Keluar
        </button>
      </div>
    </div>
  );
}

export function AppShell() {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
        <SidebarBody />
      </aside>

      <header className="sticky top-0 z-20 flex items-center gap-3 border-b bg-background/90 px-4 py-3 backdrop-blur lg:hidden">
        <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="Buka menu">
          <Menu className="h-5 w-5" />
        </Button>
        <EggLogo className="h-7 w-6" />
        <span className="font-display font-extrabold">Toko Telur</span>
      </header>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 border-none p-0">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SidebarBody onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <main className="lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
