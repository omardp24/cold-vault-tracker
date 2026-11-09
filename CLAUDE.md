# CLAUDE.md — Cold Vault Tracker

Contexto para cualquier sesión nueva de Claude Code. El dueño (Omar) habla español: responde siempre en español.

## Qué es
Herramienta personal de **Comercializadora Agrícola Domínguez, C.A. (CAD Venezuela)** para seguir sus wallets de
Bitcoin, Ethereum y Tron (direcciones públicas de Ledger: **solo lectura**, nunca claves privadas), clasificar movimientos
por aliado/concepto, auditar contrapartes, y generar estados de cuenta. Producción: https://cold-vault-tracker.vercel.app
Repo: https://github.com/omardp24/cold-vault-tracker (público, rama `main`; Vercel despliega solo al hacer push).

**Carpeta local del proyecto: `/Users/omardominguez/Downloads/cold-vault-tracker 31`** (con espacio y el "31" en el
nombre — entre comillas en la terminal). Abre la sesión nueva EN esa carpeta. No confundir con `~/Desktop/Recordatorio`
(otro proyecto, NestJS; solo es el directorio de arranque de algunas sesiones).

## Stack
Next.js 14.2 (App Router) + TypeScript + Tailwind · Supabase (Postgres) · Vercel · `@react-pdf/renderer` (PDF) · exceljs ·
nodemailer (Gmail SMTP) · web-push (VAPID) · Gemini vía `@google/genai` · recharts · lucide-react.

Comandos: `npm run dev -- -p 3010` · `npx tsc --noEmit` (antes: `rm -rf .next` si se borraron rutas) · `npm run build`.

## Mapa de archivos
- `src/components/ColdVault.tsx` — componente raíz: estado global, fetch de saldos/movimientos/precios, barra lateral
  (escritorio), barra inferior (móvil), pestañas Portafolio / Movimientos / Auditoría / Usuarios (solo propietario).
- `src/components/coldvault/`: `PortfolioView.tsx` (pantalla principal), `MovementsView.tsx` (la más grande, ~1100 líneas),
  `AuditTab.tsx`, `UsersTab.tsx` (+ tarjeta "Estado del sistema"), `AssistantPanel.tsx` (chat IA flotante),
  `TransactionDetailModal.tsx` (resumen tipo Ledger), `EvolutionChart.tsx`, `GlobalSearch.tsx`, `PushBell.tsx`,
  `ConceptoInput.tsx`, `shared.tsx` (tipos, ChainBadge/AssetIcon, ValueCounter, PromptModal/ConfirmModal, formatters).
- `src/components/AuthShell.tsx` — carcasa de login/registro (fondo animado). Páginas: `src/app/login`, `src/app/signup`.
- `src/app/globals.css` — TODO el sistema visual: variables de tema (`--bg --panel --panel2 --line --ink --dim --faint
  --accent --pos --neg ...`), modo claro/oscuro con `[data-theme]`, clases `.cv-*` (card, btn, input, stagger, skeleton…).
- `src/app/layout.tsx` — fuentes Sora (texto/títulos) e IBM Plex Mono (cifras), metadata PWA de iOS.
- `src/app/api/**` — rutas. Protegidas con `requireAuth()` (`src/lib/auth.ts`, sesión por cookie `cvt_session`).
  Crons con `Authorization: Bearer $CRON_SECRET`: `api/cron/daily-sync`, `watch-movements`, `weekly-report`.
- `src/lib/` — lógica de servidor y pura: `db.ts` (estado en UNA fila jsonb de `app_state`, `readDb`/`updateDb` con
  concurrencia optimista), `chains/` (btc/eth/tron), `portfolioValue.ts`, `movementWatch.ts` (avisos push de movimientos
  nuevos), `dailySync.ts`, `weeklyReport*.ts`, `monthlyReport.ts`, `statement*.ts(x)` (PDF/Excel), `assistant.ts` +
  `autoClassify.ts` (IA con acciones que el usuario confirma), `suspicious.ts` (polvo/fraude por reglas fijas),
  `addressRisk.ts`, `narrative.ts`, `mailer.ts`, `push.ts`, `veDates.ts` (hora de Caracas), `format.ts`.
