export interface FeeEstimate {
  chain: "BTC" | "ETH" | "TRON";
  nativeSymbol: string;
  levels: { label: string; fee: number; detail: string }[];
  note: string;
}

export async function estimateBtcFee(): Promise<FeeEstimate> {
  const res = await fetch("https://mempool.space/api/v1/fees/recommended", { cache: "no-store" });
  if (!res.ok) throw new Error(`mempool.space HTTP ${res.status}`);
  const d = await res.json();
  // Tamaño típico de un envío simple (1 entrada, 2 salidas: destino + cambio) en SegWit ~ 140-170 vBytes.
  const TX_VBYTES = 150;
  const levels = [
    { label: "Económica", satPerVb: d.economyFee, detail: "puede tardar horas" },
    { label: "Normal", satPerVb: d.hourFee, detail: "~1 hora" },
    { label: "Rápida", satPerVb: d.halfHourFee, detail: "~30 min" },
    { label: "Prioritaria", satPerVb: d.fastestFee, detail: "próximo bloque" },
  ].map((l) => ({ label: l.label, fee: (l.satPerVb * TX_VBYTES) / 1e8, detail: `${l.satPerVb} sat/vB · ${l.detail}` }));
  return { chain: "BTC", nativeSymbol: "BTC", levels, note: `Estimado para una transacción simple (~${TX_VBYTES} vBytes). El tamaño real varía según cuántos UTXOs use tu wallet.` };
}

export async function estimateEthFee(isToken: boolean): Promise<FeeEstimate> {
  const res = await fetch("https://cloudflare-eth.com", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method: "eth_gasPrice", params: [], id: 1 }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
  const d = await res.json();
  if (!d.result) throw new Error("RPC: respuesta sin gasPrice");
  const gasPriceWei = parseInt(d.result, 16);
  const gasLimit = isToken ? 65000 : 21000; // token ERC-20 vs ETH nativo
  const feeEth = (gasPriceWei * gasLimit) / 1e18;
  const gwei = gasPriceWei / 1e9;
  return {
    chain: "ETH",
    nativeSymbol: "ETH",
    levels: [{ label: "Estimado actual", fee: feeEth, detail: `${gwei.toFixed(1)} gwei · gas limit ${gasLimit.toLocaleString()}` }],
    note: isToken
      ? "Comisión estimada para un envío de token ERC-20 (USDT/USDC/DAI). Se paga en ETH, no en el token — necesitas ETH en la wallet aunque envíes otro activo."
      : "Comisión estimada para un envío de ETH nativo.",
  };
}

export async function estimateTronFee(isToken: boolean): Promise<FeeEstimate> {
  // Precio de energía: intentamos leerlo en vivo; si falla, usamos un valor de referencia reciente.
  let energyPriceSun = 210; // sun por unidad de energía (valor de referencia — fluctúa por gobernanza de la red)
  try {
    const res = await fetch("https://api.trongrid.io/wallet/getenergyprices", {
      headers: process.env.TRONGRID_KEY ? { "TRON-PRO-API-KEY": process.env.TRONGRID_KEY } : {},
      cache: "no-store",
    });
    if (res.ok) {
      const d = await res.json();
      const prices: string = d.prices || "";
      const last = prices.split(",").pop();
      const sun = last?.split(":")[1];
      if (sun) energyPriceSun = parseInt(sun, 10);
    }
  } catch { /* usamos el valor de referencia */ }

  if (isToken) {
    // Un envío de USDT-TRC20 a una dirección ya activada consume ~13,000-15,000 de energía;
    // a una dirección nueva (nunca activada) puede llegar a 65,000+. Mostramos un rango.
    const low = (13000 * energyPriceSun) / 1e6;
    const high = (65000 * energyPriceSun) / 1e6;
    return {
      chain: "TRON",
      nativeSymbol: "TRX",
      levels: [
        { label: "Destino ya activo", fee: low, detail: "~13,000 energía" },
        { label: "Destino nuevo/inactivo", fee: high, detail: "~65,000 energía" },
      ],
      note: "Muy aproximado: si tienes energía delegada o congelada (staking) para TRX, el costo real puede ser 0. Si no, TRON quema TRX automáticamente al precio de energía vigente.",
    };
  }
  return {
    chain: "TRON",
    nativeSymbol: "TRX",
    levels: [
      { label: "Con ancho de banda disponible", fee: 0, detail: "gratis (dentro de tu cuota diaria)" },
      { label: "Sin ancho de banda disponible", fee: 0.3, detail: "~300 bytes quemados a precio de banda" },
    ],
    note: "La mayoría de las cuentas TRON tienen ancho de banda gratuito diario suficiente para envíos simples de TRX.",
  };
}
