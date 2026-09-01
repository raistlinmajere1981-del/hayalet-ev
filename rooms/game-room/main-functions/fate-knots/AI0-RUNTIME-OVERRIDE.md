# Fate Knots — AI0 Runtime Override

Fate Knots uses AI0 as an in-world NPC actor, not as the Hayalet Ev coding assistant.

The normal repository agent policy is therefore the wrong bootstrap surface for Fate Knots runtime calls. Root `AGENTS.md` and `.rovo/*` are development-agent instructions: they describe MCP discovery, file editing, mode switching, project memory bootstrap and coding workflows. Loading them into an NPC turn wastes context and can leak the wrong role into gameplay.

## Runtime isolation law

A Fate Knots AI0 runtime call must not start from a working directory inside the Hayalet Ev repository tree.

The current materializer uses the Game Room managed app-data storage root and creates a per-universe workspace equivalent to:

`<dataDir>/room-storage/game-room/fate-knots/ai0-runtime/<universeId>/`

This remains outside the repository tree while also staying inside Hayalet Ev's existing room-managed storage boundary.

That workspace may contain only the minimal runtime policy required by the selected provider/agent wrapper. It must not copy or inherit:

- root `AGENTS.md`
- `.rovo/MODES.md`
- `.rovo/WORKFLOWS.md`
- `.rovo/MEMORY.md`
- `.rovo/03-ARCHITECTURE.md`
- MCP tool catalogs
- repository tree/context
- coding-agent conversation history

A prompt that merely says "ignore AGENTS.md" is not sufficient because the context cost has already been paid once the file is loaded. Isolation must happen before agent bootstrap.

## Minimal AI0 runtime policy

The generated runtime policy communicates only these invariants:

- You are an NPC actor inside Fate Knots.
- You are not a coding assistant and do not inspect or modify Hayalet Ev.
- Use only the supplied NPC/combat packet as knowledge.
- Do not invent hidden canon, mechanical outcomes, items, stats or unavailable actions.
- Do not request tools, MCP discovery, filesystem access, shell access, web access or project memory.
- For dialogue, portray only the supplied NPC and stay inside its known/persona facts.
- For combat, choose only from engine-provided legal options.
- Engine state and legality always override your prose or choice.
- Return only the response shape requested by the current packet.

The exact provider wrapper syntax may vary; these semantic rules do not.

## No runtime tools by default

Fate Knots AI0 runtime has an empty tool capability set in V1.

NPC dialogue and tactical choice do not require:

- filesystem tools
- shell
- GitHub
- MCP
- Shared Memory
- web browsing
- image generation

World Forge asset/image generation is a different authority surface and is not an AI0 NPC runtime responsibility.

If a later gameplay feature genuinely requires a tool, add that capability explicitly to a dedicated gameplay contract rather than exposing the normal Hayalet Ev development toolset.

## Packet-owned continuity

AI0 runtime calls should be short and packet-driven rather than depending on a long-lived coding-agent session.

Continuity belongs to canonical engine data:

- persona facts
- known facts
- relationship facts
- current location/scene facts
- legal interaction ids
- visible combat state
- legal combat options

The engine may update these facts after accepted actions. A later AI0 call receives the refreshed packet. This keeps NPC continuity deterministic and bounded without carrying unrelated conversation/tool history.

## Recommended call shape

`engine canonical state -> build bounded AI0 packet -> isolated runtime workspace -> AI0 response -> validate response -> engine accepts/rejects -> canonical state`

AI0 never writes canonical state directly.

## Workspace materialization — implemented

The filesystem side of the isolation boundary now exists in:

- `host/ai0-workspace.ts`
- `host/ai0-workspace-electron.ts`

The materializer:

1. obtains the Game Room managed `storageDir` through the existing `roomToolsCall({ operation: "resolve-paths" })` boundary,
2. derives the per-universe path only from `buildFateKnotsAi0WorkspaceSpec`,
3. deletes the previous universe workspace recursively,
4. recreates the empty workspace through `roomToolsCall({ operation: "ensure-dir" })`,
5. writes only the declared minimal `AGENTS.md` policy,
6. returns the isolated workspace path/profile identifier to the future provider transport.

Deleting the universe workspace before recreation is intentional. It prevents stale files from a previous runtime version from silently joining AI0 context.

The preparation entry point is:

`prepareFateKnotsAi0RuntimeWorkspace(universeId)`

A provider transport should call this immediately before launching an AI0 runtime session.

## Remaining provider integration boundary

Physical workspace preparation is implemented, but AI0 is **not yet launched through a real provider/wrapper**.

The remaining Stage C transport work must:

1. call `prepareFateKnotsAi0RuntimeWorkspace` before each provider session/launch that can bootstrap workspace policy,
2. set that returned workspace as the provider's runtime working/bootstrap directory,
3. disable repository policy inheritance by virtue of that external workspace,
4. expose an empty coding/MCP tool capability set,
5. send only the current Fate Knots dialogue/combat packet,
6. validate the returned structured response with the existing AI0 response validator before forwarding it to the engine.

Exact provider/wrapper command syntax remains deliberately unresolved until the real Hayalet Ev transport surface is selected.

Do not modify root `AGENTS.md` to special-case Fate Knots. Development-agent behavior and game-runtime behavior must stay separate.
