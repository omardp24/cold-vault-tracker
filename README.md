# Cold Vault Tracker

App Next.js para llevar control de tus transacciones en cripto (BTC, ETH, TRON) desde tus direcciones públicas de Ledger — portafolio en vivo + historial de movimientos + clasificación de salidas por aliado y concepto.

## Por qué existe esta versión

La versión anterior era un artifact dentro de claude.ai. Los navegadores bloquean llamadas directas del cliente a APIs externas (CORS) y el sandbox de claude.ai agrega otra capa de restricción encima. Esta versión resuelve eso de raíz: **todas las llamadas a TronGrid, Ethplorer, mempool.space y CoinGecko se hacen desde el servidor** (rutas `/api/*` de Next.js), no desde el navegador. El navegador solo habla con tu propio servidor.

## Arranque rápido

```bash
npm install
cp .env.example .env.local
# edita .env.local y coloca tus claves de Ethplorer y TronGrid
npm run dev
```

Abre http://localhost:3000

## Tus claves de API

- **Ethplorer**: https://ethplorer.io/create-key (gratis, sin tarjeta)
- **TronGrid**: https://www.trongrid.io/ → dashboard → crear API key (gratis)

Van en `.env.local` — nunca se exponen al navegador porque solo las lee el servidor.

## Almacenamiento de datos (Supabase)

Todo el estado de la app — wallets, aliados, planes, usuarios, comprobantes de transferencias — vive en **Supabase**, no en un archivo local. Esto es lo que permite que la app funcione bien tanto en tu máquina como desplegada en Vercel (el filesystem de Vercel es efímero y de solo lectura, así que un archivo JSON local ahí simplemente no funciona).

### Configurar tu proyecto de Supabase (una sola vez)

1. Crea un proyecto en [supabase.com](https://supabase.com) (o usa uno que ya tengas de otro proyecto de CAD).
2. Ve a **SQL Editor** → pega el contenido de `supabase-setup.sql` (en la raíz de este proyecto) → **Run**. Esto crea:
   - La tabla `app_state`, donde vive todo el estado de la app en una sola fila JSON.
   - El bucket privado `cold-vault-attachments`, donde se guardan las capturas/PDFs de comprobantes.
3. Ve a **Project Settings → API** y copia:
   - **Project URL** → va en `SUPABASE_URL`
   - **service_role key** (⚠️ NO la `anon` key — la `service_role` tiene privilegios completos) → va en `SUPABASE_SERVICE_ROLE_KEY`
4. Pon esas dos variables en tu `.env.local` (desarrollo local) y también en **Vercel → tu proyecto → Settings → Environment Variables** (producción) junto con el resto (`ETHPLORER_KEY`, `TRONGRID_KEY`, `TRONSCAN_KEY`).

La `service_role` key nunca se expone al navegador — solo se usa dentro de las rutas `/api/*`, que corren en el servidor.

### Si algo no conecta

Si ves un error de conexión (en vez de quedarse pegado en "Cargando…" — eso ya está resuelto), revisa que esas dos variables estén bien puestas, tanto localmente como en Vercel. El mensaje de error te dice exactamente cuál falta.

## Añadir una red nueva en el futuro

1. Crea `src/lib/chains/<red>.ts` con dos funciones: `get<Red>Balance(address)` y `get<Red>History(address)`, devolviendo los tipos de `src/lib/chains/types.ts`.
2. Regístrala en `src/lib/chains/index.ts` (un objeto `CHAINS`, `balanceFetchers`, `historyFetchers`).
3. Añádela al tipo `Chain` en `src/lib/db.ts` y a `CHAIN_LABEL` en `src/components/ColdVault.tsx`.

Nada más cambia — la agregación de portafolio, precios, movimientos y aliados es genérica.

## Limitaciones conocidas

- **BTC**: no hay forma en la blockchain de saber "para quién es" una transacción — se toma la dirección de destino de mayor valor como contraparte, y se marca si hubo más de un destino externo.
- **TRON**: el historial de movimientos solo cubre transferencias TRC-20 (USDT/USDC) por ahora. El historial de TRX nativo requiere decodificar direcciones en formato hexadecimal (librería `tronweb`), que no está incluida todavía.
- Los valores en USD de movimientos históricos usan el **precio actual**, no el precio del día de la transacción (para eso haría falta un histórico por fecha vía CoinGecko, con límites de tasa más estrictos).
- **Paginación de historial**: BTC y TRON traen la primera página automáticamente y tienen botón "Cargar historial anterior" por wallet para ir más atrás. Ethplorer (ETH) no ofrece paginación por cursor en su API gratuita — trae hasta 100 movimientos recientes.

## Funciones para reportes

- **Exportar CSV**: en la tabla de Movimientos (respeta los filtros activos: fecha, wallet, dirección, aliado, texto), en el panel de detalle de cada aliado (solo sus movimientos), y en Tenencias (foto del portafolio actual). Los CSV llevan BOM UTF-8 y separador `;` para abrir correctamente en Excel en español.
- **Filtro de fecha**: desde/hasta, para sacar el informe de un período exacto.
- **Filtro por wallet**: si tienes varias direcciones, ver/exportar solo una.
- **Resumen de flujo**: entradas, salidas y neto (USD aprox.) del período/filtro visible.
- **Filtro de polvo/spam**: monto mínimo en USD y opción de ocultar tokens sin precio conocido (dust attacks).
- **Detección de transferencias internas**: movimientos entre tus propias wallets no cuentan como pagos a terceros.

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind · Recharts · almacenamiento en archivo JSON

## Cuentas y acceso

La app ahora requiere iniciar sesión. La primera persona que se registra en `/signup` se convierte automáticamente en **propietario** (owner). A partir de ahí:

- Solo el propietario puede generar **códigos de invitación** (pestaña "Usuarios"), válidos 7 días y de un solo uso. Comparte el código o el enlace directo (`/signup?code=XXXX`) por el medio que prefieras — la persona invitada elige su propia contraseña, nunca se la compartes tú.
- El propietario puede quitarle el acceso a cualquiera desde la misma pestaña.
- Las contraseñas se guardan con hash (scrypt, módulo nativo de Node — sin dependencias externas), nunca en texto plano.
- Las sesiones son cookies `httpOnly` con un token aleatorio validado contra `data/db.json`, con 30 días de duración.
- Todas las páginas y rutas de la API están protegidas — sin sesión válida, no se puede leer ni modificar nada, incluidos los comprobantes de transferencias adjuntos.

**Limitación honesta**: no hay límite de intentos de login (rate limiting) ni recuperación de contraseña por correo — para el uso previsto (tú y un puñado de personas de confianza, en tu red local) es razonable, pero si algún día expones esto a internet abierto, eso sí habría que añadirlo antes.
