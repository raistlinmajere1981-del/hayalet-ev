# Gaia 03-B5 Android Client Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone Android Gaia Client that collects the eight v1 capabilities, runs as a single user-started foreground service, and sends bounded 10-second snapshots through a local fake transport seam ready for B6.

**Architecture:** One `gaia-client/` Gradle project with a pure-Kotlin core (catalog, samples, memory, snapshot, engine, protocol codec/validator, transport seam) and thin Android adapters (battery/sensor/network sources, foreground service, Activity). The service owns exactly one engine and one sender; the Activity only observes. B5 uses `FakeTransportAdapter` and never claims a real central connection.

**Tech Stack:** Kotlin, AGP 9.2.1, Gradle 9.5.1, compileSdk/targetSdk 35, minSdk 28, Java 11 target, `kotlinx-coroutines-core:1.9.0`, platform Android views, JUnit 4.13.2, `org.json:json:20240303` (tests only).

**Spec:** `docs/superpowers/specs/2026-11-26-gaia-b5-android-client-design.md`

## Global Constraints

- Application ID `com.hayaletev.gaiaclient`; separate project and APK identity. Do not reuse `com.hayaletev.gaiadiagnostic`.
- Eight capability IDs and units exactly as `gaia-protocol/v1/schema/capabilities.json`; that file and the B1 fixtures are the source of truth, not a new contract.
- `minSdk 28`, `compileSdk 35`, `targetSdk 35`, Java 11 target on the JDK 17 build.
- No Compose, no AndroidX UI, no camera, microphone, location, boot receiver, wake lock or root.
- Foreground service only after a visible user Start; `START_NOT_STICKY`; one service, one collector, one sender; Activity binds with `flags=0`.
- Notification and Activity use the same idempotent Stop path. Stop cancels pending open/send; a late result must not revive the run.
- `allowBackup=false`; installation UUID lives in `noBackupFilesDir/installation-id` and is never logged.
- 10 s interval, 35 s timeout from the open response; single flight; no catch-up of missed ticks.
- Fake transport is labelled local test mode; no real central connection, TLS, CSR, ACK or reconnect in B5.
- Do not touch SM-J700F. Real-device validation targets SM-J701F only, and only when connected.
- No APK, `local.properties`, Gradle cache, private device identifier or raw measurement log in Git.
- Do not run `check:all`, do not commit, do not push. Independent acceptance owns integration.
- B1 raw fixtures (UTF-8, duplicate keys, body limit, depth, non-finite literals) are B6/B7 scope; B5 validates schema and semantic observation fixtures only.

## Review Focus

1. **Sticky battery must stay unknown.** The first sticky `ACTION_BATTERY_CHANGED` must never become valid or be re-dated on later ticks; a capability with no new broadcast is `missing`. Tested in Tasks 3, 4 and 10.
2. **Session changes must not reuse old evidence.** Pre-session sensor events, stale RSSI and old battery cache must be discarded; only evidence strictly after the open floor is accepted. Tested in Tasks 3 and 9.
3. **Stop races must not revive the run.** Pending `open`/`send` are cancelled, late completions are ignored, and the old run cannot update state or send again. Tested in Task 9.
4. **Unknown Android sentinels are not zero.** `-127` RSSI, `-1` battery level/voltage and unknown battery status are `missing`, not valid zero. Tested in Tasks 10 and 12.
5. **Offline network is a valid observation.** `activeNetwork=null` yields valid `{none,false,false}`; connected Wi-Fi RSSI is valid even when cellular is the default transport. Tested in Task 12.

---

### Task 1: Scaffold the independent Gradle project

**Files:**
- Create: `gaia-client/settings.gradle.kts`
- Create: `gaia-client/build.gradle.kts`
- Create: `gaia-client/gradle.properties`
- Create: `gaia-client/.gitignore`
- Create: `gaia-client/gradlew`, `gaia-client/gradlew.bat`, `gaia-client/gradle/wrapper/gradle-wrapper.jar`, `gaia-client/gradle/wrapper/gradle-wrapper.properties`
- Create: `gaia-client/app/build.gradle.kts`
- Create: `gaia-client/app/proguard-rules.pro`
- Create: `gaia-client/app/src/main/AndroidManifest.xml`
- Create: `gaia-client/app/src/main/res/values/strings.xml`
- Create: `gaia-client/app/src/main/res/values-tr/strings.xml`
- Create: `gaia-client/app/src/main/res/values/themes.xml`
- Create: `gaia-client/app/src/main/res/layout/activity_main.xml`
- Create: `gaia-client/app/src/main/kotlin/com/hayaletev/gaiaclient/MainActivity.kt` (stub)
- Create: `gaia-client/app/src/main/kotlin/com/hayaletev/gaiaclient/service/GaiaClientService.kt` (stub)
- Create (untracked): `gaia-client/local.properties` with `sdk.dir=<local Android SDK>`

**Interfaces:**
- Produces: a buildable Android app with package `com.hayaletev.gaiaclient`, minSdk 28, targetSdk 35, and a declared non-exported `dataSync` service.

- [ ] **Step 1: Copy the proven wrapper and write the project files**

Copy `gaia-diagnostic/gradlew`, `gradlew.bat`, `gradle/wrapper/gradle-wrapper.jar` and `gradle-wrapper.properties` into `gaia-client/`. Use AGP `9.2.1` and the same repositories as the diagnostic project. In `app/build.gradle.kts` set `namespace`/`applicationId` to `com.hayaletev.gaiaclient`, `compileSdk = 35`, `minSdk = 28`, `targetSdk = 35`, Java 11 source/target, and these dependencies only:

```kotlin
implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.9.0")
testImplementation("junit:junit:4.13.2")
testImplementation("org.json:json:20240303")
```

Declare `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_DATA_SYNC`, `INTERNET`, `ACCESS_NETWORK_STATE`, `ACCESS_WIFI_STATE`, `POST_NOTIFICATIONS`; optional `uses-feature` for accelerometer, proximity and Wi-Fi. Set `allowBackup="false"`. Activity is exported only as launcher; service is `exported="false"` with `foregroundServiceType="dataSync"`. Stub Activity inflates the layout; stub Service returns `START_NOT_STICKY` and a binder placeholder.

Write `.gitignore` with `/.gradle/`, `/.kotlin/`, `/local.properties`, `/app/build/`, `/build/`.

- [ ] **Step 2: Build the scaffold**

Run: `cd gaia-client && ./gradlew :app:assembleDebug --no-daemon`
Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 3: Verify the APK identity**

