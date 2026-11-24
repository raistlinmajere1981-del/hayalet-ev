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

`engine canonical state -> build bounded AI0 packet -> isolated runtime workspace -> provider -> parse unknown response -> validate request/legality -> engine accepts/rejects -> canonical state`

AI0 never writes canonical state directly.

## Workspace materialization — shared AI0 runtime

The live room transport calls the shared AI0 host through the \`fate-knots-ai0-call\` room tool. The Electron adapter sanitizes the public packet and selects the NPC scope; the shared Agent Profile Registry resolves the policy and creates an isolated app-data workspace containing the resolved AGENTS.md. The session denies tool execution for NPC calls.

See \`docs/ai0-runtime.md\`, \`electron/ai0/fate-knots-adapter.ts\`, \`electron/ai0/runtime-host.ts\` and \`electron/agent-profile-workspace.ts\`. The older room-local workspace recipe and provider-neutral transport are retained as tested domain contracts, not the live filesystem adapter.

## Provider response boundary — implemented

Provider output is untrusted `unknown` data, not a TypeScript response merely because the caller expects one.

`shared/ai0-runtime.ts` now applies two gates:

1. `parseFateKnotsAi0RuntimeResponse(candidate)` checks the permitted response shape and rebuilds a bounded response containing only recognized fields. Unknown provider fields are discarded.
2. `gateFateKnotsAi0ProviderResponse(request, candidate)` then applies request-id, response-kind, legal interaction, legal card and legal primary-target checks.

Malformed provider output and mechanically illegal choices therefore never become accepted AI0 responses.

## Provider-neutral transport authority — implemented

`host/ai0-transport.ts` fixes the launch order without choosing a concrete provider/wrapper syntax.

`invokeFateKnotsAi0Runtime` requires explicit host runtime context containing:

- the canonical `universeId` used only for workspace routing,
- the bounded dialogue/combat request.

The combat-visible packet is not widened with `universeId` merely to choose a filesystem workspace. Dialogue requests are also checked so their role-packet universe matches the explicit transport context.

The transport then:

1. prepares the isolated per-universe workspace,
2. rejects a workspace whose runtime profile does not match the Fate Knots NPC profile,
3. invokes an injected provider adapter with the isolated workspace, fixed empty-tool runtime profile and a cloned bounded request,
4. treats the provider result as `unknown`,
5. passes it through the response parser + legality gate,
6. returns only the accepted bounded response.

Workspace failures, provider exceptions and rejected provider responses are reduced to bounded host error categories rather than leaking filesystem/provider internals into gameplay.

## Remaining provider integration boundary

The isolation, materialization, response validation and provider-neutral transport shell are implemented, but AI0 is **not yet connected to a concrete Hayalet Ev provider/wrapper**.

The remaining Stage C work is now deliberately narrow:

1. implement/select the real provider adapter that satisfies `FateKnotsAi0ProviderAdapter`,
2. make that adapter use the transport-supplied `workspaceDir` as its actual bootstrap/working directory,
3. ensure the provider/wrapper does not reattach repository policy, coding-agent memory or tools outside the supplied runtime profile,
4. route NPC dialogue and delegated combat calls through `invokeFateKnotsAi0Runtime` rather than calling the provider directly.

Exact provider/wrapper command syntax remains deliberately unresolved until the real Hayalet Ev transport surface is selected.

Do not modify root `AGENTS.md` to special-case Fate Knots. Development-agent behavior and game-runtime behavior must stay separate.
