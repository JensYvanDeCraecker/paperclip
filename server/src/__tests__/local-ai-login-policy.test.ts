import { describe, expect, it } from "vitest";
import { supportsLocalAiLogin } from "../services/local-ai-login-policy.js";
describe("server-host subscription login policy", () => {
  it("permits private self-hosted instances and explicit trusted hosts", () => {
    expect(supportsLocalAiLogin({ deploymentMode: "local_trusted", deploymentExposure: "private" })).toBe(true);
    expect(supportsLocalAiLogin({ deploymentMode: "authenticated", deploymentExposure: "private" })).toBe(true);
    expect(supportsLocalAiLogin({ deploymentMode: "authenticated", deploymentExposure: "public", trustedLocalStdioRuntimeHost: "trusted-host" })).toBe(true);
    expect(supportsLocalAiLogin({ deploymentMode: "authenticated", deploymentExposure: "public", trustedLocalStdioRuntimeHost: "" })).toBe(false);
  });
  it("permits public instances only with the explicit subscription-login opt-in", () => {
    const publicInstance = { deploymentMode: "authenticated", deploymentExposure: "public", trustedLocalStdioRuntimeHost: "" } as const;
    expect(supportsLocalAiLogin({ ...publicInstance, allowPublicLocalAiLogin: false })).toBe(false);
    expect(supportsLocalAiLogin({ ...publicInstance, allowPublicLocalAiLogin: true })).toBe(true);
  });
});
