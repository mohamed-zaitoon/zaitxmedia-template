// lib/financial/auth.ts — shared admin auth helper
import { requireAdmin } from "@/lib/auth/admin";

export async function verifyAdminToken(_req: Request): Promise<boolean> {
  try {
    await requireAdmin();
    return true;
  } catch {
    return false;
  }
}

export function parseQueryInt(val: string | null, def: number): number {
  const n = parseInt(val || "", 10);
  return isNaN(n) ? def : n;
}

export function parseDateParam(val: string | null): Date | null {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}
