import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, type KeyObject } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer as createHttpsServer } from "node:https";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { initPaths } from "../../electron/paths.ts";
import { Us1RelayServer } from "../../electron/us1-relay-server/server.ts";
import {
  RelayTlsPinError,
  us1RelayClient,
} from "../../electron/us1-relay/client.ts";
import {
  decryptRelayBinary,
  decryptRelayPayload,
  encryptRelayBinary,
  encryptRelayPayload,
  randomNonce,
  randomToken,
  signRelayPayload,
} from "../../electron/us1-relay/crypto.ts";
import {
  US1_RELAY_MESSAGE_PROTOCOL,
  US1_RELAY_PROTOCOL_VERSION,
  type Us1RelayConversationPayload,
  type Us1RelayEncryptedEnvelope,
} from "../../src/types/us1-relay.ts";

initPaths(join(process.cwd(), "electron"));

const TEST_TLS_CERT_PEM = `-----BEGIN CERTIFICATE-----
MIIDCTCCAfGgAwIBAgIUbzDrv5cGNLPTbv4XucfE36MgjbkwDQYJKoZIhvcNAQEL
BQAwFDESMBAGA1UEAwwJbG9jYWxob3N0MB4XDTI2MDMyMzE3MTAwNFoXDTI2MDMy
NDE3MTAwNFowFDESMBAGA1UEAwwJbG9jYWxob3N0MIIBIjANBgkqhkiG9w0BAQEF
AAOCAQ8AMIIBCgKCAQEA0+8y2O4EM8Trlg0xg6aoab4tFj4X5Cf/IouNWjanY2zC
o8Z6kzZB86TNjaHGUpUxHFAkMGU8Z36FEypwK/0k3iEfnlGLKoOmCBp2jf8JmVXK
sFks7RTVJE7K2NMT1V5DdHCJDiTMbl0kggnsnNWw7Tns+/POU0bHwsirNdPoWdDH
k8ekGgC3DmMj8ESdXhnh5WAG8M1yrAu8bKGx/90loMgK277gwNfYujq44QUUrbVC
BwTM7o7dopurgr2zAAiCSFnDaC4yFojJ5raPKlVrSMadMfGAjEXpV5OMoicbLn2s
gH/ePwuxPWh8JVLG8Xv+u/hftWf10rrYtNIPLcJlwwIDAQABo1MwUTAdBgNVHQ4E
FgQUWzqO+1YzdaXHcQeI6tnfuqBqXaswHwYDVR0jBBgwFoAUWzqO+1YzdaXHcQeI
6tnfuqBqXaswDwYDVR0TAQH/BAUwAwEB/zANBgkqhkiG9w0BAQsFAAOCAQEAR5zk
mrlaQkCUdhQk1KdwfBnxHyOA6oqgLM5mwzMxdiYpfoBtmkFLHaDNNH6xbY80grCW
OYXTcH4ZLUWHFM9gPbXkeMf4Jhox04m6rQ6NxQrVGAhjpVkFNZMrc6Ur6ZGmbXJu
qVpEcc9cJacBsjQbr5dmBIFRX3zNrooTVKL0cpzME+EIiCEOinqqnr0ZwqWhtu01
xkT5heeoKsfKJv86d8A4R2p1FtT/SCn/oFZTMZtGoxhYL9KH/P81okoP00q1JzBr
ujxscm9JbR91anERFEZ/LSWTlH8alrZVZvRt1W1Jczhc5+Pc/P5VM3rhklLgdZ4I
z76F7QzzfKk4jBclNg==
-----END CERTIFICATE-----
`;

