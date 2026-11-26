# Gaia wire protocol v1

Shared wire contract and fixtures for the Android Gaia Client and the TypeScript
receiver. `GAIA-CLIENT-PROTOCOL.md` is the normative source; this directory only
implements the B1 slice: versioned schemas, a capability catalog, and
positive/negative fixtures. It does not implement HTTPS, TLS enrollment, session
state, the status model, the Android app, or a general JSON/network framework.

## Layout

```text
gaia-protocol/v1/
  src/schema.ts                 zod authority, types, generated-document builders
  src/semantics.ts              reference cross-field and session-context checks
  schema/*.schema.json          generated JSON Schema draft 2020-12 artifacts
  schema/capabilities.json      generated capability catalog
  fixtures/manifest.json        fixture index with layer and expectation
  fixtures/valid/               schema-valid messages
  fixtures/invalid/schema/      schema-level rejections
  fixtures/invalid/semantic/    schema-valid but context/field violations
  fixtures/raw/                 pre-parse and transport-boundary fixtures
  scenarios/t1.json             session-open intersection scenario
  scenarios/t2.json             zero/false/enum/vector/quality scenario
  scripts/generate-artifacts.ts regenerates schema/ from src/schema.ts
```

## Commands

```bash
npm run gaia-protocol:schemas   # regenerate schema/*.json
npm run gaia-protocol:test      # run the focused fixture test
```

`test:all` discovers `scripts/tests/*.test.ts`, so the focused test is part of the
normal chain. `format`, `format:check`, `lint`, `lint:strict`, and
`scripts:typecheck` include `gaia-protocol/**/*.ts`; the test is also covered by
the `scripts` TypeScript project.

## Single authority

`src/schema.ts` is the authority. The checked-in JSON Schema files are generated
with `z.toJSONSchema({ target: "draft-2020-12", io: "input" })` and must not be
hand-edited. `capabilities.json` is generated from the same capability
definitions. The test compares the parsed artifacts with the authority, so run
the generator after changing a schema or capability.

The Android side can use the JSON Schema files and `capabilities.json` as contract artifacts; B5/B6 must implement and verify equivalent validation on Android. The TypeScript side imports the zod schemas and inferred types.

## What the schema validates

- Message envelope and protocol version (`v: 1`), required fields, and no extra
  fields (`additionalProperties: false`).
- Lowercase UUIDv4 identifiers, existing project/device `segment` rules, and the
  capability ID syntax. `offered` accepts unknown but syntactically valid IDs so
  the server can filter them.
- At most 32 unique capabilities. `accepted` is restricted to the eight v1 field
  capabilities; `offered` is not restricted to the catalog.
- Non-negative safe-integer times, `seq` from 1 through 2^53−1, and finite
  numbers.
- Per-capability sample unions: `valid`, `invalid`, and `missing` with the
  correct unit, value type, and required/forbidden `sampleMonoMs`.
- Closed enums, a three-number accelerometer vector, the closed network object,
  battery level/voltage/RSSI ranges, and battery pack temperature as a finite
  number. Ambient temperature is not a v1 capability.
- The error-code enum and the initial v1 session timing profile (10000 ms / 35000 ms).

## What the schema does not validate

JSON Schema alone cannot prove session context, duplicate raw keys, or transport
authorization. These obligations stay with later packages:

| Package             | Runtime obligation                                                                                                                                                                             |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B2 status model     | Enforce the active accepted set, per-sample time, quality and snapshot rules; keep v1/v2/v3 sidecar behavior; never derive freshness from a wall clock.                                        |
| B4 session/delivery | Enforce per-session `seq` monotonicity, same-body replay, body hash, conflict rejection, deadline/timeout, ACK correlation, and accepted-set membership.                                       |
| B6 Android mTLS/ACK | Validate UTF-8, duplicate keys, body/depth limits and content type before/while parsing; enforce certificate authorization; correlate ACK session/seq; clean up sockets, timers and listeners. |
| B7 main integration | Enforce HTTPS listener budgets, header/body limits, JSON safety, session authorization, single-writer/atomic publish, `Cache-Control: no-store`, and UI-less ingest.                           |

Additional checks that are schema-valid but semantically invalid:

- Duplicate sample IDs (JSON Schema `uniqueItems` applies to arrays, not to a
  uniqueness key inside objects).
