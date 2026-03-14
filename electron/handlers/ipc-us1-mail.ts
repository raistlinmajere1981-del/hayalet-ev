import type {
  Us1AcceptRemoteUserParams,
  Us1DeleteMailAccountParams,
  Us1InviteRemoteUserParams,
  Us1MailAccountDraft,
  Us1SendMessageParams,
  Us1SyncMessagesParams,
  Us1SyncRemoteUsersParams,
} from "@shared/us1-mail.js";

import { shell } from "electron";
import { mailIdentityService } from "../mail-identity-service.ts";
import { us1ConversationService } from "../us1-conversation-service.ts";
import { registerHandler } from "./ipc-helpers.ts";

const ALLOWED_GOOGLE_AUTH_DOMAINS = ["accounts.google.com", "www.google.com", "google.com"];

export function setupUs1MailHandlers(): void {
  registerHandler("us1-upsert-mail-account", async (_event, draft: unknown, options: unknown) => {
    return await mailIdentityService.upsertMailAccount(
      draft as Us1MailAccountDraft,
      options as { verifyAfterSave?: boolean }
    );
  });

  registerHandler("us1-verify-mail-account", async (_event, params: unknown) => {
    const payload = params as { mailAccountId?: string };
    return await mailIdentityService.verifyMailAccount(payload.mailAccountId ?? "");
  });

  registerHandler("us1-delete-mail-account", async (_event, params: unknown) => {
    return await mailIdentityService.deleteMailAccount(params as Us1DeleteMailAccountParams);
  });

  registerHandler("us1-invite-remote-user", async (_event, params: unknown) => {
    return await mailIdentityService.inviteRemoteUser(params as Us1InviteRemoteUserParams);
  });

  registerHandler("us1-accept-remote-user", async (_event, params: unknown) => {
    return await mailIdentityService.acceptRemoteUser(params as Us1AcceptRemoteUserParams);
  });

  registerHandler("us1-sync-remote-users", async (_event, params: unknown) => {
    return await mailIdentityService.syncRemoteUsers((params ?? {}) as Us1SyncRemoteUsersParams);
  });

  registerHandler("us1-send-message", async (_event, params: unknown) => {
    return await us1ConversationService.sendMessage((params ?? {}) as Us1SendMessageParams);
  });

  registerHandler("us1-sync-messages", async (_event, params: unknown) => {
    return await us1ConversationService.syncMessages((params ?? {}) as Us1SyncMessagesParams);
  });

  registerHandler("us1-mail-start-gmail-oauth", async (_event) => {
    console.info("[IPC] Starting Gmail OAuth...");
    const result = await mailIdentityService.startGmailOauth();
    const authUrl = typeof result.authUrl === "string" ? result.authUrl.trim() : "";
    const hasAuthUrl = authUrl !== "";
    console.info(
      "[IPC] startGmailOauth result:",
      result.success,
      hasAuthUrl ? "URL present" : "URL missing"
    );

    if (!result.success) {
      return result;
    }

    if (hasAuthUrl) {
      try {
        const urlObj = new URL(authUrl);
        console.info("[IPC] Hostname check:", urlObj.hostname);

        if (ALLOWED_GOOGLE_AUTH_DOMAINS.includes(urlObj.hostname)) {
          console.info("[IPC] Opening external URL:", authUrl);
          await shell.openExternal(authUrl);
          return { success: true };
        } else {
          console.error("[IPC] Domain not allowed:", urlObj.hostname);
          return { success: false, error: `Domain not allowed: ${urlObj.hostname}` };
        }
      } catch (err) {
        console.error("[IPC] Error opening URL:", err);
        return { success: false, error: `Browser open error: ${String(err)}` };
      }
    }

    return { success: false, error: "Auth URL generation failed." };
  });

  registerHandler("us1-mail-exchange-gmail-code", async (_event, params: unknown) => {
    const payload = params as { code: string };
    return await mailIdentityService.exchangeGmailCode(payload.code);
  });

  registerHandler("us1-mail-listen-gmail-code", async (_event) => {
    return await mailIdentityService.listenForGmailCode();
  });
}
