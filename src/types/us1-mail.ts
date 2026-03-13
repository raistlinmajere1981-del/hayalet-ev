import type {
  LocalMailAccountSummary,
  MailTransportAuthConfig,
  MailTransportAuthType,
  MailTransportProviderType,
  MailTransportServerConfig,
  RemoteUserIdentity,
  Us1SlotSettings,
} from "./settings.js";

export interface Us1MailAccountDraft {
  mailAccountId?: string | null;
  providerType: MailTransportProviderType;
  email: string;
  enabled?: boolean;
  authType: MailTransportAuthType;
  imap?: Partial<MailTransportServerConfig>;
  smtp?: Partial<MailTransportServerConfig>;
  auth?: Partial<MailTransportAuthConfig>;
}

export interface Us1StateSnapshot {
  localMailAccounts: LocalMailAccountSummary[];
  remoteUsers: RemoteUserIdentity[];
  activeRemoteUsers: RemoteUserIdentity[];
  us1Slot: Us1SlotSettings;
  selectedMailAccountId: string | null;
  canAddRemoteUser: boolean;
}

export interface Us1ListStateParams {
  selectedMailAccountId?: string | null;
}

export interface Us1ListStateResult {
  success: boolean;
  state?: Us1StateSnapshot;
  error?: string;
}

export interface Us1MailAccountMutationResult {
  success: boolean;
  localMailAccount?: LocalMailAccountSummary;
  state?: Us1StateSnapshot;
  error?: string;
}

export interface Us1DeleteMailAccountParams {
  mailAccountId: string;
}

export interface Us1DeleteMailAccountResult {
  success: boolean;
  state?: Us1StateSnapshot;
  error?: string;
}

export interface Us1InviteRemoteUserParams {
  mailAccountId: string;
  email: string;
  nickname?: string;
}

export interface Us1AcceptRemoteUserParams {
  remoteUserId: string;
}

export interface Us1SyncRemoteUsersParams {
  mailAccountId?: string;
  limit?: number;
}

export interface Us1RemoteUserMutationResult {
  success: boolean;
  remoteUser?: RemoteUserIdentity;
  remoteUsers?: RemoteUserIdentity[];
  state?: Us1StateSnapshot;
  fetchedCount?: number;
  processedCount?: number;
  duplicateCount?: number;
  error?: string;
}

export interface Us1MessageAttachmentInput {
  path: string;
  name?: string;
  mimeType?: string;
}

export interface Us1RoomPackageCandidate {
  remoteUserId: string;
  localSessionId: string;
  conversationId: string;
  messageId: string;
  attachmentId?: string;
  originalName: string;
  storedPath: string;
  mimeType?: string | null;
  size?: number;
}

export interface Us1SendMessageParams {
  text?: string;
  localSessionId?: string | null;
  attachments?: Us1MessageAttachmentInput[];
}

export interface Us1SendMessageResult {
  success: boolean;
  remoteUserId?: string;
  localSessionId?: string;
  conversationId?: string;
  transportMessageId?: string;
  archiveMessageId?: string;
  deliveryState?: string;
  attachmentCount?: number;
  error?: string;
}

export interface Us1SyncMessagesParams {
  limit?: number;
  localSessionId?: string | null;
}

export interface Us1SyncMessagesResult {
  success: boolean;
  remoteUserId?: string;
  localSessionId?: string | null;
  conversationId?: string | null;
  fetchedCount?: number;
  processedCount?: number;
  duplicateCount?: number;
  projectedCount?: number;
  skippedCount?: number;
  unresolvedSessionCount?: number;
  roomPackages?: Us1RoomPackageCandidate[];
  error?: string;
}
