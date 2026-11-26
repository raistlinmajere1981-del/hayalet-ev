# Gaia 03-B5 · Android Client, service and hardware collection — design

Status: approved approach B (TransportAdapter.open/send/close). This document is the
implementation contract for B5. It is intentionally narrower than
`GAIA-CLIENT-PROTOCOL.md`; that document remains normative.

## Intent

Ship an independent `gaia-client` APK that:

- collects the eight v1 field capabilities without root;
- preserves the original measurement time and distinguishes `valid`, `invalid` and
  `missing` honestly;
- runs only after a visible user Start, as a single foreground service;
- produces one bounded snapshot every 10 s and sends it through an injectable
  transport seam;
- uses a local fake transport in B5, clearly labelled as local test mode;
- leaves certificate, CSR, HTTPS/mTLS, real ACK and reconnect to B6.

No real central connection or delivery confirmation is claimed in B5.

## Constraints and non-goals

- minSdk 28, ARM32 (`armeabi-v7a`), Kotlin, existing Android build stack.
- Application ID `com.hayaletev.gaiaclient`, separate from Companion and
  `com.hayaletev.gaiadiagnostic`.
- No Compose, no heavy UI framework, no AI dependency, no root.
- No camera, microphone, location, boot receiver or wake lock.
- No real CSR/Keystore chain, HTTPS/mTLS, ACK, reconnect, central receiver,
  Gaia Room/core change, Companion/Router or physical command.
- No APK, SDK path, cache, device identifier or raw measurement log in Git.
- Do not touch SM-J700F. Device validation targets SM-J701F only.

## Builder-check resolutions

1. **API 35 `dataSync` timeout.** Implement `Service.onTimeout(startId)` (called on
   API 35+) as a graceful `requestStop(REASON_SYSTEM_TIMEOUT)`: cancel the engine,
   remove the notification, publish stopped state, do not restart. J701F (API 28)
   cannot exercise this path; it is compile-verified only.
2. **Session replacement.** The engine calls `close()` before every reopen: on
   `SessionLost`, `Rejected`, and after a failed `open`. `open()` never replaces a
   live session on the same adapter. This keeps B6 socket cleanup deterministic.
3. **Retry cadence.** After `Accepted`, wait the response `intervalMs` (10 s).
   `Retryable` keeps the frozen packet and retries with full-jitter exponential
   backoff capped at 1, 2, 4, 8, 16, 32, 60 s. A failed `open` uses the same
   backoff. `SessionLost`/`Rejected` closes, clears, renews and reopens
   immediately; if that open fails, backoff applies. Backoff resets on `Accepted`.
   Tests inject a deterministic backoff; production uses `Random`.
4. **`network.state.v1`.** `activeNetwork == null` is a successful read and
   produces valid `{none,false,false}` at query time. A non-null network whose
   capabilities cannot be read (null or exception) is `invalid` at query time.
   Transport precedence is wifi > cellular > other; `internetCapable` and
   `validated` come from `NET_CAPABILITY_INTERNET` / `NET_CAPABILITY_VALIDATED`
   on the same active default network. No `missing` network sample is observable
   because every packet performs a live query.
5. **`signal.read.v1` scope.** Signal requires Wi-Fi hardware, Wi-Fi enabled and a
   connected Wi-Fi network; it does not require Wi-Fi to be the default transport
   (the B1 all-valid fixture has `network.state=none` with a valid signal). Disabled
   or disconnected Wi-Fi, and the `-127` sentinel, are `missing`. Any other
   out-of-range delivered value is `invalid` at notification receipt time.

## Architecture

Single Gradle project `gaia-client/`, single `:app` module. Pure Kotlin core is
kept free of Android imports so it can be tested on the JVM.

```text
MainActivity (observer) ──bind flags=0──> GaiaClientService (single owner)
                                             │
                     ┌───────────────────────┼────────────────────────┐
                     │                       │                        │
             HardwareSnapshotSource   SampleMemory + SnapshotFactory  CollectionEngine
             battery receiver         bounded last sample only        one loop, one sender
             sensor listener                  │                        │
             network/RSSI receiver            └──── TransportAdapter.open/send/close
                                                                        │
                                                              FakeTransportAdapter (B5)
```

Package layout:

