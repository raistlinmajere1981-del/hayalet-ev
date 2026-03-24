# Plan: US1 Self-Hosted Relay E2EE Transport

**Generated**: 2026-03-23
**Estimated Complexity**: High

## Overview

Add a second US1 communication system to Hayalet-ev:

- keep the existing email-based handshake and invite flow
- add a post-handshake `self-hosted relay + end-to-end encryption` transport
- expose the transport choice in the Entrance US1 slot the same way AI1 and AI2 expose communication preferences
- keep the renderer-facing US1 APIs stable so Analyze, room runtime, and archive flows remain transport-agnostic

The safest implementation path is:

1. lock the US1 identity/account projection contract so archive, search, scene, and room flows keep a stable identity shape
2. split transport-neutral US1 identity/runtime state from mail-admin state
3. widen `US1` settings and service seams so US1 is no longer hard-wired to mail-only runtime delivery
4. introduce a repo-owned relay protocol and relay server with encrypted envelope storage only
5. add a relay transport adapter behind the existing `us1SendMessage` / `us1SyncMessages` renderer API
6. expose transport-aware readiness state before UI rollout
7. wire the new communication-system selector into classic Entrance, scene Entrance, and Settings
8. reuse the existing archive, room-event, room-command, and attachment projection flows as much as possible

## Assumptions

- Email remains the only onboarding and identity handshake channel in v1.
- The new relay transport activates only after the remote user is already in `handshakeState === "active"`.
- The current single-active-US1-binding rule remains in place.
- “No package dependency” is interpreted as **no new npm dependency for this feature**.
- v1 should avoid introducing a new third-party transport stack and should prefer Node/Electron built-ins for crypto and relay networking.
- If the team later interprets the constraint as “zero new third-party runtime involvement”, v1 relay storage should stay filesystem-first rather than depending on a new server-only database layer.
- The relay transport should not replace mail immediately; mail stays available as a fallback communication system.
- The relay server is self-hosted and repo-owned, but it is a separate deployable service/process, not a direct peer-to-peer protocol.

## Locked Technical Direction

- Renderer API stays stable:
  - `window.electronAPI.us1SendMessage(...)`
  - `window.electronAPI.us1SyncMessages(...)`
- Transport selection happens in Electron/main-process US1 services, not in Analyze/room UI code.
- Relay wire delivery is a Sprint 2/3 decision checkpoint:
  - default bias: repo-owned HTTPS long-poll or server-driven queue delivery
  - allowed alternative: reuse the already-present `ws` dependency if it materially simplifies reconnect, push delivery, and attachment flow without violating the “no new dependency” goal
- End-to-end encryption uses Node `crypto` primitives under our control:
  - long-lived relay identity keys stored locally, outside `settings.json`
  - X25519 key agreement for shared secret derivation
  - HKDF-SHA256 for session key derivation
  - AES-256-GCM for message and attachment payload encryption
- The relay server stores encrypted envelopes, encrypted attachment chunks, routing metadata, and delivery state only. It must never require plaintext message or file content.
- Trust is security-first, not convenience-first:
  - the plan must explicitly lock TOFU vs pinned trust behavior
  - reinstall, key rotation, and trust reset must fail closed
  - filename metadata must be treated as an explicit confidentiality decision, not an implementation detail

## Current-State Findings

- US1 runtime delivery is currently mail-only:
  - handshake and invite lifecycle live in [electron/mail-identity-service.ts](/home/raistlin/hayalet-ev/electron/mail-identity-service.ts)
  - active message/file delivery lives in [electron/us1-conversation-service.ts](/home/raistlin/hayalet-ev/electron/us1-conversation-service.ts)
  - renderer IPC lives in [electron/handlers/ipc-us1-mail.ts](/home/raistlin/hayalet-ev/electron/handlers/ipc-us1-mail.ts)
- US1 slot settings currently have no communication-system selector:
  - [src/types/settings.ts](/home/raistlin/hayalet-ev/src/types/settings.ts)
  - [src/types/settings-defaults.ts](/home/raistlin/hayalet-ev/src/types/settings-defaults.ts)
  - [src/js/modules/settings/settings-schema.ts](/home/raistlin/hayalet-ev/src/js/modules/settings/settings-schema.ts)
- Entrance classic shows AI1/AI2 message/file method controls, but US1 has no equivalent communication-system selector:
  - [src/pages/entrance.html](/home/raistlin/hayalet-ev/src/pages/entrance.html)
  - [src/js/pages/entrance/slot-panel.ts](/home/raistlin/hayalet-ev/src/js/pages/entrance/slot-panel.ts)