- `public/sw.js` — service worker mínimo solo para push. `supabase-setup.sql` — tablas. `docs/vigilancia-supabase.sql`.
- `.github/workflows/` — `watch-movements.yml` (cada 5 min, en la práctica ~5 veces/día) y `weekly-report.yml` (viernes).
- `vercel.json` — un solo cron diario (`/api/cron/daily-sync`, 12:00 UTC = 8 a. m. Caracas; Vercel Hobby no permite más).

## Convenciones
- Hora de Venezuela (UTC-4, sin DST) para todo lo que se muestra o se reporta: `APP_TZ` en `src/lib/format.ts`.
- Claves de movimientos estables: `${chain}-${txid}-${occ}` (BTC: `BTC-${txid}`).
- Móvil primero en lo visual: hay barra inferior, hojas modales (`.cv-sheet`) y bloques que se pliegan en teléfono.
- Estilos con `style={{ ... var(--token) }}` + clases Tailwind + clases `.cv-*`. Usa SIEMPRE las variables de tema, para
  que modo claro y oscuro funcionen. Respeta `prefers-reduced-motion`.
- Marca CAD: azul petróleo `#012D37`, naranja `#F77B1C`, ámbar `#F8B345`, verde `#008747`.
- No usar `window.alert/confirm/prompt`: están `PromptModal` y `ConfirmModal` en `shared.tsx`.
- La IA nunca guarda datos sola: prepara tarjetas que el usuario confirma. Texto que viene de la blockchain = dato no confiable.

## Variables de entorno (solo nombres; los valores están en `.env.local` y en Vercel — nunca los pegues en el chat ni en el repo)
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `TRONGRID_KEY`, `TRONSCAN_KEY` (opcional), `ETHPLORER_KEY`,
`GEMINI_API_KEY`, `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT`/`NEXT_PUBLIC_VAPID_PUBLIC_KEY`,
`GMAIL_SMTP_USER`/`GMAIL_SMTP_APP_PASSWORD`, `WEEKLY_REPORT_TO` (opcional). Las `NEXT_PUBLIC_*` se fijan al compilar.

## Estado actual y pendientes
- **En curso: rediseño visual completo.** El usuario quiere un rediseño REAL (estructura y presentación), no solo pulido:
  ya se hicieron animaciones, login nuevo y detalles en Portafolio (commits af51c53, 58e5b3b), pero las pantallas siguen
  con la misma estructura. Propuesta a medias para Portafolio: portada con total + gráfica juntos, 4 indicadores
  (wallets, % stablecoins, mayor concentración, estado de lectura), wallets como tarjetas en cuadrícula, Asignación +
  Tenencias lado a lado. Después: Movimientos, Auditoría, Usuarios, barra lateral. Se quiere usar el plugin **Superdesign**
  (`/superdesign:superdesign`) para explorar opciones de diseño.
- Pendiente del usuario: cargar `GMAIL_SMTP_USER` y `GMAIL_SMTP_APP_PASSWORD` en Vercel (el reporte semanal falló 4 viernes
  por esto y el mensual probablemente también) + Redeploy. La tarjeta Usuarios → "Estado del sistema" lo confirma.
- Pendiente del usuario: ejecutar `docs/vigilancia-supabase.sql` en Supabase para avisos de movimientos cada 5 min reales.
- Los totales en USD de movimientos usan el precio ACTUAL, no el del día de la operación (se avisa en los reportes).

## Trampas conocidas
- Scripts con `npx tsx` NO pueden importar `statementPdf.tsx` ni `monthlyReport.ts` (error de `@react-pdf/hyphenate`);
  funciona dentro de Next. Para scripts: `globalThis.WebSocket ??= class {}` antes de importar `supabase`.
- Para ver la UI sin sesión se usa una página temporal `src/app/preview/page.tsx` que sustituye `window.fetch` con datos
  falsos y monta `<ColdVault />`. **Nunca se commitea**: bórrala antes de `git add`. La app real exige login.
- No fabricar sesiones ni saltarse el login para probar (el entorno lo bloquea y es una mala práctica).
- El servidor de vista previa de la app de escritorio a veces no arranca: usar `npm run dev -- -p 3010` y abrir ese puerto.
- Capturas tomadas justo tras cargar salen a medio animar: espera ~1 s antes de la captura.
- Commits: terminan con la línea `Co-Authored-By` que indique el sistema; mensajes en español.