Run: `ls gaia-client/app/build/outputs/apk/debug/app-debug.apk` and inspect with the SDK's `aapt dump badging`.
Expected: package `com.hayaletev.gaiaclient`, `sdkVersion:'28'`, `targetSdkVersion:'35'`, launcher Activity present.

- [ ] **Step 4: Stop point**

Keep changes uncommitted. Do not run `check:all` or commit.

---

### Task 2: Capability catalog and typed samples

**Files:**
- Create: `gaia-client/app/src/main/kotlin/com/hayaletev/gaiaclient/core/Capability.kt`
- Create: `gaia-client/app/src/main/kotlin/com/hayaletev/gaiaclient/core/Sample.kt`
- Test: `gaia-client/app/src/test/kotlin/com/hayaletev/gaiaclient/core/CapabilityCatalogTest.kt`
- Test: `gaia-client/app/src/test/kotlin/com/hayaletev/gaiaclient/core/SampleTest.kt`
- Test support: `gaia-client/app/src/test/kotlin/com/hayaletev/gaiaclient/support/RepoPaths.kt`

**Interfaces:**
- Produces: `enum class CapabilityId(val wireId: String)` with the eight IDs; `enum class ValueKind { INTEGER, DECIMAL, TEXT, VECTOR3, NETWORK }`; `data class CapabilityDefinition(val id, val unit, val kind, val min, val max, val enumValues)`; `object CapabilityCatalog { val all: List<CapabilityDefinition>; val ids: List<CapabilityId>; fun definition(id: CapabilityId): CapabilityDefinition }`.
- Produces: `enum class Quality { VALID, INVALID, MISSING }`; `enum class NetworkTransport(val wire: String) { NONE, WIFI, CELLULAR, OTHER }`; `sealed interface SampleValue { data class Integer(val value: Long); data class Decimal(val value: Double); data class Text(val value: String); data class Vector3(val x: Double, val y: Double, val z: Double); data class Network(val transport: NetworkTransport, val internetCapable: Boolean, val validated: Boolean) }`.
- Produces: `data class Sample(val id: CapabilityId, val quality: Quality, val value: SampleValue?, val sampleMonoMs: Long?)` with `Sample.valid`, `Sample.invalid`, `Sample.missing`.

- [ ] **Step 1: Write the failing catalog and sample tests**

`RepoPaths` walks up from `System.getProperty("user.dir")` until `gaia-protocol/v1/fixtures/manifest.json` exists and exposes `protocolDir(): File`.

`CapabilityCatalogTest` parses `gaia-protocol/v1/schema/capabilities.json` with `org.json` and asserts the Kotlin catalog has exactly eight entries with matching `id`, `unit`, `valueType`, `minimum`, `maximum`, `enumValues`, `length` and `fields`. It also asserts the eight wire IDs in order.

`SampleTest` asserts:
- `Sample.valid(BATTERY_LEVEL, Integer(0), 1000)` is accepted; level 101 and `Decimal` are rejected.
- `Sample.valid(SIGNAL, Integer(-126), 1000)` accepted; `Integer(1)` and `Integer(-127)` rejected.
- `Sample.valid(NETWORK, Network(NONE, false, false), 1000)` accepted; `Network(NONE, true, false)` rejected.
- `Sample.valid(ACCEL, Vector3(0.0, 0.0, 0.0), 0)` accepted.
- `Sample.invalid(id, 1000)` has null value and a time; `Sample.missing(id)` has neither.
- Constructing `Sample(VALID, null, 1000)`, `Sample(INVALID, Integer(1), 1000)` and `Sample(MISSING, null, 1000)` throws.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd gaia-client && ./gradlew :app:testDebugUnitTest --tests '*CapabilityCatalogTest' --tests '*SampleTest' --no-daemon`
Expected: FAIL with unresolved references.

- [ ] **Step 3: Implement the catalog and sample model**

Use the exact IDs/units from `capabilities.json`. `Sample.valid` calls `CapabilityCatalog.definition(id).accepts(value)` and requires `sampleMonoMs >= 0`; `Sample.invalid` requires a non-negative time; `Sample.missing` takes no value/time. Keep the model free of Android imports.

- [ ] **Step 4: Run the tests to verify they pass**

Run the same command. Expected: PASS.

- [ ] **Step 5: Stop point**

Keep changes uncommitted.

---

### Task 3: Bounded sample memory and observation packet

**Files:**
- Create: `gaia-client/app/src/main/kotlin/com/hayaletev/gaiaclient/core/ObservationPacket.kt`
- Create: `gaia-client/app/src/main/kotlin/com/hayaletev/gaiaclient/core/SampleStore.kt`
- Create: `gaia-client/app/src/main/kotlin/com/hayaletev/gaiaclient/core/SampleMemory.kt`
- Test: `gaia-client/app/src/test/kotlin/com/hayaletev/gaiaclient/core/SampleMemoryTest.kt`

**Interfaces:**
- Produces: `data class ObservationPacket(val v: Int = 1, val sessionId: String, val seq: Long, val sentMonoMs: Long, val deviceWallMs: Long, val samples: List<Sample>)`.
- Produces: `interface SampleStore { fun beginSession(accepted: Set<CapabilityId>, floorMonoMs: Long); fun endSession(); fun snapshot(): Map<CapabilityId, Sample>; fun recordSent(packet: ObservationPacket); fun consumeResubscribeRequests(): Set<CapabilityId> }`.
- Produces: `class SampleMemory : SampleStore`.

- [ ] **Step 1: Write the failing memory tests**

Assert:
- `beginSession` clears old samples; `endSession` rejects offers.
- Only accepted capabilities are stored; at most eight entries exist; duplicate offers overwrite.
- A sample with `sampleMonoMs <= floor` is rejected; `floor + 1` is accepted.
- A `missing` offer replaces a previous valid sample.
- After `recordSent` of battery level at 1000/value 83, an offer at 999 becomes missing and requests resubscribe; an offer at 1000 with a different value becomes missing and requests resubscribe; an offer at 1000 with the same value is accepted without resubscribe; an offer at 1001 is accepted.
- A watermark survives an intervening missing sample.
- `consumeResubscribeRequests()` returns and clears the set.
- `snapshot()` returns a copy; mutating it does not change memory.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd gaia-client && ./gradlew :app:testDebugUnitTest --tests '*SampleMemoryTest' --no-daemon`
Expected: FAIL.

- [ ] **Step 3: Implement `SampleMemory`**

