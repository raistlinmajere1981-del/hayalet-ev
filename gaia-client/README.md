# Gaia Client

The Android client collects eight Gaia capabilities in a user-started foreground service and posts snapshots to its paired field center. It requires Android 9 (API 28) or later. The application ID is `com.hayaletev.gaiaclient`.

## Pair over USB

1. On the stopped Client, select **Export USB request** and choose a document in the Android file picker. Transfer that JSON to the trusted center. Compare the full installation UUID and SHA-256 SPKI fingerprint displayed on the phone against the center's inspection of the request.
2. At the center, approve the inventory device, capabilities and HTTPS origin. Transfer the resulting installation JSON to the phone. Obtain the CA SHA-256 fingerprint separately from the trusted center display.
3. Select **Import installation**, choose the package and enter that CA fingerprint. A successful import displays the project, device, origin and fingerprints. Complete the local approval at the center, then press **Start**. The foreground notification and Activity both expose **Stop**.

The existing B5 installation UUID remains in app-private, non-backed-up storage. Each CSR uses a P-256 signing key inside Android Keystore. Exporting a request again reuses the pending key. For renewal, export a new request from the paired phone. The active key continues to match the installed certificate while its replacement awaits approval. The client verifies the entire signed package and proves possession of the corresponding private key before atomically publishing the new alias, pin and package. Retry an interrupted import with the same file. A missing key, corrupt identity or partial package blocks field use.

Pairing mutations and collection share one process-wide identity lease. An
Activity recreation does not release a pending import/export operation, and Stop
releases the run lease only after the engine has drained. A busy identity must
be retried after the previous operation completes.

For a clock or certificate error, compare Android's system time against the trusted center. Correct it in Android Settings if necessary, then import or start again. A 403 stops collection and requires local review. A connection failure retains a pending snapshot until its session expires. The APK uses field transport exclusively. The fake adapter is in JVM test sources.

## Collection and delivery

The B5 hardware sources retain their event-time and quality semantics. The service owns one latest sample per capability and one frozen UTF-8 request. A valid HTTP 201 establishes a 10 s interval and a 35 s timeout. Only a matching HTTP 200 ACK with a valid `acceptedAt` advances the sequence. EOF, timeout, redirects and incorrect ACKs keep the original bytes available for retry. Rate limiting and transient failures observe the longer of full-jitter backoff and integer-seconds `Retry-After`. A new session starts with fresh evidence at sequence one.

Each POST uses a fresh, mutually authenticated TLS connection to the signed origin. The client checks the pinned field chain, exact DNS or binary IP SAN, certificate profiles and dates. Requests and responses use uncompressed UTF-8 JSON. Limits are 16 KiB for a body, 8 KiB for headers and five levels for JSON. Stop closes the underlying socket. The platform system resolver runs in a private bound process for DNS names so an outstanding API 28 lookup can also be interrupted. Android clock-change events interrupt in-flight I/O. The request deadline also monitors wall-clock displacement against elapsed realtime.

The foreground service is `START_NOT_STICKY`. Stop, force-stop and reboot require another user Start. Each start gets a new run ID. On API 35 a data-sync timeout follows the same cleanup path.

## Build and verify

From the repository root with its Node dependencies, Android SDK and Java installed, use a single Gradle invocation.

```sh
cd gaia-client
./gradlew :app:testDebugUnitTest :app:assembleDebug :app:assembleDebugAndroidTest
```

The installable APK is `app/build/outputs/apk/debug/app-debug.apk`. The JVM suite reads the shared v1 fixtures and starts a temporary Node loopback receiver using the repository's B3/2 issuer and authorization modules. The receiver creates an isolated inventory and signing medium for each run.

For the SM-J701F measurement, install the debug APK and the instrumentation APK under `app/build/outputs/apk/androidTest/debug/` on that serial, then run `python app/src/test/interop/probe.py SERIAL` from this directory. The probe uses disposable app-cache state and test aliases. With a current clock it uses a temporary USB reverse to the loopback receiver. With the observed 2017 clock it measures rejection at import. Device measurements and outstanding verification are in [MEASUREMENT_REPORT.md](MEASUREMENT_REPORT.md).
