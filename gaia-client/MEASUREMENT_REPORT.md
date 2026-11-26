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