Use one `synchronized` lock. Store `accepted`, `floorMonoMs`, `accepting`, `samples: LinkedHashMap`, `lastSent: LinkedHashMap`, and `resubscribe: LinkedHashSet`. `offer(sample)` applies acceptance, floor, and watermark conflict rules; a conflict stores `Sample.missing(id)` and adds the id to `resubscribe`. `recordSent` stores only non-missing samples. `beginSession`/`endSession` clear all state. `snapshot()` returns `LinkedHashMap(samples)`.

- [ ] **Step 4: Run the test to verify it passes**

Run the same command. Expected: PASS.

- [ ] **Step 5: Stop point**

Keep changes uncommitted.

---

### Task 4: Snapshot factory and monotonic clock

**Files:**
- Create: `gaia-client/app/src/main/kotlin/com/hayaletev/gaiaclient/core/MonoClock.kt`
- Create: `gaia-client/app/src/main/kotlin/com/hayaletev/gaiaclient/core/SnapshotFactory.kt`
- Test: `gaia-client/app/src/test/kotlin/com/hayaletev/gaiaclient/core/SnapshotFactoryTest.kt`

**Interfaces:**
- Produces: `interface MonoClock { fun elapsedRealtimeMs(): Long; fun wallTimeMs(): Long }`.
- Produces: `class SnapshotFactory(private val clock: MonoClock) { fun create(sessionId: String, seq: Long, accepted: List<CapabilityId>, samples: Map<CapabilityId, Sample>): ObservationPacket }`.

- [ ] **Step 1: Write the failing snapshot tests**

Use a fake clock returning `elapsedRealtimeMs=5000`, `wallTimeMs=1_700_000_000_000`. Assert:
- Accepted capabilities appear in catalog order; accepted-but-absent become missing; unaccepted samples are omitted.
- Zero, false and `[0,0,0]` survive.
- Original `sampleMonoMs` values survive; `sentMonoMs=5000`, `deviceWallMs` from the clock.
- A sample with `sampleMonoMs > 5000` becomes missing.
- Empty accepted produces an empty `samples` list.
- `sessionId` and `seq` are copied.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd gaia-client && ./gradlew :app:testDebugUnitTest --tests '*SnapshotFactoryTest' --no-daemon`
Expected: FAIL.

- [ ] **Step 3: Implement `SnapshotFactory`**

Sort accepted IDs by catalog order, fill absent entries with `Sample.missing`, replace any future sample with missing, and build the packet. Require `seq >= 1`.

- [ ] **Step 4: Run the test to verify it passes**

Run the same command. Expected: PASS.

- [ ] **Step 5: Stop point**

Keep changes uncommitted.

---

### Task 5: JSON value model, writer and observation encoder

**Files:**
- Create: `gaia-client/app/src/main/kotlin/com/hayaletev/gaiaclient/protocol/JsonValue.kt`
- Create: `gaia-client/app/src/main/kotlin/com/hayaletev/gaiaclient/protocol/JsonWriter.kt`
- Create: `gaia-client/app/src/main/kotlin/com/hayaletev/gaiaclient/protocol/ObservationCodec.kt`
- Test: `gaia-client/app/src/test/kotlin/com/hayaletev/gaiaclient/protocol/JsonWriterTest.kt`
- Test: `gaia-client/app/src/test/kotlin/com/hayaletev/gaiaclient/protocol/ObservationCodecTest.kt`

**Interfaces:**
- Produces: `sealed interface JsonValue { data object Null; data class Bool(val value: Boolean); data class Num(val value: Double, val integer: Boolean); data class Str(val value: String); data class Arr(val items: List<JsonValue>); data class Obj(val entries: List<Pair<String, JsonValue>>) }`.
- Produces: `object JsonWriter { fun write(value: JsonValue): String }`.
- Produces: `object ObservationCodec { fun toJson(packet: ObservationPacket): JsonValue.Obj; fun encode(packet: ObservationPacket): String }`.

- [ ] **Step 1: Write the failing writer and codec tests**

`JsonWriterTest` asserts quotes, backslashes, newlines, tabs and control characters are escaped; `°C` and `m/s²` are preserved; integer-valued `Num` writes without a decimal point; decimal `19.9` writes as `19.9`; arrays/objects nest correctly; non-finite numbers throw.

`ObservationCodecTest` builds a packet with all eight samples including `battery.level=0`, `network={none,false,false}`, `accel=[0,0,0]`, one invalid sample and one missing sample. It encodes, parses with `org.json`, and asserts:
- `v`, `sessionId`, `seq`, `sentMonoMs`, `deviceWallMs` and all sample IDs are present.
- Valid zero/false/vector values are preserved.
- Missing sample has no `sampleMonoMs`; invalid sample has `sampleMonoMs` and `value=null`.
- Units match the catalog.
- `JsonWriter.write(ObservationCodec.toJson(packet))` equals `ObservationCodec.encode(packet)`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd gaia-client && ./gradlew :app:testDebugUnitTest --tests '*JsonWriterTest' --tests '*ObservationCodecTest' --no-daemon`
Expected: FAIL.

- [ ] **Step 3: Implement the JSON model, writer and encoder**

Write keys in this order: packet `v, sessionId, seq, sentMonoMs, deviceWallMs, samples`; sample `id, quality, sampleMonoMs (when present), unit, value`. Use catalog units. Reject non-finite numbers in the writer. Do not add a JSON parser to main; B6 owns raw parsing.

- [ ] **Step 4: Run the tests to verify they pass**

Run the same command. Expected: PASS.

- [ ] **Step 5: Stop point**

Keep changes uncommitted.

---

### Task 6: Observation validator and B1 fixture matrix

**Files:**
- Create: `gaia-client/app/src/main/kotlin/com/hayaletev/gaiaclient/protocol/ObservationValidator.kt`
- Test: `gaia-client/app/src/test/kotlin/com/hayaletev/gaiaclient/protocol/ObservationValidatorTest.kt`
- Test: `gaia-client/app/src/test/kotlin/com/hayaletev/gaiaclient/protocol/ObservationFixtureTest.kt`
- Test support: `gaia-client/app/src/test/kotlin/com/hayaletev/gaiaclient/support/JsonFixtureParser.kt`

**Interfaces:**
- Produces: `data class ValidationError(val code: String, val path: String)`.
- Produces: `object ObservationValidator { fun validate(root: JsonValue, accepted: Set<String>? = null): List<ValidationError> }`.

- [ ] **Step 1: Write the failing validator tests**

`ObservationValidatorTest` builds `JsonValue` trees and asserts these codes: `wrong-version`, `invalid-uuid`, `sequence-range`, `unsafe-integer`, `negative-time`, `extra-field`, `missing-field`, `unknown-capability`, `duplicate-capability`, `wrong-unit`, `wrong-value-type`, `invalid-vector`, `missing-time-rule`, `sample-after-send`, `unapproved-capability`, `missing-capability`. Include network `none` with true flags, signal `1`, battery level `101`, proximity numeric value, missing sample with a time, and an empty heartbeat with empty accepted.

