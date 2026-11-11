# Layouts — Cold Vault Tracker
Single-page app shell rendered by `src/components/ColdVault.tsx` (render section lines 907-1157). Tabs are client state, not routes.
- Desktop (md+): left sidebar 232px (logo tile with orange→amber gradient + shield SVG, "Cold Vault / Portafolio en vivo", nav items Portafolio/Movimientos/Auditoría/Usuarios with pending badge, "Red ahora" gas-fee card pinned at bottom) + sticky top bar (GlobalSearch, PushBell, theme toggle, "Actualizar" button, user chip, logout).
- Mobile: compact top bar (logo tile, "Cold Vault", bell, theme toggle, logout) + fixed bottom tab bar `.cv-tabbar` with the same nav items. Floating AI assistant button (AssistantPanel) bottom-right.
- Footer note: "Solo direcciones públicas — esta app nunca pide ni almacena claves privadas o tu frase semilla."

### `src/components/ColdVault.tsx`

```tsx
  const { theme, toggleTheme } = useTheme();

  type TabId = "portfolio" | "movements" | "audit" | "users";
  const NAV_ITEMS: { id: TabId; label: string; Icon: any; badge?: number }[] = [
    { id: "portfolio", label: "Portafolio", Icon: WalletIcon },
    { id: "movements", label: "Movimientos", Icon: ArrowLeftRight, badge: pendingCount || undefined },
    { id: "audit", label: "Auditoría", Icon: ShieldCheck },
    ...(currentUser?.role === "owner" ? [{ id: "users" as const, label: "Usuarios", Icon: Users }] : []),
  ];
  const SidebarNavBtn = ({ id, label, Icon, badge }: { id: TabId; label: string; Icon: any; badge?: number }) => {
    const active = tab === id;
    return (
      <button
        onClick={() => setTab(id)}
        data-active={active}
        className="cv-nav-item flex items-center gap-2.5 w-full text-left rounded-2xl px-3.5 py-2.5 text-[13.5px]"
        style={{ background: active ? "var(--tint)" : "transparent", color: active ? "var(--accent)" : "var(--dim)", fontWeight: active ? 600 : 500, border: "none", cursor: "pointer" }}
      >
        <Icon size={18} strokeWidth={2} />
        <span className="flex-1">{label}</span>
        {!!badge && (
          <span className="text-[10.5px] font-bold rounded-full px-2 py-0.5" style={{ background: "var(--accent)", color: "#fff" }}>{badge}</span>
        )}
      </button>
    );
  };
  const ThemeToggleBtn = ({ size = 34 }: { size?: number }) => (
    <button
      onClick={toggleTheme}
      className="cv-icon-btn justify-center rounded-full flex-shrink-0"
      style={{ width: size, height: size, background: "var(--panel2)", border: "1px solid var(--line)", color: "var(--dim)" }}
      title={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
    >
      {theme === "dark" ? <Moon size={15} /> : <Sun size={15} />}
    </button>
  );

  return (
    <>
    <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
      {/* Sidebar — solo escritorio */}
      <aside
        className="cv-sidebar hidden md:flex flex-col gap-1.5 flex-shrink-0 sticky top-0 h-screen overflow-y-auto"
        style={{ width: 232, padding: "22px 16px" }}
      >
        <div className="flex items-center gap-2.5 px-2 pb-6">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(140deg, var(--accent), var(--amber))", boxShadow: "var(--glow)" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--panel)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2 4 6v6c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V6l-8-4Z" />
              <circle cx="12" cy="11" r="2.2" />
              <path d="M12 13.2V15.6" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="text-[15.5px] font-bold tracking-tight" style={{ color: "var(--ink)" }}>Cold Vault</div>
            <div className="text-[11px]" style={{ color: "var(--faint)" }}>Portafolio en vivo</div>
          </div>
        </div>

        {NAV_ITEMS.map((item) => <SidebarNavBtn key={item.id} {...item} />)}

        <div className="mt-auto rounded-2xl p-3.5 text-[11px]" style={{ background: "var(--panel2)" }}>
          <div className="flex items-center gap-1.5 mb-2">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${(gasNow.btc?.stale || gasNow.eth?.stale || gasNow.tron?.stale) ? "" : "cv-live"}`} style={{ background: (gasNow.btc?.stale || gasNow.eth?.stale || gasNow.tron?.stale) ? "var(--amber)" : "var(--pos)" }} />
            <span className="uppercase tracking-wide font-semibold text-[10px]" style={{ color: "var(--dim)" }}>Red ahora</span>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between" style={{ color: "var(--dim)" }}>
              <span>BTC{gasNow.btc?.stale && <span title="Desactualizado — la API está caída" style={{ color: "var(--amber)" }}> ⚠</span>}</span>
              <span className="font-mono" style={{ color: "var(--ink)" }}>{gasNow.btc?.levels ? `${gasNow.btc.levels[1]?.detail?.split(" ")[0] || "—"} sat/vB` : "—"}</span>
            </div>
            <div className="flex items-center justify-between" style={{ color: "var(--dim)" }}>
              <span>ETH{gasNow.eth?.stale && <span title="Desactualizado — la API está caída" style={{ color: "var(--amber)" }}> ⚠</span>}</span>
              <span className="font-mono" style={{ color: "var(--ink)" }}>{gasNow.eth?.levels ? `${gasNow.eth.levels[0]?.detail?.split(" ")[0] || "—"} gwei` : "—"}</span>
            </div>
            <div className="flex items-center justify-between" style={{ color: "var(--dim)" }}>
              <span>TRON{gasNow.tron?.stale && <span title="Desactualizado — la API está caída" style={{ color: "var(--amber)" }}> ⚠</span>}</span>
              <span className="font-mono" style={{ color: "var(--ink)" }}>{gasNow.tron?.levels ? `${fmtAmt(gasNow.tron.levels[1]?.fee, 2)} TRX` : "—"}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Columna principal */}
      <div className="flex-1 min-w-0">
        {/* Top bar — escritorio */}
        <div
          className="hidden md:flex items-center gap-3 px-6 py-3.5 border-b cv-safe-top sticky top-0 z-10"
          style={{ borderColor: "var(--line)", background: "var(--panel)" }}
        >
          <GlobalSearch
            wallets={wallets} aliados={aliados} movements={movements}
            onSelectWallet={() => setTab("portfolio")}
            onSelectAliado={(a) => { setTab("movements"); setSelectedAliadoId(a.id); }}
            onSelectMovement={(m) => { setTab("movements"); setSearchText(m.counterparty || m.txid); }}
          />
          <div className="ml-auto flex items-center gap-2.5 flex-shrink-0">
            <PushBell />
            <ThemeToggleBtn />
            <button className="cv-btn" onClick={fetchAll} disabled={refreshing}>
              {refreshing ? "Actualizando…" : "Actualizar"}
            </button>
            {currentUser && (
              <div className="flex items-center gap-2.5 pl-2.5 pr-3.5 py-1.5 rounded-full" style={{ background: "var(--panel2)" }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0" style={{ background: "var(--tint)", color: "var(--accent)" }}>
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
                <div className="leading-tight">
                  <div className="text-[12px] font-medium" style={{ color: "var(--ink)" }}>{currentUser.name}</div>
                  <div className="text-[10px] uppercase tracking-wide" style={{ color: "var(--faint)" }}>{currentUser.role === "owner" ? "propietario" : "miembro"}</div>
                </div>
              </div>
            )}
            <button className="cv-x" onClick={logout} title="Cerrar sesión">
              <LogOut size={16} />
            </button>
          </div>
        </div>

        {/* Top bar — móvil */}
        <div
          className="md:hidden flex items-center gap-2.5 px-4 py-3 border-b cv-safe-top"
          style={{ borderColor: "var(--line)", background: "var(--panel)" }}
        >
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(140deg, var(--accent), var(--amber))" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--panel)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2 4 6v6c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V6l-8-4Z" />
            </svg>
          </div>
          <div className="font-bold text-[14.5px]" style={{ color: "var(--ink)" }}>Cold Vault</div>
          <div className="ml-auto flex items-center gap-2 flex-shrink-0">
            <PushBell size={30} />
            <ThemeToggleBtn size={30} />
            <button className="cv-x" onClick={logout} title="Cerrar sesión">
              <LogOut size={16} />
            </button>
          </div>
        </div>

        <div className="px-3 py-4 sm:px-6 sm:py-6" style={{ color: "var(--ink)" }}>
        {saveError && (
          <div className="mb-3 rounded-lg px-3.5 py-2.5 text-[12.5px] flex items-start justify-between gap-3" style={{ background: "rgba(178,58,58,.14)", color: "var(--neg)", border: "1px solid var(--neg)" }}>
            <span>{saveError}</span>
            <button className="cv-x flex-shrink-0" onClick={() => setSaveError("")}>✕</button>
          </div>
        )}
        <div key={tab} className="cv-tab-in">
        {tab === "portfolio" && (
          <PortfolioView
            total={total} wallets={wallets} fetchAll={fetchAll} refreshing={refreshing}
            autoRefresh={autoRefresh} setAutoRefresh={setAutoRefresh} lastUpdated={lastUpdated}
            incompleteWallets={incompleteWallets} errMsg={errMsg}
            chain={chain} setChain={setChain} labelInput={labelInput} setLabelInput={setLabelInput}
            addrInput={addrInput} setAddrInput={setAddrInput} addWallet={addWallet} addWalletError={addWalletError}
            balances={balances} removeWallet={removeWallet} renameWallet={renameWallet}
            manual={manual} manualCoinId={manualCoinId} setManualCoinId={setManualCoinId}
            manualSymbol={manualSymbol} setManualSymbol={setManualSymbol} manualQty={manualQty} setManualQty={setManualQty}
            addManual={addManual} removeManual={removeManual}
            pieData={pieData} holdings={holdings} colorForSymbol={colorForSymbol}
            loadGasFees={loadGasFees} gasLoading={gasLoading} gasNow={gasNow}
            walletUsd={walletUsd} history={history} historyLoading={historyLoading} historyRange={historyRange} setHistoryRange={setHistoryRange}
            vesRates={vesRates}
          />
        )}


        {tab === "movements" && (
          <MovementsView
            wallets={wallets} movements={movements} aliados={aliados}
            movLoading={movLoading} movErr={movErr} loadMovements={loadMovements}
            cursors={cursors} loadingMoreId={loadingMoreId} loadMoreForWallet={loadMoreForWallet}
            isPoisoningSuspect={isPoisoningSuspect} suspicionFor={suspicionFor} quickAuditFor={quickAuditFor}
            runDiagnostics={runDiagnostics} diagRunning={diagRunning} diag={diag}
            walletSummary={walletSummary} walletFilter={walletFilter} setWalletFilter={setWalletFilter}
            newAliadoName={newAliadoName} setNewAliadoName={setNewAliadoName} addAliado={addAliado}
            selectedAliadoId={selectedAliadoId} setSelectedAliadoId={setSelectedAliadoId} selectedAliado={selectedAliado}
            deleteAliado={deleteAliado} selectedAliadoTotals={selectedAliadoTotals}
            detailChain={detailChain} setDetailChain={setDetailChain} detailAddr={detailAddr} setDetailAddr={setDetailAddr}
            addAddressToAliado={addAddressToAliado} removeAddressFromAliado={removeAddressFromAliado}
            selectedAliadoMovements={selectedAliadoMovements} exportAliado={exportAliado} effectiveConcepto={effectiveConcepto}
            usdFor={safePrice}
            summaryRows={summaryRows} summaryRowsIn={summaryRowsIn} nameFor={nameFor}
            internalTotal={internalTotal} feeTotal={feeTotal}
            searchText={searchText} setSearchText={setSearchText} activeFilterCount={activeFilterCount}
            showFilterSheet={showFilterSheet} setShowFilterSheet={setShowFilterSheet}
            showExportSheet={showExportSheet} setShowExportSheet={setShowExportSheet}
            dirFilter={dirFilter} setDirFilter={setDirFilter} estadoFilter={estadoFilter} setEstadoFilter={setEstadoFilter}
            dateFrom={dateFrom} setDateFrom={setDateFrom} dateTo={dateTo} setDateTo={setDateTo}
            minUsd={minUsd} setMinUsd={setMinUsd} hideUnpriced={hideUnpriced} setHideUnpriced={setHideUnpriced}
            dustHiddenCount={dustHiddenCount} suspiciousCount={suspiciousCount} showSuspicious={showSuspicious} setShowSuspicious={setShowSuspicious}
            exportFiltered={exportFiltered} generateStatement={generateStatement} statementGenerating={statementGenerating}
            flowSummary={flowSummary} visibleMovements={visibleMovements} filteredMovements={filteredMovements} pendingCount={pendingCount}
            showGroupClassifier={showGroupClassifier} setShowGroupClassifier={setShowGroupClassifier}
            groupViewMode={groupViewMode} setGroupViewMode={setGroupViewMode}
            feeThreshold={feeThreshold} setFeeThreshold={setFeeThreshold}
            markSmallGroupsAsFee={markSmallGroupsAsFee} markingFees={markingFees}
            pendingGroups={pendingGroups} groupExistingAliado={groupExistingAliado} groupBatchState={groupBatchState}
            toggleGroupExpand={toggleGroupExpand} expandedGroups={expandedGroups}
            groupWalletCount={groupWalletCount} groupWalletLabels={groupWalletLabels}
            setGroupField={setGroupField} applyGroupClassification={applyGroupClassification}
            effectiveAliadoId={effectiveAliadoId} effectiveIsFee={effectiveIsFee} isInternalTransfer={isInternalTransfer}
            isPending={isPending} findOwnWallet={findOwnWallet} saveClassification={saveClassification}
            handleAliadoSelect={handleAliadoSelect}
          />
        )}


        {tab === "audit" && <AuditTab />}

        {tab === "users" && currentUser?.role === "owner" && <UsersTab currentUser={currentUser} />}
        </div>

        <div className="text-[11px] mt-4 text-center cv-safe-bottom md:pb-6" style={{ color: "var(--faint)" }}>
          Solo direcciones públicas — esta app nunca pide ni almacena claves privadas o tu frase semilla.
        </div>
        </div>
      </div>
    </div>

    <AssistantPanel onClassificationsApplied={(applied) => setClassifications((c) => {
      const next = { ...c };
      applied.forEach((a) => { next[a.key] = { aliadoId: a.aliadoId, concepto: a.concepto, isFee: a.isFee }; });
      return next;
    })} />

    {aliadoPromptModal}
    {confirmModalEl}

    {/* Barra de navegación inferior — solo móvil */}
    <nav className="cv-tabbar md:hidden">
      {NAV_ITEMS.map(({ id, label, Icon }) => (
        <button
          key={id}
          className="cv-tabbar-item"
          data-active={tab === id}
          onClick={() => { setTab(id); window.scrollTo({ top: 0, behavior: "smooth" }); }}
        >
          <Icon size={19} strokeWidth={tab === id ? 2.4 : 1.9} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
    </>
  );
}

```

### `src/app/layout.tsx`

```tsx
import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Sora } from "next/font/google";
import "./globals.css";

const sora = Sora({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-sora" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-mono" });

export const metadata: Metadata = {
  title: "Cold Vault",
  description: "Portafolio y movimientos en vivo desde tu Ledger",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Cold Vault",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover", // permite usar las safe-area del iPhone
  themeColor: "#071A20",
};

// Aplica el tema guardado ANTES del primer paint — si esto corriera en un useEffect
// normal, se vería un flash del tema equivocado (siempre oscuro) en cada carga para
// quien eligió modo claro.
const THEME_INIT_SCRIPT = `
try {
  var t = localStorage.getItem("cv-theme");
  if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
} catch (e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${sora.variable} ${plexMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

```

### `src/components/AuthShell.tsx`

```tsx
"use client";

import { useState, type ReactNode } from "react";
import { Eye, EyeOff, Lock, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import { ChainBadge } from "./coldvault/shared";

// Carcasa compartida de login y registro: fondo animado (orbes + rejilla), panel de marca con las
// ventajas de la app y, a la derecha, el formulario que cada página le pasa como hijo.

function Logo({ size = 44 }: { size?: number }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <span className="cv-logo-ring" />
      <div className="relative w-full h-full rounded-2xl flex items-center justify-center" style={{ background: "linear-gradient(140deg, var(--accent), var(--amber))", boxShadow: "var(--glow)" }}>
        <svg width={size * 0.46} height={size * 0.46} viewBox="0 0 24 24" fill="none" stroke="var(--panel)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2 4 6v6c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V6l-8-4Z" />
          <circle cx="12" cy="11" r="2.2" />
          <path d="M12 13.2V15.6" />
        </svg>
      </div>
    </div>
  );
}

const FEATURES = [
  { Icon: Wallet, title: "Saldos en vivo", text: "Bitcoin, Ethereum y Tron leídos desde tus direcciones públicas." },
  { Icon: ShieldCheck, title: "Auditoría de direcciones", text: "Sanciones OFAC, listas de fraude y direcciones que imitan a las tuyas." },
  { Icon: Sparkles, title: "Asistente con IA", text: "Clasifica movimientos, resume la semana y prepara estados de cuenta." },
  { Icon: Lock, title: "Solo lectura", text: "Nunca pide ni guarda claves privadas ni frases semilla." },
];

export default function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="cv-auth min-h-screen flex items-center justify-center px-4 py-8 cv-safe-top" style={{ background: "var(--bg)" }}>
      <div className="cv-auth-grid" />
      <span className="cv-orb cv-orb-1" /><span className="cv-orb cv-orb-2" /><span className="cv-orb cv-orb-3" />

      <div className="relative z-10 w-full max-w-4xl">
        {/* Marca compacta: solo en móvil, donde el panel lateral no cabe */}
        <div className="md:hidden flex flex-col items-center text-center mb-6 cv-tab-in">
          <Logo size={52} />
          <div className="font-display text-xl font-bold mt-3" style={{ color: "var(--ink)" }}>Cold Vault</div>
          <div className="text-[12px] mt-1" style={{ color: "var(--dim)" }}>Todo tu frío, en un solo tablero.</div>
        </div>

        <div className="cv-auth-card grid grid-cols-1 md:grid-cols-[1.05fr_1fr] rounded-3xl overflow-hidden cv-tab-in" style={{ boxShadow: "0 24px 70px rgba(0,0,0,0.4)", border: "1px solid var(--line)" }}>
          <div className="hidden md:flex flex-col justify-between gap-9 p-10 md:min-h-[560px]" style={{ background: "color-mix(in srgb, var(--panel2) 88%, transparent)" }}>
            <Logo />
            <div className="cv-stagger">
              <div className="font-display text-[28px] font-extrabold leading-[1.15]" style={{ color: "var(--ink)" }}>
                Todo tu frío,<br /><span className="cv-shine">en un solo tablero.</span>
              </div>
              <ul className="mt-6 space-y-3.5">
                {FEATURES.map(({ Icon, title, text }) => (
                  <li key={title} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "var(--tint)", color: "var(--accent)" }}><Icon size={16} strokeWidth={2.2} /></span>
                    <span>
                      <span className="block text-[13px] font-semibold" style={{ color: "var(--ink)" }}>{title}</span>
                      <span className="block text-[12px] leading-snug" style={{ color: "var(--dim)" }}>{text}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-[11px]" style={{ color: "var(--faint)" }}>Cold Vault · CAD Venezuela</div>
              <div className="flex -space-x-1.5">
                {(["BTC", "ETH", "TRON"] as const).map((c, i) => (
                  <span key={c} className="cv-bob rounded-full" style={{ animationDelay: `${i * 0.5}s`, border: "2px solid var(--panel2)" }}><ChainBadge chain={c} size={24} /></span>
                ))}
              </div>
            </div>
          </div>

          <div className="p-7 sm:p-10" style={{ background: "color-mix(in srgb, var(--panel) 92%, transparent)" }}>{children}</div>
        </div>
      </div>
    </div>
  );
}

/** Campo de contraseña con botón para mostrar/ocultar (útil en el teléfono, donde es fácil equivocarse al teclear). */
export function PasswordInput({ value, onChange, minLength, autoComplete }: { value: string; onChange: (v: string) => void; minLength?: number; autoComplete?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"} required minLength={minLength} autoComplete={autoComplete}
        className="cv-input w-full" style={{ paddingRight: 44 }} value={value} onChange={(e) => onChange(e.target.value)}
      />
      <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"} className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full" style={{ background: "none", border: "none", color: "var(--faint)", cursor: "pointer" }}>
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

```