- US1 management is currently split across:
  - Entrance slot UI: [src/pages/entrance.html](/home/raistlin/hayalet-ev/src/pages/entrance.html)
  - Settings US1 account panel: [src/pages/settings.html](/home/raistlin/hayalet-ev/src/pages/settings.html)
  - US1 settings controller: [src/js/pages/settings/accounts/us1-panel.ts](/home/raistlin/hayalet-ev/src/js/pages/settings/accounts/us1-panel.ts)
  - Scene Entrance bridge: [src/js/pages/entrance/scene/scene-entrance-bridge.ts](/home/raistlin/hayalet-ev/src/js/pages/entrance/scene/scene-entrance-bridge.ts)
- Analyze and room runtime already consume generic US1 send/sync calls, which is the best seam to preserve:
  - [src/js/pages/analyze.ts](/home/raistlin/hayalet-ev/src/js/pages/analyze.ts)
  - [src/js/modules/rooms/room-host-runtime.ts](/home/raistlin/hayalet-ev/src/js/modules/rooms/room-host-runtime.ts)
  - [src/js/modules/conversation-list-manager.ts](/home/raistlin/hayalet-ev/src/js/modules/conversation-list-manager.ts)
- Archive, search, scene, and room runtime currently assume `remote-email`-derived account identities for US1:
  - [src/types/archive.ts](/home/raistlin/hayalet-ev/src/types/archive.ts)
  - [electron/database/search-account-ids.ts](/home/raistlin/hayalet-ev/electron/database/search-account-ids.ts)
  - [src/js/scene/characters/scene-character-roster.ts](/home/raistlin/hayalet-ev/src/js/scene/characters/scene-character-roster.ts)
  - [src/js/modules/app-state.ts](/home/raistlin/hayalet-ev/src/js/modules/app-state.ts)
- Mail bias is deeper than send/sync:
  - `RemoteUserIdentity.linkedMailAccountId`
  - `Account.remoteEmail`
  - `Us1StateSnapshot.localMailAccounts`
  - `Us1StateSnapshot.selectedMailAccountId`
  - `Us1StateSnapshot.verifiedLocalMailAccountId`
- External relay access has a platform seam:
  - production `connect-src` is currently localhost-biased in [electron/window-manager.ts](/home/raistlin/hayalet-ev/electron/window-manager.ts)
  - if any relay networking leaves main process, CSP must be planned up front
- Renderer typing and Electron fallback also need to stay aligned:
  - [src/js/global.d.ts](/home/raistlin/hayalet-ev/src/js/global.d.ts)
  - [src/js/app/electron-fallback.ts](/home/raistlin/hayalet-ev/src/js/app/electron-fallback.ts)
- IPC registration is also part of the seam, not only preload:
  - [electron/handlers/ipc-us1-mail.ts](/home/raistlin/hayalet-ev/electron/handlers/ipc-us1-mail.ts)
  - [electron/main.ts](/home/raistlin/hayalet-ev/electron/main.ts)
  - [src/types/ipc-channels.ts](/home/raistlin/hayalet-ev/src/types/ipc-channels.ts)

## Prerequisites

- A reachable self-hosted relay endpoint with TLS termination strategy.
- A decision on relay deployment shape:
  - repo-owned Node service in the same repository
  - optionally fronted by reverse proxy in production
- Existing email handshake remains available and tested.
- Node 22 crypto support is available in all target environments.
- Existing US1 archive/session/thread projection behavior remains the source of truth for conversation history.

## Sprint 0: Lock Identity and Projection Contracts

**Goal**: Freeze the US1 identity/account model before adding transport fields, so relay does not break archive continuity or slot resolution.

**Demo/Validation**:

- The team has one explicit answer for whether relay reuses the existing projected/archive identity model.
- Mail-admin state and transport-neutral US1 runtime state are represented separately.
- Search, scene, archive, and room runtime seams have a named migration or reuse path.

### Task 0.1: Lock the US1 projected-account and archive contract

- **Location**: [src/types/archive.ts](/home/raistlin/hayalet-ev/src/types/archive.ts), [src/js/modules/app-state.ts](/home/raistlin/hayalet-ev/src/js/modules/app-state.ts), [electron/database/search-account-ids.ts](/home/raistlin/hayalet-ev/electron/database/search-account-ids.ts), [src/js/scene/characters/scene-character-roster.ts](/home/raistlin/hayalet-ev/src/js/scene/characters/scene-character-roster.ts), [src/js/modules/rooms/room-host-runtime.ts](/home/raistlin/hayalet-ev/src/js/modules/rooms/room-host-runtime.ts)
- **Description**: Decide whether relay reuses the existing `remote-email`-derived projected account shape for US1 or introduces a new projection seam, and document the migration or compatibility rule explicitly.
- **Complexity**: 7
- **Dependencies**: None
- **Acceptance Criteria**:
  - Archive account resolution remains stable across mail and relay.
  - Scene and room runtime still resolve the same remote identity without hidden account-shape drift.
  - Search-account collection and synthetic session URIs keep working after relay lands.
- **Validation**:
  - Add or extend regressions around archive account resolution and scene/runtime identity lookup.