const TEST_TLS_KEY_PEM = `-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDT7zLY7gQzxOuW
DTGDpqhpvi0WPhfkJ/8ii41aNqdjbMKjxnqTNkHzpM2NocZSlTEcUCQwZTxnfoUT
KnAr/STeIR+eUYsqg6YIGnaN/wmZVcqwWSztFNUkTsrY0xPVXkN0cIkOJMxuXSSC
Ceyc1bDtOez7885TRsfCyKs10+hZ0MeTx6QaALcOYyPwRJ1eGeHlYAbwzXKsC7xs
obH/3SWgyArbvuDA19i6OrjhBRSttUIHBMzujt2im6uCvbMACIJIWcNoLjIWiMnm
to8qVWtIxp0x8YCMRelXk4yiJxsufayAf94/C7E9aHwlUsbxe/67+F+1Z/XSuti0
0g8twmXDAgMBAAECggEAGqo5gI0PNEruGowAaIBbJ4AeVh0WjnCbK4fZZLoEUisd
9iiDxZU0Xmj5f9IUjNFpQ2xbO/I7fl4EdPEy+dCOMfCC9OgXlWVzn14M/+Klx4gW
yhyo3WTF8x0tbR2+8hU7xsuzQsyjIq5PaJkXucfdIeEsOFW9kOwSjXxdUOwfi3p8
NT523HrOGJ95a9IbCbG5N9g3OMMOkHZH5tSfW6Qh/zSiYMEanCEwYDDPglZdnmPZ
JSqJoXuolbzv8+rfCbIySoQ6HRXG0+KD6Oxpn3aXtoYXPANZk2KHdpO3zXvy5K2t
B97lVG0ibls+ZBkHHLdGfAvBOnadbDNQkth7wXSAsQKBgQD1jLISvSBnJf5VhXq7
mzCspH8Kj0HZ3hz6oW1RqXlzJcCLwsqfzr42buOEHzXgy3fTRusMtcSgU4gd8cpr
/MI+YLH3KmNl4jwQQKsgPup1efB/RqQjMYAuFPkYWi6vQs1xziLhRT1hJC089L4p
y6PkLqzX7YleQ2w9bY+2MF8ZaQKBgQDc9EJtSdLvEgplsBF60SiOYYbDKa8NZj3k
1OKdSLwBRtdN6v174re1JgRPg8BH7T88xnby4QB8dKr/YzlfJkG49aQykliJ25wO
P1J2GGCAmneD14nV5WcQkq1hgIOU2gahdFL0M0eLQhapPADGE0GC1n7aLpjlW6Sv
ZD6dG6PUSwKBgFQO1QrrKYOGExnttsUwbCo9qavQvMc7bQozZrv02zma694sUbcB
TEZQEZyyHnyUyrFN7rsMIoKL9eXiVtw+y7QU3/dv0FUZbFxX9vzz7MlIdBbt9NSD
ZpDf5yH6BU9D/BaAbZpWXJu7iaz7T3n5V2KOw+arT0IwrIYe0nqY9oU5AoGAMxE1
RSMZ4G1v/76o25T55aZ+yh6ZOeSWi4v0cFu+MCFaY8TbH0XwJasKtgICb91Sj05j
cZE1Vo50cyBQw0AJUqFbeODAG+So9dYGzgqmSzLoSo2HauthXcA42F8mikG15J0J
Cy3K7FGzARxAJYePzZibqvu4FNKQhoUJv7ACtm8CgYBPqqg7tBm18qz4ay1P0K6+
AOFGS0FasfzLM+kUjFzSAIAlFhkPeji6ZNH492tfKaCsg4VXSyhbd8IvPQfJfZs6
KxE5LK2N2TXu530Wo96Gy8uPAWXExsUj761i7R4b8oahbkKoZ/ygBiVgSdYKeQMZ
Gs+EgWqmwehvK0NFVHJEWQ==
-----END PRIVATE KEY-----
`;

function exportPublicKeyBase64(key: KeyObject): string {
  return Buffer.from(key.export({ type: "spki", format: "der" })).toString("base64");
}

function fingerprint(base64Key: string): string {
  return createHash("sha256").update(Buffer.from(base64Key, "base64")).digest("hex");
}

function fingerprintFromPemCertificate(pemCertificate: string): string {
  const der = Buffer.from(
    pemCertificate
      .replace(/-----BEGIN CERTIFICATE-----/g, "")
      .replace(/-----END CERTIFICATE-----/g, "")
      .replace(/\s+/g, ""),
    "base64"
  );
  return createHash("sha256").update(der).digest("hex");
}

