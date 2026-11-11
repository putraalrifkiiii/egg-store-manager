import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import "@lovable.dev/cloud-auth-js/styles.css";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EggLogo } from "@/components/app/egg-logo";
import eggShop from "@/assets/egg-shop.jpg";

function safeRedirect(value: unknown): string | undefined {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : undefined;
}

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string | undefined } => ({
    redirect: safeRedirect(search["redirect"]),
  }),
  head: () => ({
    meta: [
      { title: "Masuk — Kasir Toko Telur" },
      { name: "description", content: "Masuk ke aplikasi kasir toko telur untuk mencatat penjualan dan stok." },
      { property: "og:title", content: "Masuk — Kasir Toko Telur" },
      { property: "og:description", content: "Masuk ke aplikasi kasir toko telur untuk mencatat penjualan dan stok." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function GoogleIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z" />
    </svg>
  );
}

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sentConfirm, setSentConfirm] = useState(false);

  const goNext = () => navigate({ to: search.redirect ?? "/dashboard", replace: true });

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error("Gagal masuk", { description: error.message });
      return;
    }
    goNext();
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Kata sandi minimal 6 karakter");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    setLoading(false);
    if (error) {
      toast.error("Gagal mendaftar", { description: error.message });
      return;
    }
    if (data.session) {
      goNext();
      return;
    }
    setSentConfirm(true);
  }

  async function oauth(provider: "google" | "lovable") {
    const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
    if (result.error) {
      toast.error("Gagal masuk", { description: result.error.message });
      return;
    }
    if (result.redirected) return;
    goNext();
  }

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden lg:block">
        <img src={eggShop} alt="Tumpukan tray telur di meja toko" width={1024} height={1280} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-sidebar via-sidebar/40 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-12 text-sidebar-foreground">
          <p className="font-display text-5xl font-extrabold leading-[1.05]">
            Setiap butir
            <br />
            <span className="text-sidebar-primary">tercatat rapi.</span>
          </p>
          <p className="mt-4 max-w-md text-sidebar-foreground/80">
            Kasir, stok, dan laporan omzet toko telur dalam satu tempat.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3">
            <EggLogo className="h-11 w-9" />
            <div>
              <h1 className="text-2xl font-extrabold leading-none">Toko Telur</h1>
              <p className="text-sm text-muted-foreground">Aplikasi kasir</p>
            </div>
          </div>

          {sentConfirm ? (
            <div className="rounded-xl border bg-card p-6 shadow-soft">
              <h2 className="text-lg font-bold">Cek email Anda</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Kami mengirim tautan konfirmasi ke <strong className="text-foreground">{email}</strong>. Klik tautan itu,
                lalu masuk kembali di sini.
              </p>
              <Button variant="outline" className="mt-4 w-full" onClick={() => setSentConfirm(false)}>
                Kembali
              </Button>
            </div>
          ) : (
            <Tabs defaultValue="masuk">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="masuk">Masuk</TabsTrigger>
                <TabsTrigger value="daftar">Daftar</TabsTrigger>
              </TabsList>
              {(["masuk", "daftar"] as const).map((mode) => (
                <TabsContent key={mode} value={mode}>
                  <form onSubmit={mode === "masuk" ? signIn : signUp} className="mt-4 space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor={`${mode}-email`}>Email</Label>
                      <Input id={`${mode}-email`} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="kasir@tokotelur.id" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`${mode}-password`}>Kata sandi</Label>
                      <Input
                        id={`${mode}-password`}
                        type="password"
                        required
                        autoComplete={mode === "masuk" ? "current-password" : "new-password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>
                    <Button type="submit" size="lg" className="w-full" disabled={loading}>
                      {loading ? "Memproses…" : mode === "masuk" ? "Masuk" : "Buat akun"}
                    </Button>
                  </form>
                </TabsContent>
              ))}

              <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                atau
                <span className="h-px flex-1 bg-border" />
              </div>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => oauth("google")}
                  className="google-btn inline-flex h-10 w-full items-center justify-center gap-2.5 rounded-md px-3 text-sm font-medium"
                >
                  <GoogleIcon />
                  Lanjutkan dengan Google
                </button>
                <button type="button" className="lovable-auth-button w-full" onClick={() => oauth("lovable")}>
                  Continue with Lovable
                </button>
              </div>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
}