`JsonFixtureParser` uses `org.json` to convert a fixture file into `JsonValue`: objects to `Obj` in key iteration order, arrays to `Arr`, `JSONObject.NULL` to `Null`, booleans to `Bool`, integer Java types to `Num(integer=true)`, other numbers to `Num(integer=false)`.

`ObservationFixtureTest` reads `fixtures/manifest.json`, filters `schema == "observation"` and `layer != "raw"`, parses each fixture, and validates with an accepted set:
- `observation.heartbeat-empty` → empty set.
- Any ID starting with `observation.t1` or any semantic observation case → `expectedAccepted` from `scenarios/t1.json`.
- All other valid observation cases → all eight catalog IDs.

For `expect=valid`, assert no errors. For `expect=invalid`, assert the error codes contain the manifest's `violation`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd gaia-client && ./gradlew :app:testDebugUnitTest --tests '*ObservationValidatorTest' --tests '*ObservationFixtureTest' --no-daemon`
Expected: FAIL.

- [ ] **Step 3: Implement the validator**

Validate the envelope and each sample strictly: exact keys, catalog IDs/units, quality/value/time rules, integer ranges and safe-integer bounds, finite decimals, vector length 3, closed enums, network object shape and `none` flags, duplicate IDs, accepted membership, and `sampleMonoMs <= sentMonoMs`. Return all errors rather than stopping at the first. Skip membership checks when `accepted == null`.

- [ ] **Step 4: Run the tests to verify they pass**

Run the same command. Expected: PASS.

- [ ] **Step 5: Stop point**

Keep changes uncommitted.

---

### Task 7: Transport seam and local fake adapter

**Files:**
- Create: `gaia-client/app/src/main/kotlin/com/hayaletev/gaiaclient/transport/TransportAdapter.kt`
- Create: `gaia-client/app/src/main/kotlin/com/hayaletev/gaiaclient/transport/FakeTransportAdapter.kt`
- Create: `gaia-client/app/src/main/kotlin/com/hayaletev/gaiaclient/transport/TransportProvider.kt`
- Test: `gaia-client/app/src/test/kotlin/com/hayaletev/gaiaclient/transport/FakeTransportAdapterTest.kt`

**Interfaces:**
- Produces: `enum class TransportMode { LOCAL_TEST }`.
- Produces: `data class SessionOpenContext(val installationId: String, val runId: String, val offered: List<CapabilityId>)`.
- Produces: `sealed interface OpenResult { data class Opened(val sessionId: String, val accepted: List<CapabilityId>, val intervalMs: Long); data class Failed(val reason: String) }`.
- Produces: `sealed interface SendResult { data class Accepted(val sessionId: String, val seq: Long); data class Retryable(val reason: String); data class Rejected(val reason: String); data class SessionLost(val reason: String) }`.
- Produces: `interface TransportAdapter { val mode: TransportMode; suspend fun open(context: SessionOpenContext): OpenResult; suspend fun send(packet: ObservationPacket): SendResult; fun close() }`.
- Produces: `class FakeTransportAdapter : TransportAdapter` and `object TransportProvider { fun create(context: android.content.Context): TransportAdapter }`.

- [ ] **Step 1: Write the failing fake transport tests**

Assert:
- `open` returns a lowercase UUIDv4, accepts exactly the offered list in order, returns `intervalMs=10_000`, and records the context.
- `send` with the current session returns `Accepted` with the same session and seq.
- `send` before `open`, after `close`, or with a different session returns `SessionLost`.
- `close` is idempotent.
- The adapter retains only the last packet and a sent counter; it has no sockets and `mode == LOCAL_TEST`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd gaia-client && ./gradlew :app:testDebugUnitTest --tests '*FakeTransportAdapterTest' --no-daemon`
Expected: FAIL.

- [ ] **Step 3: Implement the seam and fake adapter**

`FakeTransportAdapter` generates a fresh UUIDv4 per `open`, keeps `currentSession`, `lastContext`, `lastPacket` and `sentCount`, and never claims a remote delivery. `TransportProvider.create(context)` returns the fake; this is the B6 replacement point.

- [ ] **Step 4: Run the test to verify it passes**

Run the same command. Expected: PASS.

- [ ] **Step 5: Stop point**

Keep changes uncommitted.

---

### Task 8: Engine happy path

**Files:**
- Create: `gaia-client/app/src/main/kotlin/com/hayaletev/gaiaclient/core/Backoff.kt`
- Create: `gaia-client/app/src/main/kotlin/com/hayaletev/gaiaclient/core/Sleeper.kt`
- Create: `gaia-client/app/src/main/kotlin/com/hayaletev/gaiaclient/core/CollectionEngine.kt`
- Test support: `gaia-client/app/src/test/kotlin/com/hayaletev/gaiaclient/support/ScriptedTransport.kt`
- Test support: `gaia-client/app/src/test/kotlin/com/hayaletev/gaiaclient/support/ManualSleeper.kt`
- Test support: `gaia-client/app/src/test/kotlin/com/hayaletev/gaiaclient/support/RecordingSampleStore.kt`
- Test support: `gaia-client/app/src/test/kotlin/com/hayaletev/gaiaclient/support/RecordingEngineEvents.kt`
- Test support: `gaia-client/app/src/test/kotlin/com/hayaletev/gaiaclient/support/FixedClock.kt`
- Test: `gaia-client/app/src/test/kotlin/com/hayaletev/gaiaclient/core/CollectionEngineHappyPathTest.kt`

**Interfaces:**
- Produces: `fun interface Sleeper { suspend fun sleep(ms: Long) }`; `object CoroutineSleeper : Sleeper`.
- Produces: `interface Backoff { fun nextDelayMs(): Long; fun reset() }`; `class FullJitterBackoff(private val random: kotlin.random.Random = kotlin.random.Random.Default) : Backoff`.
- Produces: `enum class EnginePhase { STOPPED, OPENING, SENDING, WAITING, RETRY_WAIT }`; `enum class SendOutcome { ACCEPTED, RETRYABLE, REJECTED, SESSION_LOST, OPEN_FAILED }`; `data class EngineState(val phase, val sessionId, val accepted, val tickCount, val lastOutcome, val lastPacket)`.
- Produces: `interface EngineEvents { fun onSessionOpened(sessionId: String, accepted: List<CapabilityId>, floorMonoMs: Long); fun onSessionClosed(); fun onBeforeSnapshot(); fun onResubscribe(ids: Set<CapabilityId>); fun onState(state: EngineState) }`.
- Produces: `class CollectionEngine(scope: CoroutineScope, transport: TransportAdapter, store: SampleStore, snapshotFactory: SnapshotFactory, clock: MonoClock, sleeper: Sleeper, backoff: Backoff, events: EngineEvents, installationId: String, runId: String, offered: List<CapabilityId>)` with `fun start()`, `fun stop(): Job?`, `fun state(): EngineState`.

- [ ] **Step 1: Write the failing happy-path engine tests**

`ManualSleeper` records requested delays on an unlimited `Channel<Long>` and suspends on a resettable gate. `ScriptedTransport` records `open` contexts and `send` packets on unlimited channels and returns results from a result channel. `RecordingSampleStore` records `beginSession`, `endSession`, `recordSent` and returns a fixed snapshot map. `RecordingEngineEvents` records callbacks.

Assert:
- `start` calls `open` with the exact `SessionOpenContext` (installation, run, offered).
- On `Opened`, the store receives `beginSession(accepted.toSet(), floor=clock.elapsedRealtimeMs())`; `onSessionOpened` fires with the same values.
- The first packet has `seq=1`, the session ID, catalog-ordered samples, and `sentMonoMs` from the clock.
- `onBeforeSnapshot` fires before packet creation.
- Only one `send` is in flight; no second send appears until the first result is delivered.
- `Accepted` records the packet in the store, increments `tickCount`, sets `lastOutcome=ACCEPTED`, stores `lastPacket`, and requests a `10_000` ms sleep.
- After the sleep, the second packet has `seq=2`.
- `stop()` sets phase `STOPPED`, clears `lastPacket`/accepted/session, closes the transport and ends the store.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd gaia-client && ./gradlew :app:testDebugUnitTest --tests '*CollectionEngineHappyPathTest' --no-daemon`
Expected: FAIL.