### Task 0.2: Split transport-neutral US1 identity/runtime state from mail-admin state

- **Location**: [src/types/settings.ts](/home/raistlin/hayalet-ev/src/types/settings.ts), [src/types/us1-mail.ts](/home/raistlin/hayalet-ev/src/types/us1-mail.ts), [src/js/modules/settings/settings-schema.ts](/home/raistlin/hayalet-ev/src/js/modules/settings/settings-schema.ts), [electron/mail-identity-service.ts](/home/raistlin/hayalet-ev/electron/mail-identity-service.ts)
- **Description**: Separate mail transport administration data from US1 identity/runtime data so relay does not leak awkwardly into mail-shaped fields such as `linkedMailAccountId`, `remoteEmail`, `localMailAccounts`, and `verifiedLocalMailAccountId`.
- **Complexity**: 8
- **Dependencies**: Task 0.1
- **Acceptance Criteria**:
  - Transport-neutral US1 runtime state can describe either mail or relay.
  - Mail onboarding/admin state remains explicit rather than overloaded.
  - Backward compatibility for current settings and snapshots remains intentional.
- **Validation**:
  - Extend settings migration and mail-identity regressions.

## Sprint 1: Widen the US1 Contract

**Goal**: Make US1 transport-selectable without breaking the current mail path.

**Demo/Validation**:

- Old settings files still load with `mail` as the implicit default.
- The app can represent `mail` and `relay-e2ee` as valid US1 communication systems.
- Existing mail send/sync flows still pass through a transport adapter without UI regressions.

### Task 1.1: Add US1 communication-system types and defaults

- **Location**: [src/types/settings.ts](/home/raistlin/hayalet-ev/src/types/settings.ts), [src/types/settings-defaults.ts](/home/raistlin/hayalet-ev/src/types/settings-defaults.ts), [src/types/us1-mail.ts](/home/raistlin/hayalet-ev/src/types/us1-mail.ts), [src/js/modules/settings/settings-schema.ts](/home/raistlin/hayalet-ev/src/js/modules/settings/settings-schema.ts)
- **Description**: Add `Us1CommunicationSystem = "mail" | "relay-e2ee"` and extend `us1Slot` with transport-selection and relay readiness fields while preserving backward compatibility for existing settings snapshots.
- **Complexity**: 5
- **Dependencies**: None
- **Acceptance Criteria**:
  - Old settings normalize to `communicationSystem: "mail"`.
  - Invalid or missing values fall back safely.
  - No current mail-only UI or service path breaks on normalized settings.
- **Validation**:
  - Extend [scripts/tests/us1-settings-migration-regressions.test.ts](/home/raistlin/hayalet-ev/scripts/tests/us1-settings-migration-regressions.test.ts).
  - Run targeted normalization tests.

### Task 1.2: Introduce a transport-agnostic US1 service seam

- **Location**: [electron/us1-conversation-service.ts](/home/raistlin/hayalet-ev/electron/us1-conversation-service.ts), new transport modules under `/home/raistlin/hayalet-ev/electron/us1-transport/`
- **Description**: Extract a `Us1TransportFacade` contract so mail becomes one adapter implementation and relay can become the second implementation without rewriting Analyze or room runtime callers.
- **Complexity**: 7
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Existing mail send/sync paths run through the adapter.
  - Session, archive, room-event, and room-command projection stay in one shared place.
  - The active transport is resolved from `us1Slot.communicationSystem`.
- **Validation**:
  - Add regression coverage in [scripts/tests/us1-conversation-service-regressions.test.ts](/home/raistlin/hayalet-ev/scripts/tests/us1-conversation-service-regressions.test.ts).

### Task 1.3: Keep renderer-facing and IPC-facing US1 APIs stable

- **Location**: [electron/preload.cjs](/home/raistlin/hayalet-ev/electron/preload.cjs), [src/js/global.d.ts](/home/raistlin/hayalet-ev/src/js/global.d.ts), [src/js/app/electron-fallback.ts](/home/raistlin/hayalet-ev/src/js/app/electron-fallback.ts), [src/types/ipc-channels.ts](/home/raistlin/hayalet-ev/src/types/ipc-channels.ts), [electron/handlers/ipc-us1-mail.ts](/home/raistlin/hayalet-ev/electron/handlers/ipc-us1-mail.ts), [electron/main.ts](/home/raistlin/hayalet-ev/electron/main.ts)
- **Description**: Freeze `us1SendMessage` and `us1SyncMessages` as the public renderer API and explicitly plan the IPC registration/main-process handler shape so transport switching stays inside Electron/main-process code without module drift.
- **Complexity**: 4
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - Analyze and room runtime do not need per-transport branching.
  - Fallback typings remain compile-safe.
- **Validation**:
  - Run `npm run typecheck`.
  - Add a small regression around the preload typing surface if needed.