```text
gaia-client/app/src/main/kotlin/com/hayaletev/gaiaclient/
  MainActivity.kt
  service/GaiaClientService.kt      lifecycle, binder, notification, stop path
  service/ClientBinder.kt
  service/ServiceState.kt
  service/InstallationStore.kt      noBackupFilesDir UUID file
  hardware/BatterySource.kt
  hardware/SensorSource.kt
  hardware/NetworkSource.kt
  hardware/HardwareSnapshotSource.kt
  hardware/mapping/*.kt             pure value/time mapping
  core/Capability.kt                eight v1 ids, units, value shapes
  core/Sample.kt                    quality + typed value + sampleMonoMs
  core/SampleMemory.kt              one sample per capability, run generation
  core/SnapshotFactory.kt
  core/CollectionEngine.kt          open/send loop, single flight, no catch-up
  core/MonoClock.kt
  protocol/ObservationCodec.kt      strict B1-shaped encode
  protocol/ObservationValidator.kt  envelope/sample/semantic checks
  transport/TransportAdapter.kt     B6 seam
  transport/FakeTransportAdapter.kt local test session only
  transport/TransportProvider.kt    B6 composition point
```

Build: AGP 9.2.1 / Gradle 9.5.1 wrapper copied from the diagnostic project,
compileSdk 35, targetSdk 35, Java 11 target on the JDK 17 build, no view
binding, coroutines-core 1.9.0. JVM tests use JUnit 4 and `org.json` (test
only); no `kotlinx-coroutines-test` or Robolectric dependency.

## Lifecycle contract

- `onCreate` creates the channel and calls `startForeground` immediately with a
  "starting" notification. It loads/creates `installationId`; it does not collect.
- `ACTION_START` (explicit app intent, no extras) creates one `runId`, resets
  memory, and starts the engine. A second Start while running is ignored.
  Return `START_NOT_STICKY`.
- `ACTION_STOP` and binder `stop()` call the same idempotent `requestStop()`.
  The service is not exported; the Activity never processes start/stop extras.
- `requestStop()` sets a stopped flag, cancels the engine job (pending `open` and
  `send` included), closes the transport, unregisters receivers/sensors/callbacks,
  clears memory, updates state, removes the notification and calls `stopSelf()`.
  `onDestroy()` repeats the same idempotent path.
- Activity binds with `bindService(..., 0)` only after a successful Start; a
  pending bind cannot create a service after Stop. `onStop` unbinds.
- Rotation/rebind only reattaches the listener; it never starts a second engine.
- Process death, force-stop and reboot do not restart the service: no sticky
  restart, no boot receiver.
- On API 35+ `onTimeout(startId)` follows the same stop path with
  `REASON_SYSTEM_TIMEOUT`; the UI may show why it stopped, but it never restarts
  automatically.
- `installationId` is a UUID in `noBackupFilesDir/installation-id`, written
  atomically, never logged, and `allowBackup=false`. Every service start gets a
  new `runId`.

## Hardware and time semantics

`HardwareSnapshotSource` writes typed samples into `SampleMemory`; it never
fabricates zero for unknown data. A capability is offered only when the hardware
exists (battery and network always; accelerometer/proximity only when the sensor
is present; signal only when Wi-Fi hardware exists).

| Capability | Sample time | Valid | Missing | Invalid |
| --- | --- | --- | --- | --- |
| `battery.level.v1` | receipt `elapsedRealtime` of a new battery broadcast | integer 0–100; zero valid | sticky initial cache, absent extra | delivered scale ≤ 0 or level outside range |
| `battery.pack-temperature.v1` | same broadcast | finite °C (tenths / 10) | absent extra | non-finite |
| `battery.voltage.v1` | same broadcast | non-negative safe integer mV | `-1` / absent | other negative |
| `battery.charge-state.v1` | same broadcast | charging/discharging/full/not_charging | Android unknown status / absent | unrecognised delivered code |
| `accelerometer.xyz.v1` | `SensorEvent.timestamp` ns → ms floor | three finite numbers; `[0,0,0]` valid | no event since subscription | non-finite/vector length; unreliable accuracy |
| `proximity.state.v1` | `SensorEvent.timestamp` ns → ms floor | near if `0 ≤ d < maxRange`; far if `d == maxRange` | no event since subscription | non-finite, negative, `> maxRange`; invalid maxRange means not offered |
| `network.state.v1` | `elapsedRealtime` at each tick's live query | `{transport, internetCapable, validated}`; `activeNetwork=null` → `{none,false,false}`; transport wifi/cellular/other with the two capability bits | not emitted; every packet queries live | non-null active network whose capabilities are null or whose query throws |
| `signal.read.v1` | receipt time of a new RSSI notification while Wi-Fi is connected | integer −126…0 dBm | no new notification, `-127` sentinel, Wi-Fi disabled/disconnected | any other delivered value outside −126…0 |

