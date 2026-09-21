import { supabase } from "./supabase";

export type Chain = "BTC" | "ETH" | "TRON";

export interface Wallet {
  id: string;
  chain: Chain;
  address: string;
  label: string;
}

export interface ManualHolding {
  id: string;
  coinId: string;
  symbol: string;
  qty: number;
}

export interface AliadoAddress {
  chain: Chain;
  address: string;
}

export interface Aliado {
  id: string;
  name: string;
  addresses: AliadoAddress[];
}

export interface Classification {
  aliadoId: string | null;
  concepto: string;
  isFee?: boolean; // comisión de red / cargo de plataforma — no es una transferencia real a un aliado
}

export interface PlanAttachment {
  filename: string; // ruta dentro del bucket de Supabase Storage
  url: string; // ruta de nuestra propia API que genera un link firmado al pedirlo (protegido por sesión)
  originalName: string;
  uploadedAt: number;
}

export interface PlanLeg {
  id: string;
  walletId: string;
  walletLabel: string;
  chain: Chain;
  asset: string;
  amount: number;
  isTest: boolean;
  done: boolean;
  doneAt: number | null;
  txHash: string;
  notes: string;
  attachments: PlanAttachment[];
}

export interface TransferPlan {
  id: string;
  createdAt: number;
  targetAmount: number;
  targetAsset: string;
  destination: string;
  destLabel: string; // aliado o etiqueta libre, si se conoce
  legs: PlanLeg[];
}

export type Role = "owner" | "member";

export interface User {
  id: string;
  email: string;
  passwordHash: string; // formato "salt:hash"
  name: string;
  role: Role;
  createdAt: number;
  failedLoginAttempts: number; // usuarios creados antes de esto no lo tienen — tratar como 0 al leer
  lockedUntil: number | null; // idem — tratar como null al leer
}

export interface Session {
  userId: string;
  expiresAt: number;
}

export interface Invite {
  code: string;
  createdBy: string;
  createdAt: number;
  expiresAt: number;
  usedBy: string | null;
}

export interface PushSubscriptionRecord {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface DB {
  wallets: Wallet[];
  manual: ManualHolding[];
  aliados: Aliado[];
  classifications: Record<string, Classification>; // key: `${chain}-${txid}[-idx]`
  plans: TransferPlan[];
  users: User[];
  sessions: Record<string, Session>; // token -> session
  invites: Invite[];
  pushSubscriptions: PushSubscriptionRecord[]; // conjunto chico y acotado, como wallets/users — no una serie de tiempo
  classificationKeysVersion?: number; // 2 = claves estables por txid (ver lib/classificationKeys.ts)
}

const EMPTY_DB: DB = { wallets: [], manual: [], aliados: [], classifications: {}, plans: [], users: [], sessions: {}, invites: [], pushSubscriptions: [] };

// Todo el estado de la app vive en una sola fila (id = true) de la tabla `app_state`,
// en una columna jsonb. Simple, y suficiente para el volumen de esta herramienta —
// evita tener que reescribir cada ruta para hacer consultas SQL por tabla.
const ROW_ID = true;

export async function readDb(): Promise<DB> {
  const { data, error } = await supabase.from("app_state").select("data").eq("id", ROW_ID).maybeSingle();
  if (error) {
    console.error("readDb() error:", error.message);
    throw new Error(`No se pudo leer la base de datos: ${error.message}`);
  }
  if (!data) {
    // primera vez: crea la fila con el estado vacío
    await supabase.from("app_state").upsert({ id: ROW_ID, data: EMPTY_DB, version: 1, updated_at: new Date().toISOString() });
    return { ...EMPTY_DB };
  }
  return { ...EMPTY_DB, ...(data.data as Partial<DB>) };
}

const MAX_UPDATE_ATTEMPTS = 5;

/**
 * Lee, muta y guarda con concurrencia optimista: si otra request escribió la fila entre
 * la lectura y la escritura de este intento (columna `version` cambió), reintenta desde
 * una lectura fresca en vez de pisar esos cambios. Antes cada ruta hacía su propio
 * readDb() → mutar → writeDb() del blob entero sin ninguna condición — dos escrituras
 * solapadas (dos pestañas, dos usuarios invitados) se pisaban en silencio.
 *
 * El `mutator` puede lanzar (ej. validación, 404 de un padre inexistente) — esa excepción
 * se propaga de inmediato, sin reintentar; solo se reintenta un conflicto real de versión.
 */
export async function updateDb<T>(mutator: (db: DB) => T | Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < MAX_UPDATE_ATTEMPTS; attempt++) {
    const { data, error } = await supabase.from("app_state").select("data, version").eq("id", ROW_ID).maybeSingle();
    if (error) {
      console.error("updateDb() read error:", error.message);
      throw new Error(`No se pudo leer la base de datos: ${error.message}`);
    }

    if (!data) {
      const db: DB = { ...EMPTY_DB };
      const result = await mutator(db);
      const { error: insertError } = await supabase
        .from("app_state")
        .insert({ id: ROW_ID, data: db, version: 1, updated_at: new Date().toISOString() });
      if (!insertError) return result;
      if (insertError.code !== "23505") { // unique_violation: cualquier otro error no es un conflicto de concurrencia
        console.error("updateDb() insert error:", insertError.message);
        throw new Error(`No se pudo guardar: ${insertError.message}`);
      }
      continue; // otra request creó la fila primero — reintentar contra ella
    }

    const db: DB = { ...EMPTY_DB, ...(data.data as Partial<DB>) };
    const version = data.version as number;
    const result = await mutator(db);

    const { data: updated, error: updateError } = await supabase
      .from("app_state")
      .update({ data: db, version: version + 1, updated_at: new Date().toISOString() })
      .eq("id", ROW_ID)
      .eq("version", version)
      .select("id");
    if (updateError) {
      console.error("updateDb() write error:", updateError.message);
      throw new Error(`No se pudo guardar: ${updateError.message}`);
    }
    if (updated && updated.length > 0) return result;
    // version ya no coincidía: alguien más escribió primero, reintentar con datos frescos
  }
  throw new Error("No se pudo guardar: demasiados conflictos de escritura simultánea. Intenta de nuevo.");
}

export function newId(): string {
  return crypto.randomUUID();
}