### Task 1.4: Add shared relay settings containers

- **Location**: [src/types/settings.ts](/home/raistlin/hayalet-ev/src/types/settings.ts), [src/js/modules/settings/settings-schema.ts](/home/raistlin/hayalet-ev/src/js/modules/settings/settings-schema.ts)
- **Description**: Add a settings namespace for relay endpoint/configuration and local key metadata, distinct from the current `integrations.mailTransport` object.
- **Complexity**: 5
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Relay configuration does not pollute mail-only settings.
  - Local private key storage is not serialized directly into `settings.json`.
- **Validation**:
  - Extend settings normalization coverage.

## Sprint 2: Define Identity, E2EE, and Relay Protocol

**Goal**: Lock the security model before wiring UI or runtime behavior.

**Demo/Validation**:

- The app can generate and reload a stable local relay identity.
- Email handshake/profile sync can carry optional relay capability metadata.
- The relay protocol can encrypt, decrypt, detect tampering, and reject replay candidates.

### Task 2.1: Create local relay identity and key storage

- **Location**: new files under `/home/raistlin/hayalet-ev/electron/us1-relay/`, plus settings metadata in [src/types/settings.ts](/home/raistlin/hayalet-ev/src/types/settings.ts)
- **Description**: Create a local key service that generates long-lived US1 relay identity keys, stores private material under app data, and exposes only public fingerprints and capability metadata to the rest of the app.
- **Complexity**: 8
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Private keys are stored outside `settings.json`.
  - Public identity metadata can be shown in UI and sent to the peer.
  - Identity survives app restart.
- **Validation**:
  - Add a dedicated key-service regression suite.

### Task 2.2: Extend handshake/profile sync with relay capability metadata

- **Location**: [electron/mail-identity-service.ts](/home/raistlin/hayalet-ev/electron/mail-identity-service.ts), [src/types/us1-mail.ts](/home/raistlin/hayalet-ev/src/types/us1-mail.ts), [src/types/settings.ts](/home/raistlin/hayalet-ev/src/types/settings.ts)
- **Description**: Add optional relay capability fields to invite/accept/profile payloads so existing email handshake can bootstrap relay eligibility, public key fingerprints, supported protocol versions, and relay endpoint hints.
- **Complexity**: 8
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Old peers without relay capability remain valid mail-only peers.
  - New peers can advertise relay readiness after handshake without breaking legacy parsing.
  - Capability drift is versioned and explicit.
- **Validation**:
  - Extend [scripts/tests/mail-identity-service-regressions.test.ts](/home/raistlin/hayalet-ev/scripts/tests/mail-identity-service-regressions.test.ts).

### Task 2.3: Define the encrypted envelope and chunk protocol

- **Location**: new shared protocol files under `/home/raistlin/hayalet-ev/src/types/` and `/home/raistlin/hayalet-ev/electron/us1-relay/`
- **Description**: Define message, ack, poll cursor, file-chunk, and error envelopes with explicit fields for `messageId`, `sessionId`, `sequence`, `ciphertext`, `nonce`, `authTag`, `aadHash`, `contentHash`, and attachment chunk metadata.
- **Complexity**: 9
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Text, room events, room commands, and file chunks all share one authenticated envelope model.
  - Replay, stale sequence, and tamper detection are supported by the protocol shape itself.
  - Message and file payload limits are explicit.
- **Validation**:
  - Add protocol/crypto tests for tampering, wrong key, stale sequence, and content-hash mismatch.

### Task 2.4: Freeze v1 crypto primitives and key-derivation flow

- **Location**: new crypto helpers under `/home/raistlin/hayalet-ev/electron/us1-relay/`
- **Description**: Lock the v1 cryptographic recipe so implementation and docs do not drift:
  - X25519 for key agreement
  - HKDF-SHA256 for key derivation
  - AES-256-GCM for AEAD
  - signed capability/auth payloads for client-to-relay authentication
- **Complexity**: 7
- **Dependencies**: Task 2.3
- **Acceptance Criteria**:
  - The team has one canonical crypto contract.
  - Fallbacks and version upgrades are documented.
  - The plan explicitly avoids “homegrown but undefined” crypto behavior.
- **Validation**:
  - Crypto helper unit tests plus a short protocol spec document.

### Task 2.5: Lock trust bootstrap, key lifecycle, and metadata confidentiality

- **Location**: new relay security docs/helpers under `/home/raistlin/hayalet-ev/electron/us1-relay/`, plus UI-facing state in [src/types/settings.ts](/home/raistlin/hayalet-ev/src/types/settings.ts)
- **Description**: Explicitly define:
  - TOFU vs pinned trust behavior
  - reinstall and trust-reset handling
  - key rotation rules
  - relay authentication bootstrap
  - whether filenames are encrypted or exposed as server-visible metadata