Additional rules:

- Sticky battery data is `missing` until a genuinely new broadcast arrives. The
  first sticky delivery is never re-dated; cached values are not re-dated on any
  later tick.
- Battery and sensor values keep their original sample time until a new delivery;
  the UI shows growing age. Heartbeats do not refresh them.
- Accelerometer uses `SENSOR_DELAY_NORMAL`; proximity is on-change. Register
  return values are checked. Unregister/re-register clears that capability to
  `missing` until the first new event.
- Network mapping reads `ConnectivityManager.activeNetwork` and its
  `NetworkCapabilities` at query time. Transport precedence is wifi, then
  cellular, then other (VPN/Ethernet/Bluetooth). `internetCapable` is the
  INTERNET bit and `validated` is the VALIDATED bit on that same network.
- RSSI is read from `RSSI_CHANGED_ACTION` (`EXTRA_NEW_RSSI`, falling back to
  `WifiManager.connectionInfo.rssi` at notification time). It requires Wi-Fi
  enabled and a connected Wi-Fi network; the default transport may be cellular.
  A network change clears the cached RSSI. Repeated cache reads are never
  treated as new radio measurements.
- Sensor events older than the current run/session evidence floor are rejected.
  Events at or below an already-sent sample time invalidate that capability to
  `missing` and trigger a resubscribe until new evidence arrives.
- When a session opens, `SampleMemory` enters a new session generation with
  `evidenceFloorMonoMs = elapsedRealtime` at the open response, discarding all
  pre-session samples. Sensors and the RSSI receiver are then re-registered;
  only events with `sampleMonoMs > evidenceFloorMonoMs` are accepted. Battery
  keeps its receiver but its cache is cleared, so a new delivery after the
  floor is required. On session loss the same cleanup runs before a new open.

## Memory, snapshot and sender

- `SampleMemory` holds at most one sample per capability (catalog bound, eight
  keys). It is keyed by `runId`/session generation; stale writes are ignored.
  There is no history, queue or on-disk sample store.
- `SnapshotFactory` copies the accepted capabilities in catalog order, fills
  absent entries as `missing`, freezes `sentMonoMs`, `deviceWallMs`, `seq` and
  `sessionId`, and guarantees `sampleMonoMs ≤ sentMonoMs`.
- `CollectionEngine` is the only sender. It opens the transport, then starts the
  session generation and renews subscriptions before the first packet:
  1. build a packet if none is pending;
  2. `send` exactly once (single flight);
  3. on `Accepted`, verify ACK session/seq, record sent watermarks, advance seq,
     reset backoff and wait the response `intervalMs` (10 s);
  4. on `Retryable`, keep the same frozen packet and retry after full-jitter
     backoff capped at 1, 2, 4, 8, 16, 32, 60 s;
  5. on `SessionLost`/`Rejected`, `close()`, drop the packet, clear memory,
     reopen immediately and start a new session with `seq=1`; if the reopen
     fails, apply the same backoff;
  6. on a failed `open`, `close()` and retry after the same backoff.
  A slow send or missed tick never causes a burst of catch-up packets.
- `stop()` cancels pending open/send and calls `close()`. After every suspension
  the engine checks its run token before updating state, so a late result cannot
  revive an old run.
- State exposed to the Activity: running, transport label, found/accepted
  capabilities, last packet, last send outcome, tick count, session short id.

## Transport seam for B6

```kotlin
data class SessionOpenContext(
    val installationId: String,
    val runId: String,
    val offered: List<CapabilityId>,
)

interface TransportAdapter {
    val mode: TransportMode // LOCAL_TEST in B5
    suspend fun open(context: SessionOpenContext): OpenResult
    suspend fun send(packet: ObservationPacket): SendResult
    fun close()
}
```

`open` returns a local `sessionId`, the accepted subset and the interval; `send`
returns `Accepted` (with matching ACK ids), `Retryable`, `Rejected` or
`SessionLost`. `close` must abort pending open/send and release sockets. B6
replaces `TransportProvider.create(context)` with the mTLS implementation and
maps `/sessions` and `/observations`; it receives identity through
`SessionOpenContext`, so hardware collection, memory, snapshot factory, engine
and service stay unchanged. B6 also owns raw UTF-8/duplicate-key/body
limit/header validation; the B5 codec is not that parser.

`FakeTransportAdapter` generates a local UUID session, accepts the offered
capabilities, records packets in memory for tests, and has no sockets. Its mode
is displayed as "Local test mode — no central connection" in both languages. It
must not be described as a real delivery or ACK.

