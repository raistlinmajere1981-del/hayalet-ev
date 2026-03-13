import type {
  Us1AcceptRemoteUserParams,
  Us1DeleteMailAccountParams,
  Us1InviteRemoteUserParams,
  Us1MailAccountDraft,
  Us1SendMessageParams,
  Us1SyncMessagesParams,
  Us1SyncRemoteUsersParams,
} from "@shared/us1-mail.js";

import { mailIdentityService } from "../mail-identity-service.ts";
import { us1ConversationService } from "../us1-conversation-service.ts";
import { registerHandler } from "./ipc-helpers.ts";

export function setupUs1MailHandlers(): void {
  registerHandler("us1-upsert-mail-account", async (_event, draft: unknown, options: unknown) => {
    return await mailIdentityService.upsertMailAccount(draft as Us1MailAccountDraft, options as { verifyAfterSave?: boolean });
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
}
