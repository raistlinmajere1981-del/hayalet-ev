# Plan: Toast System Symmetry

**Generated**: 2026-03-22
**Estimated Complexity**: Medium

## Overview
Align the user-facing toast experience across AI0, AI1, AI2, and US1 without increasing noise. The implementation keeps inline form hints for validation, moves high-value user outcomes into a shared toast helper, and standardizes account, slot, and US1 invite flows around the same notification rules.

## Prerequisites
- Existing global toast system in `src/js/ui/toast-manager.ts`
- Existing inline feedback areas in Settings and Entrance panels
- Translation coverage in `shared/languages/tr/index.json` and `shared/languages/en/index.json`

## Sprint 1: Notification Foundation
**Goal**: Introduce a shared notification helper that can drive both toast and inline feedback.
**Demo/Validation**:
- Trigger the helper from a dev console or a small integration point
- Verify toast dedupe works for repeated actions
- Verify inline feedback still animates and clears correctly

### Task 1.1: Add Shared User Notification Helper
- **Location**: `src/js/ui/user-notification.ts`
- **Description**: Create a small helper that can render toast notifications, update inline status nodes, and dedupe repeated high-frequency notifications by key.
- **Dependencies**: None
- **Acceptance Criteria**:
  - Supports `success`, `error`, `warning`, and `info`
  - Can target an inline status node by id or element
  - Can dedupe repeated toasts during their active lifetime
- **Validation**:
  - TypeScript syntax check for the new file

### Task 1.2: Define Slot Assignment Copy
- **Location**: `shared/languages/tr/index.json`, `shared/languages/en/index.json`
- **Description**: Add shared copy for slot assignment and slot clearing so AI1, AI2, and US1 can all use the same notification language.
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Copy exists in both locales
  - No literal toast strings are introduced in source
- **Validation**:
  - Existing i18n regression checks continue to pass

## Sprint 2: Slot Symmetry
**Goal**: Make AI0, AI1, AI2, and US1 emit user-facing notifications for the same class of important actions.
**Demo/Validation**:
- Assign or clear AI1 and AI2 accounts from the Entrance surface
- Connect and disconnect AI1, AI2, and AI0
- Select and clear the US1 bound account

### Task 2.1: Notify AI1 and AI2 Account Assignment Changes
- **Location**: `src/js/pages/entrance/slot-panel.ts`
- **Description**: Emit shared assignment/clear notifications when a slot account changes.
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - AI1 and AI2 both show the same style of notification
  - Assignment updates do not fire for unrelated setting changes
- **Validation**:
  - Manual smoke on both slot selectors

### Task 2.2: Normalize AI1 and AI2 Connection Notifications
- **Location**: `src/js/pages/entrance.ts`
- **Description**: Keep button-local loading states, but show toast outcomes only for blocked connect, success, and failure states.
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Connecting and disconnecting loading copy stays off toast
  - Success and failure paths surface as user-visible notifications
- **Validation**:
  - Manual smoke on connect/disconnect flows

### Task 2.3: Normalize AI0 Connection and Identity Notifications
- **Location**: `src/js/pages/assistant/connection-lifecycle.ts`, `src/js/pages/assistant/assistant.ts`
- **Description**: Route AI0 connection success/failure and AI0 identity updates through the shared notification path.
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - AI0 connect success and disconnect success are visible to the user
  - Nickname and avatar update success/failure are surfaced as toasts
  - Existing logs remain intact without double-toasting
- **Validation**:
  - Manual smoke on assistant connect and identity edit flows

## Sprint 3: Account and US1 Cleanup
**Goal**: Replace scattered inline-only outcomes with a cleaner mix of inline guidance and toast outcomes.
**Demo/Validation**:
- Add, update, and delete an AI account
- Save, verify, and delete a user mail account
- Send, sync, accept, and reject US1 remote invites

### Task 3.1: Normalize AI Account CRUD Notifications
- **Location**: `src/js/pages/settings/accounts/account-panel.ts`
- **Description**: Keep validation errors inline, but surface create, update, delete, and remote invite outcomes through the shared helper.
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - AI account create/update/delete each produce a clear user-facing notification
  - Remote invite send, accept, reject, and sync outcomes are visible
  - Generic duplicate toasts are removed
- **Validation**:
  - Manual smoke in Settings > Accounts

### Task 3.2: Normalize User Mail and US1 Slot Notifications
- **Location**: `src/js/pages/settings/accounts/us1-panel.ts`
- **Description**: Keep form validation inline, but route save/verify/delete mail account outcomes, US1 connect/disconnect, manual sync, and US1 slot binding changes through the shared helper.
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Mail account success/failure outcomes are user-visible
  - US1 connect/disconnect and sync outcomes are user-visible
  - US1 slot binding changes follow the same assignment language as AI1/AI2
- **Validation**:
  - Manual smoke in Settings > User & Drive / US1

### Task 3.3: Add Missing Room-Level Invite Outcome Toasts
- **Location**: `rooms/game-room/host/index.js`
- **Description**: Preserve the existing incoming invite toast and add missing accept/reject room outcome toasts where they improve remote invite visibility.
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Incoming US1 invite toast remains intact
  - Remote accept/reject outcomes are surfaced without duplicate spam
- **Validation**:
  - Existing XOX US1 regression coverage remains green

## Testing Strategy
- Run syntax checks for every edited source file
- Run targeted regressions for XOX US1 invite handling if room host copy changes
- Run targeted manual smoke for:
  - AI1/AI2 account assignment
  - AI1/AI2 connect and disconnect
  - AI0 connect and identity edits
  - AI account CRUD
  - User mail save/verify/delete
  - US1 invite send/sync/accept/reject

## Potential Risks & Gotchas
- `Logger.success` and `Logger.error` already integrate with toasts, so keeping them unchanged can create duplicate notifications
- Inline feedback is still useful for validation and panel-local guidance; converting every inline state to toast would increase noise
- US1 flows span Settings and room host layers, so duplicate invite messaging is possible if dedupe keys are not chosen carefully
- The worktree is already dirty, so edits must stay scoped to the toast-related surfaces only

## Rollback Plan
- Remove `src/js/ui/user-notification.ts`
- Revert notification call sites back to their prior inline/log behavior
- Remove any newly added locale keys that are only used by the notification refactor
