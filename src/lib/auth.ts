import crypto from "crypto";
import { cookies } from "next/headers";
import { readDb, updateDb, newId, User, Invite } from "./db";

const SESSION_COOKIE = "cvt_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 días
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutos

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const check = crypto.scryptSync(password, salt, 64).toString("hex");
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(check, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function createSession(userId: string): Promise<string> {
  return updateDb((db) => {
    const token = crypto.randomBytes(32).toString("hex");
    db.sessions[token] = { userId, expiresAt: Date.now() + SESSION_TTL_MS };
    // limpieza de sesiones vencidas al vuelo
    for (const [t, s] of Object.entries(db.sessions)) {
      if (s.expiresAt < Date.now()) delete db.sessions[t];
    }
    return token;
  });
}

export async function destroySession(token: string): Promise<void> {
  await updateDb((db) => {
    delete db.sessions[token];
  });
}

export async function getSessionUser(): Promise<User | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = await readDb();
  const session = db.sessions[token];
  if (!session || session.expiresAt < Date.now()) return null;
  return db.users.find((u) => u.id === session.userId) || null;
}

export function sessionCookieOptions() {
  return {
    name: SESSION_COOKIE,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  };
}

export { SESSION_COOKIE };

export async function createInvite(createdBy: string): Promise<string> {
  return updateDb((db) => {
    const code = crypto.randomBytes(6).toString("hex").toUpperCase();
    db.invites.push({ code, createdBy, createdAt: Date.now(), expiresAt: Date.now() + INVITE_TTL_MS, usedBy: null });
    return code;
  });
}

/**
 * Registro atómico: valida la invitación, crea el usuario, la marca como usada y abre
 * la sesión en UNA sola operación de updateDb() (lectura fresca + escritura con control
 * de concurrencia optimista — ver updateDb() en ./db). Si algo falla a mitad de camino
 * (correo duplicado, invitación inválida) no se escribe nada.
 */
export async function registerUser(params: {
  email: string; password: string; name: string; inviteCode?: string;
}): Promise<{ ok: true; user: User; token: string } | { ok: false; error: string; status: number }> {
  const email = params.email.trim().toLowerCase();

  return updateDb((db) => {
    if (db.users.some((u) => u.email === email)) {
      return { ok: false as const, error: "Ya existe una cuenta con ese correo.", status: 409 };
    }

    const isFirstUser = db.users.length === 0;
    let invite: Invite | undefined;

    if (!isFirstUser) {
      const code = params.inviteCode?.trim().toUpperCase();
      if (!code) return { ok: false as const, error: "Necesitas un código de invitación para crear una cuenta.", status: 403 };
      invite = db.invites.find((i) => i.code === code && !i.usedBy);
      if (!invite || invite.expiresAt < Date.now()) {
        return { ok: false as const, error: "El código de invitación no es válido o ya expiró.", status: 403 };
      }
    }

    const user: User = {
      id: newId(), email, passwordHash: hashPassword(params.password),
      name: params.name.trim(), role: isFirstUser ? "owner" : "member", createdAt: Date.now(),
      failedLoginAttempts: 0, lockedUntil: null,
    };
    db.users.push(user);
    if (invite) invite.usedBy = user.id;

    const token = crypto.randomBytes(32).toString("hex");
    db.sessions[token] = { userId: user.id, expiresAt: Date.now() + SESSION_TTL_MS };
    for (const [t, s] of Object.entries(db.sessions)) {
      if (s.expiresAt < Date.now()) delete db.sessions[t];
    }

    return { ok: true as const, user, token };
  });
}

/**
 * Verifica credenciales y crea la sesión en una sola operación atómica, incluyendo el
 * conteo de intentos fallidos por usuario: MAX_LOGIN_ATTEMPTS fallos seguidos bloquean
 * el login por LOGIN_LOCKOUT_MS. El contador vive en el propio registro del usuario
 * (mismo documento que todo lo demás) porque las rutas de Next.js corren como funciones
 * serverless — un contador en memoria del proceso no sobrevive entre invocaciones.
 */
export async function attemptLogin(
  email: string,
  password: string
): Promise<{ ok: true; user: User; token: string } | { ok: false; error: string; status: number }> {
  const normalizedEmail = email.trim().toLowerCase();

  return updateDb((db) => {
    const user = db.users.find((u) => u.email === normalizedEmail);
    if (!user) {
      return { ok: false as const, error: "Correo o contraseña incorrectos.", status: 401 };
    }

    const lockedUntil = user.lockedUntil ?? null;
    if (lockedUntil && lockedUntil > Date.now()) {
      const minutes = Math.ceil((lockedUntil - Date.now()) / 60000);
      return {
        ok: false as const,
        error: `Demasiados intentos. Intenta de nuevo en ${minutes} minuto${minutes === 1 ? "" : "s"}.`,
        status: 429,
      };
    }

    if (!verifyPassword(password, user.passwordHash)) {
      const attempts = (user.failedLoginAttempts ?? 0) + 1;
      user.failedLoginAttempts = attempts;
      if (attempts >= MAX_LOGIN_ATTEMPTS) user.lockedUntil = Date.now() + LOGIN_LOCKOUT_MS;
      return { ok: false as const, error: "Correo o contraseña incorrectos.", status: 401 };
    }

    user.failedLoginAttempts = 0;
    user.lockedUntil = null;

    const token = crypto.randomBytes(32).toString("hex");
    db.sessions[token] = { userId: user.id, expiresAt: Date.now() + SESSION_TTL_MS };
    for (const [t, s] of Object.entries(db.sessions)) {
      if (s.expiresAt < Date.now()) delete db.sessions[t];
    }

    return { ok: true as const, user, token };
  });
}

/** Helper para usar al inicio de cada ruta protegida:
 *    const auth = await requireAuth(); if (!auth.ok) return auth.res;
 */
export async function requireAuth(): Promise<{ ok: true; user: User } | { ok: false; res: Response }> {
  const user = await getSessionUser();
  if (!user) {
    return { ok: false, res: new Response(JSON.stringify({ error: "No autenticado" }), { status: 401, headers: { "Content-Type": "application/json" } }) };
  }
  return { ok: true, user };
}