- **Complexity**: 8
- **Dependencies**: Task 2.4
- **Acceptance Criteria**:
  - Trust mismatch behavior is fail-closed and user-visible.
  - Reinstall or rotated keys do not silently impersonate an existing peer.
  - Attachment metadata confidentiality is an explicit product decision.
- **Validation**:
  - Add security regressions and a concise trust-state spec.

## Sprint 3: Build the Repo-Owned Relay Stack

**Goal**: Deliver a self-hosted relay server and a matching client implementation controlled by this repository.

**Demo/Validation**:

- A repo-owned relay server can accept an authenticated client.
- The server can queue encrypted envelopes and encrypted file chunks.
- Two local/dev clients can exchange encrypted text without mail delivery.

### Task 3.1: Implement the relay server skeleton

- **Location**: new server files under `/home/raistlin/hayalet-ev/electron/us1-relay-server/` or `/home/raistlin/hayalet-ev/scripts/us1-relay/`
- **Description**: Build a self-hosted relay service with repo-owned request handlers for:
  - registration/auth handshake
  - publish encrypted envelope
  - long-poll or queued fetch
  - ack/delete
  - encrypted file-chunk upload/download
- **Complexity**: 9
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - The relay stores only encrypted payloads and route metadata.
  - Server logs do not include plaintext message or filename content.
  - Publish/fetch semantics are deterministic and idempotent.
- **Validation**:
  - Add a server regression suite and a local dev smoke script.

### Task 3.2: Implement relay-side queue and attachment storage

- **Location**: new storage helpers under `/home/raistlin/hayalet-ev/electron/us1-relay-server/`
- **Description**: Add queue storage, dedupe keys, attachment-chunk persistence, blob cleanup, and retention rules for the relay service. Prefer a filesystem-first storage layout in v1 if the “no package dependency” constraint is interpreted strictly for the server path.
- **Complexity**: 8
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Duplicate publish attempts do not duplicate delivery.
  - Chunk assembly and resume rules are explicit.
  - Cleanup policies do not delete undelivered ciphertext.
- **Validation**:
  - Storage regression tests for duplicate publish, partial upload, resume, and cleanup.

### Task 3.3: Build the Electron relay client manager

- **Location**: new client files under `/home/raistlin/hayalet-ev/electron/us1-relay/`
- **Description**: Implement client-side connect, signed auth, heartbeat, long-poll fetch, publish, ack, backoff, and capability checks against the self-hosted relay.
- **Complexity**: 8
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - The client can connect and re-connect safely.
  - The client can fetch encrypted payloads without blocking the UI.
  - Health status can be surfaced to the renderer.
- **Validation**:
  - Add client/server integration tests.

### Task 3.4: Add a relay transport adapter behind US1 conversation flow

- **Location**: [electron/us1-conversation-service.ts](/home/raistlin/hayalet-ev/electron/us1-conversation-service.ts), new relay adapter files under `/home/raistlin/hayalet-ev/electron/us1-transport/`
- **Description**: Implement the relay adapter so the existing US1 conversation service can send, sync, decrypt, dedupe, and project relay payloads through the same archive/session logic currently used by mail.
- **Complexity**: 9
- **Dependencies**: Task 3.3
- **Acceptance Criteria**:
  - Analyze and room runtime still call the same renderer API.
  - Relay delivery reuses existing archive projection as much as possible.
  - Mail and relay transport implementations can coexist cleanly.
- **Validation**:
  - Extend [scripts/tests/us1-conversation-service-regressions.test.ts](/home/raistlin/hayalet-ev/scripts/tests/us1-conversation-service-regressions.test.ts).

### Task 3.5: Expose relay capability and transport-aware readiness state before UI rollout

- **Location**: [src/js/modules/app-state.ts](/home/raistlin/hayalet-ev/src/js/modules/app-state.ts), [src/js/pages/settings/accounts/us1-panel.ts](/home/raistlin/hayalet-ev/src/js/pages/settings/accounts/us1-panel.ts), [src/js/pages/analyze.ts](/home/raistlin/hayalet-ev/src/js/pages/analyze.ts), [src/js/pages/entrance.ts](/home/raistlin/hayalet-ev/src/js/pages/entrance.ts), [src/js/pages/entrance/scene/scene-entrance-bridge.ts](/home/raistlin/hayalet-ev/src/js/pages/entrance/scene/scene-entrance-bridge.ts)
- **Description**: Refactor transport-aware US1 readiness, capability, and connection-state exposure before the selector lands, so UI disable reasons and connection indicators are accurate from day one.
- **Complexity**: 8
- **Dependencies**: Task 3.4
- **Acceptance Criteria**:
  - `AppState.isUs1Connected()` no longer assumes mail-only semantics.
  - UI surfaces can distinguish mail-ready, relay-capable, relay-configured, relay-connected, and fallback-only states.
  - Analyze and settings no longer depend solely on verified local mail account state for all US1 readiness copy.