- [ ] **Step 3: Implement the engine happy path**

Launch one coroutine from `scope`; loop `open` → `beginSession` → `onSessionOpened` → build/send once → on `Accepted` record/advance/wait interval. Check `currentCoroutineContext().isActive` and the stopped flag after every suspension. Use `clock.elapsedRealtimeMs()` for the evidence floor and `SnapshotFactory` for packet freezing. `start` is a no-op while a job is active; `stop` cancels the job, closes the transport, ends the store and is idempotent.

- [ ] **Step 4: Run the test to verify it passes**

Run the same command. Expected: PASS.

- [ ] **Step 5: Stop point**

Keep changes uncommitted.

---

### Task 9: Engine retry, session loss and stop races

**Files:**
- Modify: `gaia-client/app/src/main/kotlin/com/hayaletev/gaiaclient/core/CollectionEngine.kt`
- Test: `gaia-client/app/src/test/kotlin/com/hayaletev/gaiaclient/core/CollectionEngineFailureTest.kt`

**Interfaces:**
- Consumes: Task 8 engine types and test supports.
- Produces: the complete engine state machine; no new public types beyond Task 8.

- [ ] **Step 1: Write the failing failure-path tests**

Use `SequenceBackoff(vararg delays)` (test support) to make backoff deterministic. Assert:
- `Retryable` reuses the exact same packet (same seq, `sentMonoMs`, body), requests the next backoff delay, and `Accepted` resets the backoff.
- A failed `open` calls `close`, sets `lastOutcome=OPEN_FAILED`, sleeps the backoff, then retries open.
- `SessionLost` and `Rejected` call `close`, `endSession`, `onSessionClosed`, then reopen immediately; the new session starts at `seq=1` with a fresh `beginSession`.
- An `Accepted` with a wrong session or seq is treated as session loss.
- `stop` while `open` is suspended cancels the job, closes the transport, ends the store, and a later open completion produces no session, send or state change.
- `stop` while `send` is suspended has the same result; a later send completion is ignored.
- A slow send does not cause catch-up: after its `Accepted`, the engine waits the full 10 s and does not send an extra packet.
- `onResubscribe` fires with the store's requested IDs.
- Calling `stop` twice does not double-close or crash; calling `start` twice while running does not open a second session.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd gaia-client && ./gradlew :app:testDebugUnitTest --tests '*CollectionEngineFailureTest' --no-daemon`
Expected: FAIL.

- [ ] **Step 3: Implement retry, session replacement and cancellation**

On `Retryable`, keep `pending`; on `SessionLost`/`Rejected`, clear it, close, end the session and break to an immediate reopen. On open failure, close and backoff. Use the injected `Backoff` for retryable/open-failure delays and reset it on `Accepted`. Consume resubscribe requests after each send attempt. Never update state or send after cancellation/stop.

- [ ] **Step 4: Run the test to verify it passes**

Run the same command. Expected: PASS.

- [ ] **Step 5: Stop point**

Keep changes uncommitted.

---

### Task 10: Battery mapper

**Files:**
- Create: `gaia-client/app/src/main/kotlin/com/hayaletev/gaiaclient/hardware/mapping/BatteryMapper.kt`
- Test: `gaia-client/app/src/test/kotlin/com/hayaletev/gaiaclient/hardware/mapping/BatteryMapperTest.kt`

**Interfaces:**
- Produces: `enum class ChargeStatus { UNKNOWN, CHARGING, DISCHARGING, NOT_CHARGING, FULL, OTHER }`.
- Produces: `data class BatteryReading(val level: Int?, val scale: Int?, val temperatureTenths: Int?, val voltageMv: Int?, val status: ChargeStatus?, val isInitialSticky: Boolean, val receiptMonoMs: Long)`.
- Produces: `object BatteryMapper { fun map(reading: BatteryReading): List<Sample> }`.

- [ ] **Step 1: Write the failing battery tests**

Assert:
- `isInitialSticky=true` returns an empty list even with valid fields.
- A new delivery with level 0/scale 100, temperature 199, voltage 0, status CHARGING returns four valid samples at `receiptMonoMs`; level 0 and voltage 0 are valid.
- Level `-1` or scale `-1` → missing; scale `0` → invalid; level `101`/scale `100` → invalid; level `255`/scale `255` → 100; level `1`/scale `3` → 33.
- Temperature absent → missing; 199 → 19.9 °C.
- Voltage `-1` → missing; `-2` → invalid; `4312` valid.
- Status null/UNKNOWN → missing; OTHER → invalid; all four valid states map correctly.
- Every valid/invalid sample uses `receiptMonoMs`; missing samples have no time.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd gaia-client && ./gradlew :app:testDebugUnitTest --tests '*BatteryMapperTest' --no-daemon`
Expected: FAIL.