async function postJson<TResponse>(url: string, body: unknown): Promise<TResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await response.json()) as TResponse;
}

test("US1 relay server stores, serves, decrypts, and acknowledges encrypted envelopes", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "us1-relay-test-"));
  const relayServer = new Us1RelayServer(rootDir);
  const listener = relayServer.createListener();

  const senderEncryptionKeys = generateKeyPairSync("x25519");
  const senderSigningKeys = generateKeyPairSync("ed25519");
  const recipientEncryptionKeys = generateKeyPairSync("x25519");
  const recipientSigningKeys = generateKeyPairSync("ed25519");

  const senderEncryptionPublicKey = exportPublicKeyBase64(senderEncryptionKeys.publicKey);
  const senderSigningPublicKey = exportPublicKeyBase64(senderSigningKeys.publicKey);
  const recipientEncryptionPublicKey = exportPublicKeyBase64(recipientEncryptionKeys.publicKey);
  const recipientSigningPublicKey = exportPublicKeyBase64(recipientSigningKeys.publicKey);

  const senderEncryptionKeyFingerprint = fingerprint(senderEncryptionPublicKey);
  const senderSigningKeyFingerprint = fingerprint(senderSigningPublicKey);
  const recipientEncryptionKeyFingerprint = fingerprint(recipientEncryptionPublicKey);
  const recipientSigningKeyFingerprint = fingerprint(recipientSigningPublicKey);

  const payload: Us1RelayConversationPayload = {
    protocol: US1_RELAY_MESSAGE_PROTOCOL,
    version: US1_RELAY_PROTOCOL_VERSION,
    messageType: "conversation",
    sentAt: 1700000000000,
    localSessionId: "session-relay-1",
    session: {
      id: "session-relay-1",
      mode: "new",
      title: "Relay Test",
      createdAt: 1700000000000,
      openHint: "auto_if_idle",
    },
    thread: {
      threadRootMessageId: null,
      replyToMessageId: null,
    },
    profile: {
      remoteUserId: "sender@example.com",
      email: "sender@example.com",
      nickname: "Sender",
      avatar: "",
      profileRevision: 1,
    },
    text: "hello from relay",
    attachments: [],
  };

  const envelope: Us1RelayEncryptedEnvelope = encryptRelayPayload({
    payload,
    localPrivateKey: senderEncryptionKeys.privateKey,
    remotePublicKeyBase64: recipientEncryptionPublicKey,
    senderRemoteUserId: "sender@example.com",
    senderEncryptionKeyFingerprint,
    recipientEncryptionKeyFingerprint,
    messageId: "relay-message-1",
    sentAt: payload.sentAt,
  });

  await new Promise<void>((resolve) => listener.listen(0, "127.0.0.1", () => resolve()));
  const address = listener.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const publishUnsignedPayload = {
      senderSigningPublicKey,
      senderSigningKeyFingerprint,
      recipientSigningKeyFingerprint,
      signedAt: Date.now(),
      nonce: randomToken(12),
      envelope,
    };
    const publishResult = await postJson<{ success: boolean; messageId?: string; error?: string }>(
      `${baseUrl}/v1/publish`,
      {
        ...publishUnsignedPayload,
        signature: signRelayPayload(publishUnsignedPayload, senderSigningKeys.privateKey),
      }
    );

    assert.equal(publishResult.success, true);
    assert.ok(publishResult.messageId);

    const pollUnsignedPayload = {
      recipientSigningPublicKey,
      recipientSigningKeyFingerprint,
      signedAt: Date.now(),
      nonce: randomNonce(9),
      cursor: null,
      limit: 10,
    };
    const pollResult = await postJson<{
      success: boolean;
      messages?: Array<{ id: string; envelope: Us1RelayEncryptedEnvelope }>;
    }>(`${baseUrl}/v1/poll`, {
      ...pollUnsignedPayload,
      signature: signRelayPayload(pollUnsignedPayload, recipientSigningKeys.privateKey),
    });

    assert.equal(pollResult.success, true);
    assert.equal(pollResult.messages?.length, 1);

    const decrypted = decryptRelayPayload({
      envelope: pollResult.messages?.[0]?.envelope as Us1RelayEncryptedEnvelope,
      localPrivateKey: recipientEncryptionKeys.privateKey,
      remotePublicKeyBase64: senderEncryptionPublicKey,
    });

    assert.equal(decrypted.text, "hello from relay");
    assert.equal(decrypted.localSessionId, "session-relay-1");

    const ackUnsignedPayload = {
      recipientSigningPublicKey,
      recipientSigningKeyFingerprint,
      messageIds: [pollResult.messages?.[0]?.id as string],
      signedAt: Date.now(),
      nonce: randomToken(12),
    };
    const ackResult = await postJson<{ success: boolean; acknowledgedCount?: number }>(
      `${baseUrl}/v1/ack`,
      {
        ...ackUnsignedPayload,
        signature: signRelayPayload(ackUnsignedPayload, recipientSigningKeys.privateKey),
      }
    );

    assert.equal(ackResult.success, true);
    assert.equal(ackResult.acknowledgedCount, 1);
  } finally {
    listener.close();
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("US1 relay server stores, downloads, decrypts, and cleans up encrypted attachment chunks", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "us1-relay-attachment-test-"));
  const relayServer = new Us1RelayServer(rootDir);
  const listener = relayServer.createListener();

  const senderEncryptionKeys = generateKeyPairSync("x25519");
  const senderSigningKeys = generateKeyPairSync("ed25519");
  const recipientEncryptionKeys = generateKeyPairSync("x25519");
  const recipientSigningKeys = generateKeyPairSync("ed25519");

  const senderEncryptionPublicKey = exportPublicKeyBase64(senderEncryptionKeys.publicKey);
  const senderSigningPublicKey = exportPublicKeyBase64(senderSigningKeys.publicKey);
  const recipientEncryptionPublicKey = exportPublicKeyBase64(recipientEncryptionKeys.publicKey);
  const recipientSigningPublicKey = exportPublicKeyBase64(recipientSigningKeys.publicKey);

  const senderEncryptionKeyFingerprint = fingerprint(senderEncryptionPublicKey);
  const senderSigningKeyFingerprint = fingerprint(senderSigningPublicKey);
  const recipientEncryptionKeyFingerprint = fingerprint(recipientEncryptionPublicKey);
  const recipientSigningKeyFingerprint = fingerprint(recipientSigningPublicKey);

  await new Promise<void>((resolve) => listener.listen(0, "127.0.0.1", () => resolve()));
  const address = listener.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const attachmentId = "relay-attachment-1";
  const chunkPayloads = [Buffer.from("hello "), Buffer.from("from relay chunks")];

  try {
    for (let chunkIndex = 0; chunkIndex < chunkPayloads.length; chunkIndex += 1) {
      const chunkPayload = chunkPayloads[chunkIndex];
      assert.ok(chunkPayload);

      const envelope = encryptRelayBinary({
        payload: chunkPayload,
        localPrivateKey: senderEncryptionKeys.privateKey,
        remotePublicKeyBase64: recipientEncryptionPublicKey,
        senderRemoteUserId: "sender@example.com",
        senderEncryptionKeyFingerprint,
        recipientEncryptionKeyFingerprint,
        messageId: `${attachmentId}:${chunkIndex}`,
        sentAt: 1700000000000 + chunkIndex,
      });

      const uploadUnsignedPayload = {
        senderSigningPublicKey,
        senderSigningKeyFingerprint,
        recipientSigningKeyFingerprint,
        attachmentId,
        chunkIndex,
        chunkCount: chunkPayloads.length,
        signedAt: Date.now(),
        nonce: randomToken(12),
        envelope,
      };
      const uploadResult = await postJson<{ success: boolean; chunkIndex?: number }>(
        `${baseUrl}/v1/attachment/upload`,
        {
          ...uploadUnsignedPayload,
          signature: signRelayPayload(uploadUnsignedPayload, senderSigningKeys.privateKey),
        }
      );

      assert.equal(uploadResult.success, true);
      assert.equal(uploadResult.chunkIndex, chunkIndex);
    }

    const downloadUnsignedPayload = {
      recipientSigningPublicKey,
      recipientSigningKeyFingerprint,
      attachmentId,
      signedAt: Date.now(),
      nonce: randomNonce(9),
    };
    const downloadResult = await postJson<{
      success: boolean;
      chunks?: Array<{ chunkIndex: number; envelope: Us1RelayEncryptedEnvelope }>;
    }>(`${baseUrl}/v1/attachment/download`, {
      ...downloadUnsignedPayload,
      signature: signRelayPayload(downloadUnsignedPayload, recipientSigningKeys.privateKey),
    });

    assert.equal(downloadResult.success, true);
    assert.equal(downloadResult.chunks?.length, chunkPayloads.length);

    const decrypted = Buffer.concat(
      (downloadResult.chunks ?? []).map((chunk) =>
        decryptRelayBinary({
          envelope: chunk.envelope,
          localPrivateKey: recipientEncryptionKeys.privateKey,
          remotePublicKeyBase64: senderEncryptionPublicKey,
        })
      )
    );
    assert.equal(decrypted.toString("utf8"), "hello from relay chunks");

    const ackUnsignedPayload = {
      recipientSigningPublicKey,
      recipientSigningKeyFingerprint,
      messageIds: [],
      attachmentIds: [attachmentId],
      signedAt: Date.now(),
      nonce: randomToken(12),
    };
    const ackResult = await postJson<{
      success: boolean;
      deletedAttachmentCount?: number;
    }>(`${baseUrl}/v1/ack`, {
      ...ackUnsignedPayload,
      signature: signRelayPayload(ackUnsignedPayload, recipientSigningKeys.privateKey),
    });

    assert.equal(ackResult.success, true);
    assert.equal(ackResult.deletedAttachmentCount, 1);

    const afterCleanupUnsignedPayload = {
      recipientSigningPublicKey,
      recipientSigningKeyFingerprint,
      attachmentId,
      signedAt: Date.now(),
      nonce: randomNonce(9),
    };
    const afterCleanup = await postJson<{
      success: boolean;
      chunks?: Array<{ chunkIndex: number; envelope: Us1RelayEncryptedEnvelope }>;
    }>(`${baseUrl}/v1/attachment/download`, {
      ...afterCleanupUnsignedPayload,
      signature: signRelayPayload(afterCleanupUnsignedPayload, recipientSigningKeys.privateKey),
    });

    assert.equal(afterCleanup.success, true);
    assert.equal(afterCleanup.chunks?.length ?? 0, 0);
  } finally {
    listener.close();
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("US1 relay client pins the HTTPS relay certificate fingerprint", async () => {
  const listener = createHttpsServer(
    {
      key: TEST_TLS_KEY_PEM,
      cert: TEST_TLS_CERT_PEM,
    },
    (_req, res) => {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ success: true }));
    }
  );

  await new Promise<void>((resolve) => listener.listen(0, "127.0.0.1", () => resolve()));
  const address = listener.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `https://localhost:${address.port}`;
  const expectedFingerprint = fingerprintFromPemCertificate(TEST_TLS_CERT_PEM);

  try {
    const healthResult = await us1RelayClient.health(baseUrl);
    assert.equal(healthResult.reachable, true);
    assert.equal(healthResult.transportProtocol, "https");
    assert.equal(healthResult.serverFingerprint, expectedFingerprint);

    await assert.rejects(
      async () => {
        await us1RelayClient.health(baseUrl, {
          pinnedServerFingerprint: "deadbeef",
        });
      },
      (error: unknown) => {
        assert.ok(error instanceof RelayTlsPinError);
        assert.equal(error.expectedFingerprint, "deadbeef");
        assert.equal(error.observedFingerprint, expectedFingerprint);
        return true;
      }
    );

    const pinnedResult = await us1RelayClient.health(baseUrl, {
      pinnedServerFingerprint: expectedFingerprint,
    });
    assert.equal(pinnedResult.reachable, true);
    assert.equal(pinnedResult.serverFingerprint, expectedFingerprint);
  } finally {
    listener.close();
  }
});

