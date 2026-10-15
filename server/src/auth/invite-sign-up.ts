import { createHash } from "node:crypto";
import { and, eq, gt, isNull, ne } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { invites } from "@paperclipai/db";

// The invite landing page sends the raw invite token on its sign-up request so
// an instance with public sign-up disabled can still admit the people it
// invited.
export const INVITE_SIGN_UP_TOKEN_HEADER = "x-paperclip-invite-token";

// An invite admits a new account only while it is open to a human: not
// revoked, not yet accepted, not expired, and not restricted to agents. The
// token is stored hashed (sha256), matching `invites.tokenHash`.
export async function inviteAllowsHumanSignUp(db: Db, token: string | null | undefined): Promise<boolean> {
  const trimmed = token?.trim();
  if (!trimmed) return false;
  const tokenHash = createHash("sha256").update(trimmed).digest("hex");
  const rows = await db
    .select({ id: invites.id })
    .from(invites)
    .where(
      and(
        eq(invites.tokenHash, tokenHash),
        isNull(invites.revokedAt),
        isNull(invites.acceptedAt),
        gt(invites.expiresAt, new Date()),
        ne(invites.allowedJoinTypes, "agent"),
      ),
    )
    .limit(1);
  return rows.length > 0;
}