- [ ] **Step 3: Implement `BatteryMapper`**

Return all four battery capabilities on every non-sticky delivery. Use floor integer division for the percentage, `tenths / 10.0` for temperature, `-1` as missing sentinel, and the charge-state mapping above. Keep the mapper free of Android imports.

- [ ] **Step 4: Run the test to verify it passes**

Run the same command. Expected: PASS.

- [ ] **Step 5: Stop point**

Keep changes uncommitted.

---

### Task 11: Accelerometer and proximity mappers

**Files:**
- Create: `gaia-client/app/src/main/kotlin/com/hayaletev/gaiaclient/hardware/mapping/SensorMappers.kt`
- Test: `gaia-client/app/src/test/kotlin/com/hayaletev/gaiaclient/hardware/mapping/SensorMappersTest.kt`

**Interfaces:**
- Produces: `data class AccelReading(val x: Float, val y: Float, val z: Float, val timestampNs: Long, val accuracy: Int)`; `object AccelMapper { fun map(reading: AccelReading): Sample }`.
- Produces: `data class ProximityReading(val distance: Float, val maxRange: Float, val timestampNs: Long, val accuracy: Int)`; `object ProximityMapper { fun map(reading: ProximityReading): Sample? }`.
- `accuracy == -1` means unreliable.

- [ ] **Step 1: Write the failing sensor tests**

Assert:
- Accelerometer copies x/y/z and floors `1_813_970_123_456` ns to `1_813_970` ms; `[0,0,0]` is valid; NaN/Infinity and unreliable accuracy are invalid at the event time.
- Proximity: distance 0 and `maxRange - 0.1` are `near`; distance exactly `maxRange` is `far`; negative, NaN or `maxRange + 0.1` are invalid; unreliable accuracy is invalid; non-finite or non-positive `maxRange` returns null (capability not offered); timestamps are floored to ms.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd gaia-client && ./gradlew :app:testDebugUnitTest --tests '*SensorMappersTest' --no-daemon`
Expected: FAIL.

- [ ] **Step 3: Implement both mappers**

Use `Float.isFinite()`, `timestampNs / 1_000_000L` (floor for non-negative values), and the near/far boundary above. Do not convert invalid readings to zero.

- [ ] **Step 4: Run the test to verify it passes**

Run the same command. Expected: PASS.

- [ ] **Step 5: Stop point**

Keep changes uncommitted.

---

### Task 12: Network and RSSI mappers

**Files:**
- Create: `gaia-client/app/src/main/kotlin/com/hayaletev/gaiaclient/hardware/mapping/NetworkMappers.kt`
- Test: `gaia-client/app/src/test/kotlin/com/hayaletev/gaiaclient/hardware/mapping/NetworkMappersTest.kt`

**Interfaces:**
- Produces: `sealed interface NetworkRead { data class None(val monoMs: Long); data class Available(val transports: Set<NetworkTransport>, val internetCapable: Boolean, val validated: Boolean, val monoMs: Long); data class Failed(val monoMs: Long) }`.
- Produces: `object NetworkMapper { fun map(read: NetworkRead): Sample }`.
- Produces: `data class RssiReading(val rssi: Int?, val wifiEnabled: Boolean, val connected: Boolean, val receiptMonoMs: Long)`; `object RssiMapper { fun map(reading: RssiReading): Sample }`.

- [ ] **Step 1: Write the failing network tests**

Assert:
- `NetworkRead.None` → valid `{none,false,false}` at `monoMs`.
- `Available` with wifi/internet/validated → valid; false bits survive; transport precedence wifi > cellular > other when multiple transports are present; empty transports → other.
- `Failed` → invalid at `monoMs`.
- RSSI: connected/enabled `-126`, `-67` and `0` are valid; `-127`, null, disabled or disconnected are missing; `1`, `-130` and `-128` are invalid; valid/invalid samples use `receiptMonoMs`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd gaia-client && ./gradlew :app:testDebugUnitTest --tests '*NetworkMappersTest' --no-daemon`
Expected: FAIL.

- [ ] **Step 3: Implement both mappers**

`NetworkMapper` chooses the transport by precedence and enforces `none` → both flags false. `RssiMapper` treats `-127` and null as missing, checks `wifiEnabled && connected`, and treats other out-of-range values as invalid.

- [ ] **Step 4: Run the test to verify it passes**

Run the same command. Expected: PASS.

- [ ] **Step 5: Stop point**

Keep changes uncommitted.

---

### Task 13: Installation identity store

**Files:**
- Create: `gaia-client/app/src/main/kotlin/com/hayaletev/gaiaclient/service/InstallationStore.kt`
- Test: `gaia-client/app/src/test/kotlin/com/hayaletev/gaiaclient/service/InstallationStoreTest.kt`

**Interfaces:**
- Produces: `class InstallationStore(private val dir: File) { fun getOrCreate(): String }`.

- [ ] **Step 1: Write the failing installation tests**

