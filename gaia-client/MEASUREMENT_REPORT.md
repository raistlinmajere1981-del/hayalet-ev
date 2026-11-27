# B6 Android Client — measurement and compatibility

27 November 2026 · base `d8ada18a` · independent acceptance pending.

| Target | Result |
| --- | --- |
| Android JVM regressions | 118 passed, 0 failed, 0 errors, 0 skipped |
| Central Gaia regressions | 180 passed |
| Shared v1 protocol tests | 11 passed |
| Android build | Debug application and instrumentation APKs built in a serial Gradle run |
| Installable artifact | `app/build/outputs/apk/debug/app-debug.apk`, 12,866,938 bytes, SHA-256 `f03467c5324ab80788c2738aa3e8b6e11499811a5248ef1bfe3a2ab6cd733746` |

## SM-J701F, Android 9 / API 28

The installed SM-J701F APK matched the build artifact by SHA-256. The measurement runner used a disposable installation and aliases. The Keystore returned an EC key of 256 bits. Its private encoding was unavailable. `KeyInfo.isInsideSecureHardware` returned **false** for this key. The successful CSR signature used the private key through Android Keystore. [Android Keystore](https://developer.android.com/privacy-and-security/keystore)

The B3/2 center inspected the phone's version 1 USB request, verified its PKCS#10 signature, P-256 SPKI and empty attributes, then issued an installation for a synthetic inventory device. The phone reported **1 January 2017 UTC**. Import of the current certificate raised `CertificateNotYetValidException`. Reading an active identity after the failed import also failed. The operator must compare the phone clock against the trusted center and correct it before a positive device handshake can be measured. System time, Wi-Fi, ROM, root and system trust settings were left as found.

On the phone the private resolver returned loopback for `localhost`. The instrumented Activity requested Android’s JSON create/open document intents. The picker results were cancelled. Starting collection from the unpaired Activity displayed the installation error and stopped the service. The visible-Activity assertion was run with the screen awake. The screen-off run could not observe a periodic UI refresh. Positive Android mTLS, device ACK, and sustained transport memory and power measurements remain open.

## Host interoperability and failure behavior

The JVM client generated its own EC key and signed its request. The test receiver listened on loopback with a newly provisioned B3/2 CA, inventory and signing medium. It required a client certificate, looked up the peer through `withVerifiedClient` on requests, and exercised actual B3 enrollment, completion and revocation. Responses used a test HTTP handler. [Receiver source](app/src/test/interop/center.mts)

- TLS 1.2 negotiated ECDHE-ECDSA with AEAD. The default host handshake negotiated TLS 1.3. Verified observations received matching ACKs. A wrong server SAN failed before an HTTP request reached the receiver.
- USB tests covered an incorrect trusted CA pin, wrong local key, mismatched private half, client/server EKU, certificate date bounds, changed signed fields, malformed DER/Base64, truncation, missing keys and corrupt local state. An obstructed atomic write during renewal left the original identity active. Retrying the same signed package switched to the verified replacement. Replaying the retired package failed.
- The shared response and ACK fixtures exercised accepted capability subsets, exact types and fields, UTF-8, duplicate and prototype keys, depth and safe integer bounds. Framing tests covered truncated reads, excessive body and header sizes, ambiguous framing and oversized chunks.
- After wrong ACK, EOF, redirect and a 503 with a seven-second retry delay, the receiver saw five attempts with one body hash. Only the valid ACK advanced the engine. Revocation produced terminal 403. Session expiry discarded the previous session's pending bytes.
- During both a stalled session open and a stalled observation, engine Stop released the actual socket. The receiver observed close and the test joined the pending job within one second. The deadline worker disappeared. Other tests exercised request timeout, wall-clock displacement during I/O, and continuing cleanup when transport close throws.

The 103 B5 test cases remain represented. Two wrong-ACK cases now require retry of the frozen packet and the generic rejection case now requires terminal shutdown. Fifteen additional regressions cover B6. The debug APK contains the field adapter. The local fake is confined to test code.

## Cleanup and reproduction

The probe removed its disposable aliases and cache. The instrumentation APK was uninstalled after measurement. Final inspection found no Gaia Client service or USB reverse on the selected device. The test process closed its loopback listener and removed its temporary authority and signing medium. All device commands selected the SM-J701F. The targeted build commands and probe invocation are in the [client README](README.md).

## Independent B6 closure (Nexa)

The initial JVM suite was rerun (118/118); central Gaia (180/180) and
shared protocol (11/11) passed independently. With operator approval, the
SM-J701F clock was corrected via Android Date and time settings, from
1 January 2017 to 27 November 2026. Automatic network time was disabled;
the clock was about 20 seconds behind the trusted center. ADB shell lacked
permission to set the clock. The bounded probe wait allows newly issued
certificates to reach their actual validity start without backdating or
bypassing verification.

Two positive disposable Android Keystore probes passed: the center verified
the signed CSR, the phone imported the signed package, established mutual TLS,
opened a session and received an ACK for an empty accepted observation set.
The device reported 256-bit, nonexportable and hardware=false again. The
second probe used the final APK. These are instrumentation tests against the
temporary B3/2 test receiver, not B7 production status publication.

The process-wide FieldUseGate now excludes installation mutations and active
or draining collection. Three added JVM tests cover old Activity ownership,
stale release and concurrent acquisition. Final Android JVM: 121 passed,
zero failures/errors/skips; application and instrumentation APK build passed
(69 Gradle tasks, 18 executed). Final APK: 12866938 bytes, SHA-256
`5012c5fdbc69b7a14122612b6667edc9fadd126fb437540b7aa3c270866458ec`, matching the installed device APK.
Disposable keys/cache, instrumentation APK, USB reverse and temporary receiver
were cleaned; no Client service remains running. The personal phone, Wi-Fi,
ROM/root and actual projects were not changed. Real Activity rotation during
import, real sensor status publication, LAN, reboot clock retention and
long-duration performance remain open. B6 is accepted in this targeted
scope; full check:all was not run.

# B5 Android Client — Measurement Report

Date: 27 November 2026
Base commit: `583a72bc`
Scope: B5 and B5-R (hardware collection, foreground service, local test transport)

## Build and JVM tests

- `./gradlew :app:assembleDebug` → `BUILD SUCCESSFUL`.
- `./gradlew :app:testDebugUnitTest` → 101 tests, 0 failures, 0 errors,
  0 skipped.
- The three Nexa regressions now pass, together with new lifecycle and
  fail-closed identity tests.
- Debug APK installed on the target device with `adb install -r`.
- No `check:all`, commit or push was run. Independent acceptance is still
  pending.

## B5-R fixes

- A late older callback no longer replaces newer unsent evidence.
- A conflicting callback received while a packet is in flight is reconciled
  after the ACK; the capability becomes `missing` and requests a resubscribe.
- Battery level is rejected as `invalid` when the raw level is outside
  `0..scale`, before integer percentage rounding.
- Sensor subscription and disposal are serialized by `SubscriptionGate`; a
  Stop waits for an in-flight subscription and then rejects later work.
- `RunGuard` invalidates the old run on Stop and on a new Start; engine
  callbacks and UI states from the old generation are rejected at delivery
  time. A Start after Stop on the same bound Activity starts a new run.
- `InstallationStore` is fail-closed: a missing file creates one UUID, while an
  unreadable, empty, invalid or unwritable file raises an explicit error. There
  is no temporary-UUID fallback and no direct-write fallback after a failed
  atomic move. The service shows the error and does not start.
- The API 35 `dataSync` timeout callback is `onTimeout(startId, fgsType)`; the
  service overrides it (and the legacy single-argument overload) with the
  idempotent Stop path.

## Target device

- Model: SM-J701F (the intended device).
- Android 9 / API 28, `armeabi-v7a`.
- The personal SM-J700F was not used for validation and was not modified.
- The existing diagnostic app was left installed. No phone settings, Wi-Fi
  state, ROM, root or certificate store were changed.

## Observed behavior

### Start and collection

- Pressing Start created one foreground `dataSync` service and one
  `gaia-client-collection` notification. A second Start while running was
  ignored.
- Found and accepted capabilities: all eight (battery level, battery
  temperature, battery voltage, charge state, accelerometer, proximity,
  network, Wi-Fi signal).
- Tick cadence was 10 s (`Tik 1`, `3`, `4`, `12`, `13`, `16` across runs).
- Session IDs changed per run; the UI showed only the short prefix.

### Real samples

- Battery was initially `missing` (sticky cache was not re-dated). A later new
  battery broadcast produced valid values: level 100 %, temperature 20.1–20.2 °C,
  voltage 4099–4311 mV, charge state `full`.
- Accelerometer produced valid changing vectors, for example
  `(0.01, 0.34, 9.74) m/s²`.
- Proximity produced valid `far`; `near` was not exercised because the sensor
  was not physically covered.
- Network produced a valid offline observation: transport `none`,
  `internet=false`, `validated=false` while the device had no active network.
- Wi-Fi signal stayed `missing` because Wi-Fi was disabled. It was not enabled
  because the validation rules prohibit changing Wi-Fi state. The valid RSSI
  path is therefore not device-verified in B5.

### Background and screen-off

- HOME (Activity stopped, service still foreground): process stayed alive,
  PSS 31.1 MB, average CPU 1.43 % over a 30 s sample.
- Screen off (device dozing): process and foreground service stayed alive,
  PSS 27.1–30.6 MB, average CPU 0.33 % over a 30 s sample.
- On return to the Activity, the tick count had advanced and sensor ages were
  consistent with continued collection.
- Device battery temperature during the run was 20.1–20.6 °C.

### Stop paths

- Activity Stop: service record removed, notification removed, UI showed
  `Durdu (kullanıcı)`, session/accepted/last packet cleared.
- Start immediately after Stop, with the Activity still bound, created a new
  run with a new session ID and tick 1. The old run did not revive.
- Notification Stop: the same idempotent path; service record removed,
  notification archived, UI showed the stopped state.
- HOME followed by returning to the Activity rebind and showed the current
  session and advanced tick; collection continued while unbound.
- Corrupt identity check: a synthetic invalid value was written to the
  app-private identity file. Start showed the explicit identity error, created
  no service or notification, and left the file unchanged. Restoring the
  original file and pressing Start resumed collection. The identity value was
  never printed or logged.
- Force-stop: process and service disappeared and did not restart after a 5 s
  wait. Relaunching the Activity showed a stopped service; no automatic Start.
- The Client service was stopped at the end of the validation.

## Not verified

- Valid Wi-Fi RSSI samples (Wi-Fi was disabled and was not changed).
- Proximity `near` (no physical sensor cover was applied).
- Rotation/config-change rebind. Background/foreground rebind was exercised;
  rotation was not, to avoid changing system rotation settings.
- API 35 `dataSync` timeout path. The device runs API 28; the two-argument
  callback is compile-verified against API 35 only.
- Reboot no-restart behavior. Force-stop no-restart was verified; the device was
  not rebooted.
- Long-duration/Doze behavior, thermal soak, and real B6 mTLS/HTTPS transport.
- Real central connection, ACK or delivery. B5 is local test mode only.

These results are short-run observations, not a production soak or B6 network
acceptance.

## Independent B5-R closure (Nexa)

Clean offline sequential build: 103 JVM tests, zero failures, errors or skips; all 41 Gradle tasks executed and assembleDebug succeeded. Two additional ordering regressions and narrow RSSI, ACK reconciliation and Activity error-render fixes are included. Earlier concurrent Gradle runs collided in Kotlin compiler caches; only review-started processes were stopped and app build outputs cleaned. The final APK was not reinstalled or independently exercised on the phone. The device measurements above remain the implementation agent’s earlier results. The SM-J701F service was confirmed stopped; no device settings or data were changed during independent review. B6 transport and actual TLS remain open.