- **Validation**:
  - Extend US1 app-state, settings-panel, and Analyze regressions.

### Task 3.6: Lock external-relay networking seam

- **Location**: [electron/window-manager.ts](/home/raistlin/hayalet-ev/electron/window-manager.ts), relay client modules under `/home/raistlin/hayalet-ev/electron/us1-relay/`
- **Description**: Decide whether all relay networking stays strictly in main process or whether CSP/connect-src must be widened for renderer-visible network paths. Capture this as an explicit implementation rule before UI rollout.
- **Complexity**: 5
- **Dependencies**: Task 3.3
- **Acceptance Criteria**:
  - External relay access cannot be blocked by an unplanned CSP restriction.
  - The transport path is explicit about renderer vs main-process networking responsibility.
- **Validation**:
  - Add a small connectivity smoke case against a non-local relay endpoint.

## Sprint 4: Wire Entrance, Scene, and Settings UX

**Goal**: Expose relay selection and relay configuration clearly without breaking current mail onboarding.

**Demo/Validation**:

- US1 Entrance card shows a communication-system selector.
- Scene Entrance reflects the same selector and disable logic.
- Settings let the user configure relay endpoint and inspect local relay identity state.

### Task 4.1: Add the US1 communication-system selector to classic Entrance

- **Location**: [src/pages/entrance.html](/home/raistlin/hayalet-ev/src/pages/entrance.html), [src/styles/entrance/slot.css](/home/raistlin/hayalet-ev/src/styles/entrance/slot.css), [src/js/pages/entrance.ts](/home/raistlin/hayalet-ev/src/js/pages/entrance.ts) or the current US1 controller wiring
- **Description**: Add a selector in the US1 slot card, visually aligned with the AI1/AI2 communication controls, with options:
  - `Mail`
  - `Self-hosted relay + E2EE`
- **Complexity**: 6
- **Dependencies**: Task 3.5 and Task 3.6
- **Acceptance Criteria**:
  - The selector persists to settings.
  - It is disabled or annotated when the remote user is not relay-capable yet.
  - Existing connect/disconnect controls remain readable and consistent.
- **Validation**:
  - Manual Entrance smoke.
  - Add UI regression assertions if an existing suite is available.

### Task 4.2: Add the same selector to scene Entrance

- **Location**: [src/js/pages/entrance/scene/scene-entrance-bridge.ts](/home/raistlin/hayalet-ev/src/js/pages/entrance/scene/scene-entrance-bridge.ts)
- **Description**: Mirror the same US1 communication-system state into the scene-based Entrance menu so classic and scene mode do not drift.
- **Complexity**: 6
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Scene and classic mode read/write the same US1 setting.
  - Disable reasons and status copy match between surfaces.
- **Validation**:
  - Add scene-bridge regression coverage or targeted smoke checks.

### Task 4.3: Add relay configuration and status to the Settings US1 panel

- **Location**: [src/pages/settings.html](/home/raistlin/hayalet-ev/src/pages/settings.html), [src/js/pages/settings/accounts/us1-panel.ts](/home/raistlin/hayalet-ev/src/js/pages/settings/accounts/us1-panel.ts)
- **Description**: Expand the US1 panel with relay-specific fields and diagnostics:
  - relay base URL
  - optional server fingerprint / trust hint
  - local device identity fingerprint
  - remote relay capability status
  - relay connect/test controls
- **Complexity**: 7
- **Dependencies**: Task 3.5 and Task 3.6
- **Acceptance Criteria**:
  - Mail setup remains intact and separate.
  - Relay setup is understandable without exposing raw private key material.
  - Diagnostics explain why relay cannot be selected when capability is missing.
- **Validation**:
  - Add renderer/controller regressions for saved form state.

### Task 4.4: Add copy, status, and error states for relay transport

- **Location**: [shared/languages/en/index.json](/home/raistlin/hayalet-ev/shared/languages/en/index.json), [shared/languages/tr/index.json](/home/raistlin/hayalet-ev/shared/languages/tr/index.json)
- **Description**: Add i18n strings for:
  - transport selector labels
  - relay unavailable / untrusted / disconnected states
  - key mismatch or capability mismatch states
  - encrypted attachment transfer progress and failure messages
- **Complexity**: 4
- **Dependencies**: Task 4.3
- **Acceptance Criteria**:
  - No raw internal error leaks into normal user-facing copy.
  - Both locales remain aligned.
- **Validation**:
  - Run any i18n/lint checks already used by the team.

## Sprint 5: Integrate Analyze, Rooms, Attachments, and Lifecycle

**Goal**: Make US1 feel transport-agnostic at the application level.

**Demo/Validation**:

- Analyze can send and receive US1 text over either transport.
- Attachments and room packages work over relay.
- Room event and room command flows remain US1-agnostic and archive-safe.

### Task 5.1: Finish transport-aware US1 consumers beyond the primary selector surfaces

