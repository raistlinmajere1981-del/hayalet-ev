# Gaia Client (B5)

Standalone Android client for the Gaia field protocol. B5 covers hardware
collection, a user-started foreground service, a last-sample store, snapshot
creation and a local test transport. It does not connect to a central Gaia
receiver.

## Scope

- Kotlin, `minSdk 28`, `targetSdk 35`, separate application identity
  `com.hayaletev.gaiaclient`.
- Eight capabilities: battery level, battery pack temperature, battery voltage,
  battery charge state, accelerometer XYZ, proximity, network state and Wi-Fi
  signal.
- One foreground `dataSync` service owns collection. The Activity only observes
  and requests Start/Stop; it never creates a second collector.
- No root, camera, microphone, location, boot receiver or unnecessary wake lock.
- Local test mode only: the B5 transport is an in-process fake. The UI says
  "Local test mode — no central connection" and the outcome is "local test
  accepted", never "delivered".

## Build and test

```bash
cd gaia-client
./gradlew :app:assembleDebug
./gradlew :app:testDebugUnitTest
```

The debug APK is written under `app/build/outputs/apk/debug/`. Build outputs,
Gradle caches and `local.properties` are intentionally ignored by Git.

## Install and run

Install the debug APK on the target device, open **Gaia Client**, and press
**Start**. On Android 13+ the app requests notification permission before
starting the foreground service. The notification exposes the same Stop path as
the Activity. Pressing Stop cancels any pending open/send, releases sensors and
receivers, clears the session and removes the notification.

The service is `START_NOT_STICKY`; process death, force-stop and reboot do not
restart it. There is no exported Activity extra that can start or stop
collection. A second Start while running is ignored. A Start after Stop creates
a new run generation; callbacks and UI states from the old run are rejected at
delivery time, so a late sensor event cannot revive the stopped run.

## Lifecycle and identity

`installationId` is a UUID stored atomically in
`noBackupFilesDir/gaia-client/installation-id`. The manifest sets
`allowBackup=false`, so the identity does not migrate through Android
auto-backup. It is never shown in the UI or logged. Each service start gets a
new in-memory `runId`.

Identity persistence is fail-closed. A missing file is the only case that
creates a new UUID. An existing but unreadable, empty or invalid file is an
explicit error: the service does not start, the UI says the identity could not
be read and asks for a reinstall, and the corrupt file is never replaced
automatically. There is no temporary-UUID fallback and no direct-write fallback
after a failed atomic write.

## Android 15 behavior

On API 35+ the `dataSync` foreground service can time out. The
`onTimeout(startId, fgsType)` callback follows the same idempotent Stop path
with `SYSTEM_TIMEOUT`; the legacy `onTimeout(startId)` overload does the same
for older foreground service types. Neither path restarts automatically. The
J701F validation device runs API 28, so this path is compile-verified only
there.

## B6 transport boundary

B5 talks to `TransportAdapter` (`open` / `send` / `close`). The only composition
point is `TransportProvider.create(context)`, which returns
`FakeTransportAdapter`. B6 replaces that implementation with the mTLS/HTTPS
transport and may keep the same `CollectionEngine`, snapshot, memory and
hardware source unchanged. The fake does not claim a central connection, ACK or
delivery.

B6 carries these wire conditions through the existing seam:

| Wire condition | B6 result and engine behavior |
| --- | --- |
| Matching ACK for `sessionId` and `seq` | `Accepted`; only then does the engine record the packet as sent |
| HTTP 403 / revoked authorization | Terminal rejection; the engine stops and surfaces the error instead of reopening |
| `Retry-After` | `Retryable(retryAfterMs)`; wait at least that long in addition to backoff |
| 35 s session timeout | `SessionLost`; close and reopen with a new `sessionId` and `seq = 1` |
| ACK for another session or `seq` | `SessionLost`; never reconcile against the wrong packet |

The B5 `Rejected` path is an immediate reopen because the fake never produces a
terminal authorization error. B6 adds the terminal result type; real TLS,
certificate installation and server-side authorization remain B6 work.

## Time and quality semantics

- A sample is `valid` only with a catalog-typed value and an event/read time.
- `invalid` carries no value and the time the failure was observed.
- `missing` carries no value and no sample time.
- Battery values use the receipt time of a new battery broadcast. The initial
  sticky cache is never re-dated and stays `missing` until a real delivery.
- Accelerometer and proximity use `SensorEvent.timestamp` in nanoseconds,
  floored to milliseconds.
- Network state is queried live before every snapshot. `activeNetwork = null`
  is a valid `{none, false, false}` observation; an unreadable non-null network
  is `invalid`.
- Wi-Fi RSSI is valid only for a new RSSI notification while Wi-Fi is enabled
  and connected. Android's `-127` unknown sentinel is `missing`; other
  out-of-range values are `invalid`.
- Android unknown sentinels are never converted to a valid zero.

## Device validation

Targeted validation was performed on the intended SM-J701F only. The personal
SM-J700F was not used for validation and was not modified. Summary results and
the unverified items are in [MEASUREMENT_REPORT.md](MEASUREMENT_REPORT.md).