Using a temporary directory, assert:
- The first call creates `installation-id` with a lowercase UUIDv4 and returns it.
- The second call returns the same value.
- Invalid existing content is replaced with a new valid UUIDv4.
- No temporary file remains.
- The returned value is never written to stdout (the test only checks the file).

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd gaia-client && ./gradlew :app:testDebugUnitTest --tests '*InstallationStoreTest' --no-daemon`
Expected: FAIL.

- [ ] **Step 3: Implement `InstallationStore`**

Create the directory, read/validate the existing file, otherwise generate a UUIDv4 and write it through a temp file with `fd.sync()` then rename. Fall back to a direct write if rename fails. Delete the temp file. Do not log the ID.

- [ ] **Step 4: Run the test to verify it passes**

Run the same command. Expected: PASS.

- [ ] **Step 5: Stop point**

Keep changes uncommitted.

---

### Task 14: Android hardware snapshot source

**Files:**
- Create: `gaia-client/app/src/main/kotlin/com/hayaletev/gaiaclient/hardware/SystemMonoClock.kt`
- Create: `gaia-client/app/src/main/kotlin/com/hayaletev/gaiaclient/hardware/BatterySource.kt`
- Create: `gaia-client/app/src/main/kotlin/com/hayaletev/gaiaclient/hardware/SensorSource.kt`
- Create: `gaia-client/app/src/main/kotlin/com/hayaletev/gaiaclient/hardware/NetworkSource.kt`
- Create: `gaia-client/app/src/main/kotlin/com/hayaletev/gaiaclient/hardware/HardwareSnapshotSource.kt`

**Interfaces:**
- Produces: `object SystemMonoClock : MonoClock` using `SystemClock.elapsedRealtime()` and `System.currentTimeMillis()`.
- Produces: `class HardwareSnapshotSource(context: Context, clock: MonoClock)` with `val memory: SampleMemory`, `val found: List<CapabilityId>`, `fun start()`, `fun onSessionOpened(accepted: List<CapabilityId>, floorMonoMs: Long)`, `fun onSessionClosed()`, `fun refreshNetwork()`, `fun resubscribe(ids: Set<CapabilityId>)`, `fun dispose()`.
- Produces: the Android receiver/listener wiring that feeds `memory.offer(...)`.

- [ ] **Step 1: Implement the battery source**

Register `ACTION_BATTERY_CHANGED` at runtime with a system-broadcast-safe helper (`RECEIVER_EXPORTED` on API 33+, two-arg otherwise). Ignore `isInitialStickyBroadcast`; on every other delivery, map extras to `BatteryReading` with `receiptMonoMs = clock.elapsedRealtimeMs()` and offer every mapped sample. Map Android status codes: 1→UNKNOWN, 2→CHARGING, 3→DISCHARGING, 4→NOT_CHARGING, 5→FULL, other→OTHER; absent→null.

- [ ] **Step 2: Implement the sensor source**

Keep one `SensorEventListener` for accelerometer and proximity. On `onSensorChanged`, map with `event.timestamp / 1_000_000L` and `event.accuracy`; if the accelerometer value array is shorter than 3, emit invalid. `renew(accepted)` unregisters all, then registers the accepted sensors with `SENSOR_DELAY_NORMAL`; if registration returns false, offer `Sample.missing(id)`. `resubscribe(ids)` unregisters/registers only those sensors and clears them to missing. `release()` unregisters all. Do not register proximity when `maximumRange` is not finite/positive.

- [ ] **Step 3: Implement the network source**

`refresh()` queries `ConnectivityManager.activeNetwork` and `getNetworkCapabilities`, builds `NetworkRead.None`/`Available`/`Failed`, and offers `NetworkMapper.map(...)` at query time. Register `RSSI_CHANGED_ACTION` and `NETWORK_STATE_CHANGED_ACTION`. On RSSI, use `EXTRA_NEW_RSSI` or `connectionInfo.rssi` at notification time, check Wi-Fi enabled and connected (`networkId != -1`), and offer `RssiMapper.map(...)`. On disconnect, offer missing. Never poll the RSSI cache on a timer.

- [ ] **Step 4: Compose `HardwareSnapshotSource`**

Compute `found` in catalog order: battery and network always; accelerometer when the sensor exists; proximity when the sensor exists with valid `maximumRange`; signal when Wi-Fi hardware/service exists. `start()` registers battery and RSSI receivers. `onSessionOpened` renews sensors and resets the RSSI path; it does not call `memory.beginSession` again (the engine already did). `onSessionClosed` releases sensors and resets RSSI. `dispose()` unregisters everything and ends memory.

- [ ] **Step 5: Build to verify the Android glue compiles**

Run: `cd gaia-client && ./gradlew :app:assembleDebug --no-daemon`
Expected: `BUILD SUCCESSFUL`. Pure mapper tests from Tasks 10–12 must still pass.

- [ ] **Step 6: Stop point**

Keep changes uncommitted. Device behavior is validated in Task 18 only if SM-J701F is connected.

---

### Task 15: Foreground service, binder and stop path

**Files:**
- Create: `gaia-client/app/src/main/kotlin/com/hayaletev/gaiaclient/service/ServiceState.kt`
- Create: `gaia-client/app/src/main/kotlin/com/hayaletev/gaiaclient/service/ClientBinder.kt`
- Modify: `gaia-client/app/src/main/kotlin/com/hayaletev/gaiaclient/service/GaiaClientService.kt`
- Modify: `gaia-client/app/src/main/AndroidManifest.xml` (if the stub differs)

**Interfaces:**
- Produces: `enum class StopReason { USER, SYSTEM_TIMEOUT, DESTROYED }`; `data class ClientState(val running, val stopReason, val transportMode, val found, val accepted, val sessionShortId, val tickCount, val lastOutcome, val lastPacket)`; `fun interface ClientListener { fun onState(state: ClientState) }`.
- Produces: `class ClientBinder(val service: GaiaClientService) : Binder()`.
- Produces: `GaiaClientService` with `fun state(): ClientState`, `fun addListener(listener: ClientListener)`, `fun removeListener(listener: ClientListener)`, `fun requestStop(reason: StopReason = USER)`, `companion object { const val ACTION_START; const val ACTION_STOP; fun startIntent(context); fun stopIntent(context); @Volatile var isRunning }`.

- [ ] **Step 1: Implement the service state and binder**

`ClientState` carries exactly the fields the Activity needs. `ClientBinder` exposes the service. The service keeps a `CopyOnWriteArrayList<ClientListener>` and publishes on the main `Handler`.

- [ ] **Step 2: Implement service creation and Start**

`onCreate` creates the notification channel, calls `startForeground` immediately with a starting notification, and loads/creates the installation ID in `noBackupFilesDir`; on failure it uses an in-memory UUID without logging it. `onStartCommand` handles only explicit `ACTION_START`/`ACTION_STOP`, returns `START_NOT_STICKY`, and ignores a second Start while running. `startRun` creates a new `runId`, `HardwareSnapshotSource`, `FakeTransportAdapter` via `TransportProvider`, `SnapshotFactory`, and one `CollectionEngine`; it passes `source.memory` as the engine's store (never a second memory instance), sets `isRunning=true`, updates the notification and starts the engine. The engine's events renew/release subscriptions, refresh network before snapshots, resubscribe sensors, and publish state.

- [ ] **Step 3: Implement the shared Stop path**

`requestStop(reason)` is idempotent: set stopping, `isRunning=false`, cancel the engine (which closes the transport and ends the store), dispose the source, cancel/remove the notification, clear session/accepted/last packet, publish stopped state and call `stopSelf()`. `onDestroy` invokes the same path with `DESTROYED` if not already stopping and cancels the service scope. Add `onTimeout(startId)` calling `requestStop(SYSTEM_TIMEOUT)` for API 35+; it is compile-verified only on J701F. Notification Stop uses `PendingIntent.getService` with the explicit `ACTION_STOP`; the Activity will use the binder's `requestStop`.

- [ ] **Step 4: Build to verify the service compiles**

Run: `cd gaia-client && ./gradlew :app:assembleDebug --no-daemon`
Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 5: Stop point**

Keep changes uncommitted.

---

### Task 16: Simple TR/EN Activity

**Files:**
- Modify: `gaia-client/app/src/main/kotlin/com/hayaletev/gaiaclient/MainActivity.kt`
- Modify: `gaia-client/app/src/main/res/layout/activity_main.xml`
- Modify: `gaia-client/app/src/main/res/values/strings.xml`
- Modify: `gaia-client/app/src/main/res/values-tr/strings.xml`

**Interfaces:**
- Consumes: `ClientState`, `ClientListener`, `ClientBinder`, `GaiaClientService.startIntent/stopIntent/isRunning`, `requestStop`.
- Produces: a single scrollable observer screen with device info, Start/Stop, service state, local-test label, session/tick/outcome, found/accepted capabilities and last measurement per capability with quality and age.

- [ ] **Step 1: Build the layout and strings**

Use platform `ScrollView`, `LinearLayout`, `TextView` and `Button`; no Compose or AndroidX UI. Provide English `values/` and Turkish `values-tr/` strings for all labels, statuses, reasons, quality words, charge/proximity/transport names, notification text and the local-test label. The local-test label must say "Local test mode — no central connection" / "Yerel test modu — merkez bağlantısı yok".

- [ ] **Step 2: Implement Activity binding and Start/Stop**

On `onStart`, bind with `bindService(..., 0)` only when `GaiaClientService.isRunning`; on `onStop`, unbind and remove the listener. Start requests `POST_NOTIFICATIONS` on API 33+ and then calls `startForegroundService(ACTION_START)`, with a short retry to bind with flags 0. Stop calls the bound service's `requestStop(USER)` or sends `ACTION_STOP` if the service is running but not yet bound. Rotation/rebind only reattaches the listener.

- [ ] **Step 3: Render state and ages**

Show manufacturer/model, Android version/API and ABI. Render running/stopped and stop reason, local-test label, session short ID, tick count and last outcome ("local test accepted", never "delivered"). Show found and accepted capabilities. For each accepted capability in the last packet, show valid value + unit + age, invalid + age, or "no data". Refresh ages from `SystemClock.elapsedRealtime()` every second while resumed. Never show the installation ID.

- [ ] **Step 4: Build to verify the Activity compiles**

Run: `cd gaia-client && ./gradlew :app:assembleDebug --no-daemon`
Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 5: Stop point**

Keep changes uncommitted.

---

### Task 17: README, measurement report and GAIA.md result

**Files:**
- Create: `gaia-client/README.md`
- Create: `gaia-client/MEASUREMENT_REPORT.md`
- Modify: `GAIA.md`

**Interfaces:**
- Produces: build/run/test instructions, the B6 transport boundary, privacy constraints and the honest B5 result.

- [ ] **Step 1: Write the README**

Document: project scope; build with `./gradlew :app:assembleDebug`; tests with `./gradlew :app:testDebugUnitTest`; install/run; local test mode (no central connection, no real ACK); eight capabilities and time semantics; lifecycle and Stop; installation ID/no-backup; permissions; Android 15 `dataSync` timeout behavior; B6 replacement point (`TransportProvider.create` + `TransportAdapter`); and device validation status. Do not include the local SDK path, APK or raw measurements.

- [ ] **Step 2: Write the measurement report**

Record the base commit, build/test results, and the SM-J701F status. If J701F is not connected, state explicitly that real-device validation is unverified and list the pending checks (install, Start, notification, real accel/proximity/battery/network, HOME/screen-off, rotation/rebind, Stop from both paths, force-stop/reboot no-restart, PSS/RSS/CPU/temperature). If it is connected later, record only summary metrics and qualitative results; no serial numbers, raw logs or private identifiers.

- [ ] **Step 3: Update GAIA.md**

Change the top status sentence and the milestone table row from "B5 sıradaki" to "B5 uygulandı; gerçek cihaz doğrulaması ve bağımsız kabul bekliyor". Add a concise `### 03-B5 — Android Client servis ve toplama` section after the B4 section covering scope, architecture, JVM tests/build result, device status, B6 boundary, and that `check:all`/commit/push were not run. Do not claim acceptance.

