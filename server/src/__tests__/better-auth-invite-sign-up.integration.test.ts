/**
 * With public sign-up disabled (`PAPERCLIP_AUTH_DISABLE_SIGN_UP=true`), the
 * credential sign-up must stay closed to everyone except a person holding an
 * open invite that admits humans. The invite landing page sends that invite's
 * raw token in `X-Paperclip-Invite-Token` on its sign-up request.
 */

import { createHash, randomUUID } from "node:crypto";
import express from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { authUsers, companies, createDb, invites } from "@paperclipai/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import { createBetterAuthHandler, createBetterAuthInstance } from "../auth/better-auth.js";
import type { Config } from "../config.js";

const ORIGIN = "http://127.0.0.1:41998";
const PASSWORD = "correct-horse-battery-staple";
const HOUR_MS = 60 * 60 * 1000;

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

function testConfig(): Config {
  return {
    deploymentMode: "authenticated",
    deploymentExposure: "private",
    authBaseUrlMode: "explicit",
    authPublicBaseUrl: ORIGIN,
    authDisableSignUp: true,
    allowedHostnames: ["127.0.0.1"],
    port: 41998,
  } as unknown as Config;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

describeEmbeddedPostgres("Better Auth sign-up with public sign-up disabled", () => {
  let database: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;
  let db!: ReturnType<typeof createDb>;
  let app!: express.Express;
  let companyId!: string;
  const originalEnv = {
    secret: process.env.BETTER_AUTH_SECRET,
    rateLimit: process.env.PAPERCLIP_AUTH_RATE_LIMIT_ENABLED,
  };

  async function createInvite(overrides: Partial<typeof invites.$inferInsert> = {}) {
    const token = `pcp_invite_${randomUUID()}`;
    await db.insert(invites).values({
      companyId,
      tokenHash: hashToken(token),
      allowedJoinTypes: "both",
      expiresAt: new Date(Date.now() + HOUR_MS),
      ...overrides,
    });
    return token;
  }

  function signUp(email: string, inviteToken?: string) {
    const req = request(app).post("/api/auth/sign-up/email").set("origin", ORIGIN);
    if (inviteToken) req.set("x-paperclip-invite-token", inviteToken);
    return req.send({ email, password: PASSWORD, name: "Invitee" });
  }

  beforeAll(async () => {
    process.env.BETTER_AUTH_SECRET = "better-auth-secret-for-invite-signup-tests";
    process.env.PAPERCLIP_AUTH_RATE_LIMIT_ENABLED = "false";

    database = await startEmbeddedPostgresTestDatabase("paperclip-better-auth-invite-signup-");
    db = createDb(database.connectionString);

    companyId = randomUUID();
    await db.insert(companies).values({
      id: companyId,
      name: "Invite sign-up fixture",
      issuePrefix: "INV",
      issueCounter: 1,
    });

    const auth = createBetterAuthInstance(db, testConfig(), [ORIGIN]);
    app = express();
    app.all("/api/auth/{*authPath}", createBetterAuthHandler(auth));
  }, 30_000);

  afterAll(async () => {
    await database?.cleanup();
    if (originalEnv.secret === undefined) delete process.env.BETTER_AUTH_SECRET;
    else process.env.BETTER_AUTH_SECRET = originalEnv.secret;
    if (originalEnv.rateLimit === undefined) delete process.env.PAPERCLIP_AUTH_RATE_LIMIT_ENABLED;
    else process.env.PAPERCLIP_AUTH_RATE_LIMIT_ENABLED = originalEnv.rateLimit;
  });

  it("rejects sign-up without an invite token", async () => {
    const res = await signUp("stranger@example.com");
    expect(res.status).toBe(400);
    expect(res.body?.code).toBe("EMAIL_PASSWORD_SIGN_UP_DISABLED");
  });

  it("rejects sign-up with an unknown invite token", async () => {
    const res = await signUp("guesser@example.com", "pcp_invite_not-a-real-token");
    expect(res.status).toBe(400);
    expect(res.body?.code).toBe("EMAIL_PASSWORD_SIGN_UP_DISABLED");
  });

  it.each([
    ["expired", { expiresAt: new Date(Date.now() - HOUR_MS) }],
    ["revoked", { revokedAt: new Date() }],
    ["accepted", { acceptedAt: new Date() }],
    ["agent-only", { allowedJoinTypes: "agent" }],
  ] as const)("rejects sign-up with an %s invite", async (label, overrides) => {
    const token = await createInvite(overrides);
    const res = await signUp(`${label}@example.com`, token);
    expect(res.status).toBe(400);
    expect(res.body?.code).toBe("EMAIL_PASSWORD_SIGN_UP_DISABLED");
  });

  it("creates the account when the request carries an open invite token", async () => {
    const token = await createInvite();
    const res = await signUp("invitee@example.com", token);
    expect(res.status).toBe(200);
    expect(res.body?.user?.email).toBe("invitee@example.com");

    const users = await db.select().from(authUsers);
    expect(users.map((user) => user.email)).toEqual(["invitee@example.com"]);
  });
});
