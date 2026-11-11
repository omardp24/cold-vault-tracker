# Routes — Cold Vault Tracker (Next.js App Router, file-based)
| URL | File | Layout | Renders |
|---|---|---|---|
| `/` | `src/app/(app)/page.tsx` | `src/app/layout.tsx` | `<ColdVault />` — the whole authenticated app. Tabs (client state, not routes): **Portafolio** (`coldvault/PortfolioView.tsx`), **Movimientos** (`coldvault/MovementsView.tsx`), **Auditoría** (`coldvault/AuditTab.tsx`), **Usuarios** (owner only, `coldvault/UsersTab.tsx`) |
| `/login` | `src/app/login/page.tsx` | root + `AuthShell` | Login form on animated background |
| `/signup` | `src/app/signup/page.tsx` | root + `AuthShell` | Sign-up form |
| `/api/**` | `src/app/api/**` | — | JSON API (auth, wallets, movements, crons) |

## Portafolio tab (main screen)
Total portfolio USD value (animated counter) with delta vs last daily snapshot and VES equivalents (BCV / paralelo); wallet counts per chain; refresh button + auto-refresh 60s + last read time; incomplete-total warning. Evolution area chart (7D/90D/Año). Tracked addresses list (expandable rows: chain badge, label, short address, USD, per-asset chips, share bar; expand → full address, copy, explorer link, 90d mini chart; rename/remove) with add-wallet form (chain, label, public address) and manual asset form (CoinGecko id, symbol, qty). Allocation donut + legend. Holdings table (asset, qty, price, value, allocation %) with CSV export; cards on mobile. Network fees card (BTC sat/vB, ETH gwei, TRON TRX) on mobile; in sidebar on desktop.
