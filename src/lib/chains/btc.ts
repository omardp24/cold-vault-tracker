import type { Movement } from "./types";

export async function getBtcBalance(address: string) {
  const res = await fetch(`https://mempool.space/api/address/${address}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`mempool.space HTTP ${res.status}`);
  const d = await res.json();
  const sats =
    (d.chain_stats?.funded_txo_sum || 0) -
    (d.chain_stats?.spent_txo_sum || 0) +
    (d.mempool_stats?.funded_txo_sum || 0) -
    (d.mempool_stats?.spent_txo_sum || 0);
  return { native: { symbol: "BTC", amount: sats / 1e8 }, tokens: [] as { symbol: string; amount: number }[] };
}

export async function getBtcHistory(address: string, cursor?: string | null): Promise<import("./types").HistoryPage> {
  const url = cursor
    ? `https://mempool.space/api/address/${address}/txs/chain/${cursor}`
    : `https://mempool.space/api/address/${address}/txs`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`mempool.space HTTP ${res.status}`);
  const txs = await res.json();
  const out: Movement[] = [];
  for (const tx of txs) {
    const vinFromMe = tx.vin.filter((v: any) => v.prevout?.scriptpubkey_address === address);
    const isOutgoing = vinFromMe.length > 0;
    if (isOutgoing) {
      const externalVouts = tx.vout.filter((o: any) => o.scriptpubkey_address !== address);
      const totalExternal = externalVouts.reduce((s: number, o: any) => s + o.value, 0);
      if (totalExternal <= 0) continue;
      externalVouts.sort((a: any, b: any) => b.value - a.value);
      out.push({
        key: `BTC-${tx.txid}`,
        chain: "BTC",
        txid: tx.txid,
        date: tx.status?.block_time ? tx.status.block_time * 1000 : null,
        direction: "out",
        asset: "BTC",
        amount: totalExternal / 1e8,
        counterparty: externalVouts[0]?.scriptpubkey_address || null,
        otherCount: externalVouts.length - 1,
        explorer: `https://mempool.space/tx/${tx.txid}`,
        verified: true,
      });
    } else {
      const incomingVouts = tx.vout.filter((o: any) => o.scriptpubkey_address === address);
      const amount = incomingVouts.reduce((s: number, o: any) => s + o.value, 0) / 1e8;
      const externalVins = tx.vin
        .filter((v: any) => v.prevout?.scriptpubkey_address !== address)
        .sort((a: any, b: any) => (b.prevout?.value || 0) - (a.prevout?.value || 0));
      out.push({
        key: `BTC-${tx.txid}`,
        chain: "BTC",
        txid: tx.txid,
        date: tx.status?.block_time ? tx.status.block_time * 1000 : null,
        direction: "in",
        asset: "BTC",
        amount,
        counterparty: externalVins[0]?.prevout?.scriptpubkey_address || null,
        otherCount: 0,
        explorer: `https://mempool.space/tx/${tx.txid}`,
        verified: true,
      });
    }
  }
  const nextCursor = txs.length > 0 ? txs[txs.length - 1].txid : null;
  // mempool.space entrega hasta 25 confirmadas por página; si trajo menos, no hay más páginas.
  return { movements: out, nextCursor: txs.length >= 25 ? nextCursor : null };
}
