import type { DeploymentMode, DeploymentExposure } from "@paperclipai/shared";

/**
 * Same server-host boundary as local stdio runtimes, with one narrower opt-in:
 * `PAPERCLIP_ALLOW_PUBLIC_LOCAL_AI_LOGIN=true` permits server-host subscription
 * sign-in on an authenticated public instance without also designating the
 * host as a trusted local stdio runtime.
 */
export function supportsLocalAiLogin(options: {
  deploymentMode?: DeploymentMode;
  deploymentExposure?: DeploymentExposure;
  trustedLocalStdioRuntimeHost?: string | null;
  allowPublicLocalAiLogin?: boolean;
}) {
  if (options.deploymentMode !== "authenticated" || options.deploymentExposure !== "public") return true;
  if (options.allowPublicLocalAiLogin ?? process.env.PAPERCLIP_ALLOW_PUBLIC_LOCAL_AI_LOGIN === "true") return true;
  return Boolean(
    options.trustedLocalStdioRuntimeHost ?? process.env.PAPERCLIP_TRUSTED_MCP_RUNTIME_HOST ?? process.env.PAPERCLIP_TOOL_RUNTIME_TRUSTED_HOST,
  );
}
