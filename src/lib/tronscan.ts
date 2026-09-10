function headers(): Record<string, string> {
  const key = process.env.TRONSCAN_KEY;
  return key ? { "TRON-PRO-API-KEY": key } : {};
}

export async function checkStablecoinBlacklist(address: string): Promise<{ blacklisted: boolean; tokens: string[] }> {
  try {
    const res = await fetch(`https://apilist.tronscanapi.com/api/stableCoin/blackList?blackAddress=${address}`, { cache: "no-store" });
    if (!res.ok) return { blacklisted: false, tokens: [] };
    const d = await res.json();
    const tokens = (d.data || []).map((x: any) => x.tokenName).filter(Boolean);
    return { blacklisted: tokens.length > 0, tokens: Array.from(new Set(tokens)) };
  } catch {
    return { blacklisted: false, tokens: [] };
  }
}

export interface AccountSecurity {
  checked: boolean;
  hasFraudTransaction?: boolean;
  fraudTokenCreator?: boolean;
  sendAdByMemo?: boolean;
  isBlackList?: boolean;
}

export async function checkAccountSecurity(address: string): Promise<AccountSecurity> {
  if (!process.env.TRONSCAN_KEY) return { checked: false };
  try {
    const res = await fetch(`https://apilist.tronscanapi.com/api/security/account/data?address=${address}`, { headers: headers(), cache: "no-store" });
    if (!res.ok) return { checked: false };
    const d = await res.json();
    return {
      checked: true,
      hasFraudTransaction: !!d.has_fraud_transaction,
      fraudTokenCreator: !!d.fraud_token_creator,
      sendAdByMemo: !!d.send_ad_by_memo,
      isBlackList: !!d.is_black_list,
    };
  } catch {
    return { checked: false };
  }
}