test("US1 relay server sweeps orphaned attachment uploads after the retention window", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "us1-relay-cleanup-test-"));
  let now = 1_700_000_100_000;
  const relayServer = new Us1RelayServer(rootDir, {
    now: () => now,
    orphanedAttachmentTtlMs: 50,
    cleanupIntervalMs: 0,
  });
  const listener = relayServer.createListener();

  const senderEncryptionKeys = generateKeyPairSync("x25519");
  const senderSigningKeys = generateKeyPairSync("ed25519");
  const recipientEncryptionKeys = generateKeyPairSync("x25519");
  const recipientSigningKeys = generateKeyPairSync("ed25519");

  const senderEncryptionPublicKey = exportPublicKeyBase64(senderEncryptionKeys.publicKey);
  const senderSigningPublicKey = exportPublicKeyBase64(senderSigningKeys.publicKey);
  const recipientEncryptionPublicKey = exportPublicKeyBase64(recipientEncryptionKeys.publicKey);
  const recipientSigningPublicKey = exportPublicKeyBase64(recipientSigningKeys.publicKey);

  const senderEncryptionKeyFingerprint = fingerprint(senderEncryptionPublicKey);
  const senderSigningKeyFingerprint = fingerprint(senderSigningPublicKey);
  const recipientEncryptionKeyFingerprint = fingerprint(recipientEncryptionPublicKey);
  const recipientSigningKeyFingerprint = fingerprint(recipientSigningPublicKey);

  await new Promise<void>((resolve) => listener.listen(0, "127.0.0.1", () => resolve()));
  const address = listener.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const attachmentId = "relay-orphaned-attachment-1";

  try {
    const encryptedChunk = encryptRelayBinary({
      payload: Buffer.from("orphaned attachment"),
      localPrivateKey: senderEncryptionKeys.privateKey,
      remotePublicKeyBase64: recipientEncryptionPublicKey,
      senderRemoteUserId: "sender@example.com",
      senderEncryptionKeyFingerprint,
      recipientEncryptionKeyFingerprint,
      messageId: `${attachmentId}:0`,
      sentAt: now,
    });
    const uploadUnsignedPayload = {
      senderSigningPublicKey,
      senderSigningKeyFingerprint,
      recipientSigningKeyFingerprint,
      attachmentId,
      chunkIndex: 0,
      chunkCount: 1,
      signedAt: now,
      nonce: randomToken(12),
      envelope: encryptedChunk,
    };
    const uploadResult = await postJson<{ success: boolean }>(`${baseUrl}/v1/attachment/upload`, {
      ...uploadUnsignedPayload,
      signature: signRelayPayload(uploadUnsignedPayload, senderSigningKeys.privateKey),
    });
    assert.equal(uploadResult.success, true);

    now += 100;
    await fetch(`${baseUrl}/v1/health`);

    const downloadUnsignedPayload = {
      recipientSigningPublicKey,
      recipientSigningKeyFingerprint,
      attachmentId,
      signedAt: now,
      nonce: randomNonce(9),
    };
    const downloadResult = await postJson<{
      success: boolean;
      chunks?: Array<{ chunkIndex: number; envelope: Us1RelayEncryptedEnvelope }>;
    }>(`${baseUrl}/v1/attachment/download`, {
      ...downloadUnsignedPayload,
      signature: signRelayPayload(downloadUnsignedPayload, recipientSigningKeys.privateKey),
    });
    assert.equal(downloadResult.success, true);
    assert.equal(downloadResult.chunks?.length ?? 0, 0);
  } finally {
    listener.close();
    await rm(rootDir, { recursive: true, force: true });
  }
});