- **Location**: [src/js/modules/conversation-list-manager.ts](/home/raistlin/hayalet-ev/src/js/modules/conversation-list-manager.ts), [src/js/pages/analyze.ts](/home/raistlin/hayalet-ev/src/js/pages/analyze.ts), [src/js/pages/entrance/scene/scene-connect-actions.ts](/home/raistlin/hayalet-ev/src/js/pages/entrance/scene/scene-connect-actions.ts), [src/js/pages/settings/accounts/account-panel.ts](/home/raistlin/hayalet-ev/src/js/pages/settings/accounts/account-panel.ts)
- **Description**: Audit and update the broader set of consumers that still assume mail-shaped US1 bindings or mail-centric readiness copy, so the new selector does not leave hidden regressions in scene connect actions, account deletion, conversation refresh, or Analyze send logic.
- **Complexity**: 6
- **Dependencies**: Sprint 4
- **Acceptance Criteria**:
  - Non-primary US1 consumers do not silently assume mail-only behavior.
  - Deletion, refresh, selection, and scene bridge flows stay coherent after relay support lands.
  - Mail mode remains unchanged where relay is not configured.
- **Validation**:
  - Extend Analyze, scene, and account-panel regressions where available.

### Task 5.2: Add encrypted attachment and room-package transfer

- **Location**: [electron/us1-conversation-service.ts](/home/raistlin/hayalet-ev/electron/us1-conversation-service.ts), new relay attachment helpers under `/home/raistlin/hayalet-ev/electron/us1-relay/`, [src/js/pages/analyze.ts](/home/raistlin/hayalet-ev/src/js/pages/analyze.ts)
- **Description**: Encrypt and chunk outbound attachments client-side, deliver them through the relay, reassemble and decrypt them on receive, and preserve the current room-package import flow.
- **Complexity**: 9
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - Generic attachments work in relay mode.
  - Room package attachments still trigger the existing approval/import flow.
  - Attachment metadata in archive remains coherent across transports.
- **Validation**:
  - Extend [scripts/tests/us1-conversation-service-regressions.test.ts](/home/raistlin/hayalet-ev/scripts/tests/us1-conversation-service-regressions.test.ts).
  - Add attachment-specific relay tests.

### Task 5.3: Preserve room-event and room-command transport neutrality

- **Location**: [electron/us1-conversation-service.ts](/home/raistlin/hayalet-ev/electron/us1-conversation-service.ts), [src/js/modules/rooms/room-host-runtime.ts](/home/raistlin/hayalet-ev/src/js/modules/rooms/room-host-runtime.ts), room regression suites under `/home/raistlin/hayalet-ev/scripts/tests/`
- **Description**: Make sure `roomEvent` and `roomCommand` payloads are carried over relay and projected into the same room runtime entry points currently used by mail.
- **Complexity**: 8
- **Dependencies**: Task 5.2
- **Acceptance Criteria**:
  - Room features do not need to branch on mail vs relay.
  - Incoming US1 room events remain deduped and archive-safe.
  - Existing XOX-over-US1 work stays compatible.
- **Validation**:
  - Run the relevant US1/XOX room regression suites.

### Task 5.4: Add relay-aware polling, backoff, and resume behavior

- **Location**: [src/js/pages/analyze.ts](/home/raistlin/hayalet-ev/src/js/pages/analyze.ts), [src/js/pages/settings/accounts/us1-panel.ts](/home/raistlin/hayalet-ev/src/js/pages/settings/accounts/us1-panel.ts), relay client modules
- **Description**: Replace fixed mail-only polling assumptions with transport-aware scheduling:
  - mail keeps interval-based inbox sync
  - relay uses long-poll fetch, heartbeat, reconnect backoff, and optional resume
- **Complexity**: 7
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - Relay mode does not rely on mail inbox polling cadence.
  - Disconnect/reconnect state is explicit and recoverable.
- **Validation**:
  - Add integration smoke for reconnect and backoff.

## Sprint 6: Hardening, Packaging, and Rollout Safety

**Goal**: Turn the new transport into a secure, supportable, and reversible feature.

**Demo/Validation**:

- A full smoke path works:
  - email handshake
  - relay capability sync
  - relay selection in Entrance
  - encrypted text send
  - encrypted attachment send
  - room package receive
- Mail remains available as a fallback.

### Task 6.1: Add replay, tamper, and trust hardening

- **Location**: relay crypto/client/server modules under `/home/raistlin/hayalet-ev/electron/us1-relay/` and `/home/raistlin/hayalet-ev/electron/us1-relay-server/`
- **Description**: Add message replay markers, stale cursor rejection, signature/fingerprint checks, size caps, and safe disconnect behavior when trust state changes.
- **Complexity**: 8
- **Dependencies**: Sprint 5
- **Acceptance Criteria**:
  - Replayed or tampered ciphertext is rejected safely.
  - Trust mismatch forces a visible, non-silent failure.
  - Relay cannot silently downgrade to insecure behavior.