- [ ] **Step 4: Stop point**

Keep changes uncommitted.

---

### Task 18: Full verification and optional SM-J701F run

**Files:**
- No source changes expected.

**Interfaces:**
- Consumes: all previous tasks.

- [ ] **Step 1: Run the complete JVM suite and debug build**

Run: `cd gaia-client && ./gradlew :app:testDebugUnitTest :app:assembleDebug --no-daemon`
Expected: all tests pass and `BUILD SUCCESSFUL`. Record the test count and APK path (path only, not the APK in Git).

- [ ] **Step 2: Check device availability without touching SM-J700F**

Run: `adb devices -l`. If SM-J701F is absent, record "real-device validation pending: SM-J701F not connected" and skip to Step 4. Do not run any command against SM-J700F.

- [ ] **Step 3: If SM-J701F is connected, run the device checklist**

Install the debug APK, start from the Activity, confirm the foreground notification, observe real accelerometer/proximity/battery/network samples (battery may remain missing until a genuinely new broadcast; RSSI may remain missing when Wi-Fi is off), press HOME and run a short screen-off interval, rotate/rebind, Stop from the Activity and from the notification, force-stop and reboot to confirm no restart, and capture PSS/RSS, CPU and temperature if available. Stop the service at the end. Do not uninstall the diagnostic app, change phone settings, root, alter Wi-Fi, or install a real certificate.

- [ ] **Step 4: Final stop point**

Update `gaia-client/MEASUREMENT_REPORT.md` and the `GAIA.md` B5 section with the actual results. Do not run `check:all`, do not commit, do not push. Leave the working tree for independent acceptance.

---

## Self-Review Notes

- **Spec coverage:** independent app (Task 1), eight capabilities and time semantics (Tasks 2–4, 10–12, 14), lifecycle and shared Stop (Task 15), snapshot/sender separation and fake transport (Tasks 3–9), UI (Task 16), B1 fixture validation (Tasks 2, 6), installation/no-backup (Tasks 1, 13), device validation/report (Tasks 17–18), B6 boundary (Tasks 7, 15, 17).
- **Commit steps are intentionally omitted:** the user's B5 instruction reserves commit, push and `check:all` for independent acceptance.
- **Type consistency:** `SampleStore` is consumed by `CollectionEngine`; `SampleMemory` implements it; `HardwareSnapshotSource.memory` is that store; `SessionOpenContext` carries identity through the B6 seam; `EngineState` feeds `ClientState`.
- **Uncovered input classes are pinned in Review Focus:** sticky battery, session evidence floor, stop races, unknown sentinels and offline network each have a named test task.
