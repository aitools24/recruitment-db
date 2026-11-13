import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import { SESSION_COOKIE, signSession, verifySession, type SessionPayload } from "./session";
import { can, type Permission } from "./permissions";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const hashPassword = (p: string) => bcrypt.hash(p, 10);
export const checkPassword = (p: string, h: string) => bcrypt.compare(p, h);

export async function startSession(p: SessionPayload) {
  const token = await signSession(p);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Session from the cookie, re-checked against the DB so deactivated users and role changes apply at once. */
export async function getSession(): Promise<SessionPayload | null> {
  const s = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!s) return null;
  const user = await prisma.user.findUnique({ where: { id: s.userId } });
  if (!user || !user.active || user.tenantId !== s.tenantId) return null;
  return { userId: user.id, tenantId: user.tenantId, role: user.role, name: user.name };
}

/** For API routes: throws 401/403. */
export async function requireApi(perm?: Permission) {
  const s = await getSession();
  if (!s) throw new HttpError(401, "Not signed in");
  if (perm && !can(s.role, perm)) throw new HttpError(403, "You don't have permission to do this");
  return s;
}

/** For pages: redirects to login. */
export async function requirePage(perm?: Permission) {
  const s = await getSession();
  if (!s) redirect("/login");
  if (perm && !can(s.role, perm)) redirect("/candidates?denied=1");
  return s;
}

/** Wrap a route handler so HttpError and zod errors become JSON responses. */
export function handler<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
      if (e && typeof e === "object" && "issues" in e) {
        return Response.json({ error: "Invalid input", issues: (e as { issues: unknown }).issues }, { status: 400 });
      }
      console.error(e);
      return Response.json({ error: "Something went wrong" }, { status: 500 });
    }
  };
}