## Protocol codec

`ObservationCodec` and `ObservationValidator` mirror the B1 observation contract:

- envelope `v`, lowercase UUIDv4 `sessionId`, `seq` 1…2^53−1, non-negative safe
  integer times, `sampleMonoMs ≤ sentMonoMs`;
- sample ids drawn from the eight-id catalog, correct unit, unique samples,
  every accepted capability present exactly once, no extra keys; an empty
  `samples` array is valid only when the accepted set is empty (heartbeat);
- quality/value/time rules: `valid` has a catalog-typed value and time;
  `invalid` has `value:null` and time; `missing` has `value:null` and no time;
- ranges/enums/vector/network object exactly as `gaia-protocol/v1`;
- zero, false and `[0,0,0]` are preserved.

The B1 generated schema and fixtures are the source. Tests compare the Kotlin
catalog with `gaia-protocol/v1/schema/capabilities.json`, and run every
observation fixture in `gaia-protocol/v1/fixtures/manifest.json` that is relevant
to B5 (valid, invalid/schema and invalid/semantic), including the T2 zero/false
scenario. Raw transport fixtures are explicitly out of B5 and stay with B6/B7.

## UI

One scrollable screen, platform views, no configuration surface:

- device manufacturer/model, Android version/API and ABI;
- Start/Stop button and service running/stopped status;
- local test mode label, session short id, tick count and last send outcome;
- found and accepted capabilities;
- last measurement per capability with value, quality and age (age from
  `elapsedRealtime`; missing shows no data, invalid shows invalid);
- TR/EN resources (`values/` English, `values-tr/` Turkish).

No landscape-specific layout, central management or configuration panel.

## Manifest and permissions

- `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_DATA_SYNC`, `INTERNET` (reserved for
  B6, unused in B5), `ACCESS_NETWORK_STATE`, `ACCESS_WIFI_STATE`,
  `POST_NOTIFICATIONS` (requested on API 33+; irrelevant on J701F).
- Service `exported=false`, `foregroundServiceType=dataSync`; Activity exported
  only as launcher and ignores all extras.
- `allowBackup=false`; installation id lives in `noBackupFilesDir`.
- No camera, microphone, location, boot, wake-lock or root permission.

## Tests

JVM unit tests:

- catalog matches B1; codec/validator pass/fail every B5 observation fixture;
- battery sticky/missing/zero/invalid mapping; proximity near/far boundary;
  accelerometer xyz and timestamp; network `null`→none, capability failure,
  transport precedence, RSSI sentinel/range and connected-but-not-default Wi-Fi;
- `SampleMemory` bounded, one sample per capability, run generation, evidence
  floor, clear, sent-watermark conflict;
- `SnapshotFactory` fills accepted-but-absent capabilities as missing, omits
  unaccepted ones, preserves zeros/false, orders and timestamps;
- `CollectionEngine` 10 s cadence, single flight, slow-send no catch-up, stop
  cancels pending open/send, late result ignored, close-before-reopen on session
  loss, backoff sequence for retryable/open failure, immediate reopen after
  session loss, new session `seq=1`, evidence floor and subscription renewal,
  open-failure retry;
- installation id stable across reopen, new run id per run; service stop reasons
  are idempotent. The API 35 `onTimeout` entry point is compile-verified only.

Device validation (SM-J701F only, when connected): install, Start, FGS
notification, real accel/proximity/battery/network samples, HOME and screen-off
short run, rebind/rotation, Stop from Activity and notification, force-stop and
reboot no-restart, PSS/RSS/CPU/temperature. If the device is absent, leave this
section explicitly unverified and continue with build and JVM tests. Stop the
service at the end.

## Acceptance mapping

| Task section | Evidence |
| --- | --- |
| 2 independent app | separate project/application id, minSdk 28, ARM32 build, no root |
| 3 hardware layer | eight capabilities, quality/time table, fixture tests |
| 4 lifecycle | one service/engine, bind flags 0, shared stop, device lifecycle checks |
| 5 snapshot/sender | memory/snapshot/engine separation, fake transport, session cleanup tests |
| 6 UI | TR/EN single-screen Activity and local-test label |
| 7 tests | JVM suite plus B1 fixture matrix |
| 8 device | J701F measurement report or explicit unverified note |

## Delivery

Sources, tests, README, `MEASUREMENT_REPORT.md` and a B5 result entry in
`GAIA.md`. Build and targeted tests are run; `check:all`, commit and push are not.