- **Validation**:
  - Dedicated security regression tests.

### Task 6.2: Add repo-owned relay server scripts and deployment surface

- **Location**: [package.json](/home/raistlin/hayalet-ev/package.json), new relay scripts under `/home/raistlin/hayalet-ev/scripts/`
- **Description**: Add scripts for local development and operator workflows, for example:
  - relay dev
  - relay start
  - relay smoke
  - relay key inspection
- **Complexity**: 5
- **Dependencies**: Task 6.1
- **Acceptance Criteria**:
  - A teammate can start the relay service without reverse-engineering the code.
  - Local smoke and packaged workflows are both documented.
- **Validation**:
  - Run the relay smoke script and verify end-to-end local exchange.

### Task 6.3: Expand regression and smoke coverage

- **Location**: existing and new tests under `/home/raistlin/hayalet-ev/scripts/tests/`
- **Description**: Add targeted coverage for:
  - settings migration
  - mail handshake backward compatibility
  - relay identity persistence
  - crypto tamper/replay rejection
  - relay client/server queue semantics
  - Analyze send/receive over relay
  - attachment and room package transfer
  - room-event and room-command over relay
- **Complexity**: 7
- **Dependencies**: Task 6.2
- **Acceptance Criteria**:
  - Every major transport seam has automated coverage.
  - Mail-only behavior still passes after the new transport lands.
- **Validation**:
  - Run targeted suites and `npm run typecheck`.

## Testing Strategy

- Unit tests:
  - settings normalization and migration
  - relay identity storage
  - crypto primitives and envelope validation
  - relay queue and attachment storage behavior
- Service-level tests:
  - mail identity backward compatibility
  - relay adapter inside US1 conversation service
  - dedupe, replay rejection, reconnect, and fallback behavior
- UI/controller tests:
  - classic Entrance US1 selector and disable states
  - scene Entrance parity
  - settings panel save/load and diagnostics
- Integration smoke:
  - handshake over mail
  - relay enablement after capability sync
  - encrypted text exchange
  - encrypted file exchange
  - room package import path
  - room command/event delivery over US1
- Mandatory verification:
  - `npm run typecheck`
  - targeted regression suites for US1, rooms, and settings

## Potential Risks & Gotchas

- The phrase “no package dependency” can mean either:
  - no new dependency
  - absolutely no third-party runtime dependency at all
  Mitigation:
  - keep v1 on Node built-ins and existing repository runtime
  - avoid introducing a new transport library
  - explicitly document this assumption before implementation starts

- A relay transport cannot be considered trustworthy without explicit peer trust material.
  Mitigation:
  - exchange relay capability metadata through the existing mail handshake
  - surface fingerprints in UI
  - fail closed on trust mismatch

- Private key storage in `settings.json` would be a serious regression.
  Mitigation:
  - store private keys under app data with a dedicated key service
  - keep only public fingerprints or references in settings

- `AppState.isUs1Connected()` is currently mail-biased.
  Mitigation:
  - make connection semantics transport-aware before UI rollout

- Analyze, room runtime, and conversation list all currently assume the same send/sync entry points.
  Mitigation:
  - preserve renderer API and move transport branching into Electron/main-process services

- Attachment transfer can dwarf text-message complexity.
  Mitigation:
  - define chunking, hashing, cleanup, and resume rules before coding UI
  - ship text-only relay first if attachment work blocks the core path

- Filename metadata can become a hidden confidentiality leak.
  Mitigation:
  - explicitly decide whether the relay sees plaintext filenames
  - if not, use opaque attachment ids server-side and decrypt names client-side only

- Scene and classic Entrance can drift.
  Mitigation:
  - treat both surfaces as part of the same sprint
  - do not mark the feature done until both paths are wired

- Mail-only peers must keep working.
  Mitigation:
  - make relay capability optional
  - preserve `mail` as the default and fallback transport

- Relay server deployment can become the hidden blocker.
  Mitigation:
  - include dev/start/smoke scripts in the plan
  - keep storage and auth simple in v1

- External relay networking can fail late if CSP and main-process ownership are not decided early.
  Mitigation:
  - lock renderer-vs-main-process networking responsibility before UI rollout
  - add a non-local endpoint smoke case before calling the transport ready

## Rollback Plan

- Preserve `mail` as the default communication system until relay is fully verified.
- Ship relay behind a transport selection toggle rather than silently auto-switching all active US1 users.
- If relay runtime proves unstable:
  - keep handshake and archive code unchanged
  - switch the selected communication system back to `mail`
  - disable relay selection in UI while leaving saved relay config intact
- Keep mail adapter coverage green so rollback does not require data migration.
- If the relay server or E2EE contract must change incompatibly, bump protocol version and fall back to mail rather than attempting silent downgrade.