- Samples outside `accepted`, or a missing accepted capability in any
  packet (empty heartbeat is valid only for an empty accepted set).
- `sampleMonoMs > sentMonoMs`, regressing sample times, or a new `seq` whose
  send time moves backwards.
- `accepted` not being a subset of `offered`.
- ACK `sessionId` or `seq` not matching the packet.
- Replay, sequence gaps, expired sessions, and authorization/epoch changes.

`src/semantics.ts` provides small reference helpers for some of these checks so
fixtures can prove the layer split. They are not a session state machine and do
not replace the B4/B6/B7 implementations.

## Fixture layers

Every fixture is listed in `fixtures/manifest.json`. The `layer` field states how
the fixture must be consumed:

- `schema`: parse JSON, then validate with the declared zod schema. `expect`
  records whether it passes.
- `semantic`: must pass the declared schema, then fail the named reference check
  using the manifest `context`.
- `raw`: read the file as bytes. The violation is hidden by `JSON.parse` or is a
  transport limit, so the runtime check must happen before or around parsing.

Raw fixtures are intentionally excluded from Prettier. Do not reformat,
re-serialize, or pretty-print them. In particular:

- `observation-duplicate-key.json` keeps both `seq` keys; `JSON.parse` keeps the
  last value and the parsed object is still schema-valid, proving that schema
  validation alone cannot detect the duplicate.
- `observation-prototype-keys.json` keeps `__proto__`, `constructor`, and
  `prototype` keys; the parsed object must not pollute `Object.prototype`.
- `observation-invalid-utf8.bin` contains invalid UTF-8 bytes and must be decoded
  with a fatal UTF-8 decoder.
- `observation-body-limit-exact.json` is exactly 16 KiB; the `+1` variant is one
  byte over. Both parse to schema-valid packets, so only the raw byte check
  distinguishes them.
- `observation-depth-too-deep.json` exceeds JSON depth 5.
- `observation-unsafe-integer-literal.json` contains `9007199254740993`, which
  becomes an unsafe integer after parsing.
- `observation-non-finite.json` contains `1e400`, which becomes `Infinity` after
  parsing and must be rejected as a non-finite value.

## Capability catalog

| ID                            | Unit   | Valid value                                                                       |
| ----------------------------- | ------ | --------------------------------------------------------------------------------- |
| `battery.level.v1`            | `%`    | Integer 0–100                                                                     |
| `battery.pack-temperature.v1` | `°C`   | Finite number; battery pack, not ambient                                          |
| `battery.voltage.v1`          | `mV`   | Non-negative safe integer                                                         |
| `battery.charge-state.v1`     | `1`    | `charging`, `discharging`, `full`, `not_charging`                                 |
| `accelerometer.xyz.v1`        | `m/s²` | Exactly three finite numbers                                                      |
| `proximity.state.v1`          | `1`    | `near`, `far`                                                                     |
| `network.state.v1`            | `1`    | `{transport, internetCapable, validated}`; `none` implies both booleans are false |
| `signal.read.v1`              | `dBm`  | Integer −126–0                                                                    |

Zero, `false`, and `[0, 0, 0]` are valid values in their own types. `missing` has
no `sampleMonoMs`; `invalid` has a failure time and `value: null`. A valid sample
must carry its event/read time and a catalog-typed value.

## Scenarios

`scenarios/t1.json` offers the eight capabilities plus unknown `camera.view.v1`,
removes one capability from the inventory and another from the central
permission, and expects only the intersection in `accepted`. The semantic
fixtures also cover missing, duplicate, and unapproved samples.

`scenarios/t2.json` pins zero battery level, zero vector, false network flags,
closed enums, negative RSSI, sentinel/missing/invalid qualities, and rejected
wrong-unit, wrong-type, infinite, bad-vector, and out-of-range proximity cases.
The battery pack temperature sample stays separate from ambient temperature.

## Adding a fixture

1. Add the JSON or raw file under the matching `fixtures/` directory.
2. Add one manifest case with `id`, `file`, `schema`, `expect`, `layer`, and
   either `violation`, `check`, or `context` as appropriate.
3. Run `npm run gaia-protocol:test`.

The test fails if a fixture file is missing from the manifest, if a manifest
entry points to a missing file, or if a fixture does not behave as declared.
