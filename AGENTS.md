<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules

- Checkout and stock changes go through the `create_sale` / `adjust_stock` database functions, never direct table writes — they lock rows and keep stock, sale items and stock history consistent in one transaction.
- Signed-in pages live under `src/routes/_authenticated/` (client-only) and read data with the browser client + React Query options in `src/lib/store-api.ts` — the session lives in localStorage, so SSR cannot fetch it.
- Daily reporting buckets use the shop's timezone inside SQL functions (`sales_daily`, `top_products`, `payment_breakdown`) so totals don't drift with the browser's timezone or the 1000-row API limit.
- Cart math lives in `src/lib/cart.ts` with tests in `src/lib/cart.test.ts` — keep pricing rules there and tested.
