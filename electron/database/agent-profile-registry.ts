import { createHash } from "node:crypto";
import type { BetterSqlite3Database } from "../native/better-sqlite3.js";
import { AGENT_CHARACTER_FEATURES } from "../../shared/agent-character-features.js";
import type {
  AgentCapabilitySnapshot,
  AgentCharacterEditorState,
  AgentCharacterProfile,
  AgentInstruction,
  AgentProfileResolution,
  AgentProfileScope,
} from "../../shared/agent-profiles.js";

const RESOLVER_VERSION = 1;
const ISOLATION_POLICY =
  "Use only the instructions and public task context supplied for this agent. Never read or inherit development-agent memory, credentials, tools, workspace policies, or hidden game state. Personality preferences do not grant capabilities or override task constraints. Use only capabilities attested by the host; report missing capabilities honestly.";

export function validateProfileScope(value: unknown): asserts value is AgentProfileScope {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid profile scope");
  const scope = value as Record<string, unknown>;
  if (scope["purpose"] !== "runtime" && scope["purpose"] !== "development")
    throw new Error("Invalid profile purpose");
  for (const identifier of [scope["agentId"], scope["roomId"], scope["roleId"]]) {
    if (typeof identifier !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(identifier))
      throw new Error("Invalid profile scope identifier");
  }
}

function scopeKey(scope: AgentProfileScope): string {
  validateProfileScope(scope);
  return JSON.stringify([scope.purpose, scope.agentId, scope.roomId, scope.roleId]);
}

function validateId(id: string): void {
  if (typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(id))
    throw new Error("Invalid registry identifier");
}

function validateText(text: string, limit: number): void {
  if (typeof text !== "string" || text.length > limit) throw new Error("Invalid registry text");
}

export class AgentProfileRegistry {
  constructor(private readonly db: BetterSqlite3Database) {
    db.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS agent_character_features (id TEXT PRIMARY KEY, content TEXT NOT NULL, version INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS agent_registry_meta (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS agent_instructions (id TEXT PRIMARY KEY, purpose TEXT NOT NULL, layer TEXT NOT NULL, target_id TEXT NOT NULL, content TEXT NOT NULL, version INTEGER NOT NULL, UNIQUE(purpose,layer,target_id));
      CREATE TABLE IF NOT EXISTS agent_profiles (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL, features TEXT NOT NULL, instruction_id TEXT REFERENCES agent_instructions(id) ON DELETE SET NULL, requested_capabilities TEXT NOT NULL, version INTEGER NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS agent_profile_selections (scope TEXT PRIMARY KEY, profile_id TEXT NOT NULL REFERENCES agent_profiles(id) ON DELETE CASCADE);
    `);
    if (db.prepare("SELECT id FROM agent_registry_meta WHERE id=1").get() === undefined)
      this.seed();
  }

  private transaction<T>(run: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = run();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  private seed(): void {
    this.transaction(() => {
      this.db.prepare("INSERT INTO agent_registry_meta VALUES (1,0)").run();
      for (const [id, content] of Object.entries(AGENT_CHARACTER_FEATURES))
        this.db.prepare("INSERT INTO agent_character_features VALUES (?,?,1)").run(id, content);
      for (const purpose of ["runtime", "development"] as const) {
        this.writeInstruction(
          {
            id: `base-${purpose}`,
            purpose,
            layer: "base",
            targetId: "*",
            content:
              purpose === "runtime"
                ? "Perform the assigned public task within this agent's scope."
                : "Help the user work on Hayalet Ev. Follow the development workspace policy when working in that workspace.",
          },
          1
        );
      }
      this.writeInstruction(
        {
          id: "fate-knots-npc-role",
          purpose: "runtime",
          layer: "role",
          targetId: "fate-knots-npc",
          content:
            "Act as the assigned Fate Knots NPC. Use only public scene facts and the character's disclosed knowledge. Never infer or disclose game-master secrets or hidden state.",
        },
        1
      );
      this.writeInstruction(
        {
          id: "fate-knots-image-role",
          purpose: "runtime",
          layer: "role",
          targetId: "fate-knots-image",
          content:
            "Prepare Fate Knots visual prompts from the supplied public scene and art direction. Generate images only when the host confirms an image-generation capability. Otherwise return a prompt and report that generation is unavailable.",
        },
        1
      );
      const seeds = [
        {
          id: "normal",
          name: "Normal",
          features: ["tone-friendly", "detail-normal"],
          instructionId: null,
          capabilities: [],
        },
        {
          id: "serious",
          name: "Ciddi/İş Odaklı",
          features: ["tone-formal", "tone-emoji-none", "style-direct", "pers-pragmatic"],
          instructionId: null,
          capabilities: [],
        },
        {
          id: "inquisitive",
          name: "Ayrıntılı Sorgulayan",
          features: ["detail-verbose", "style-ask-unclear", "pro-fullanalysis"],
          instructionId: null,
          capabilities: [],
        },
        {
          id: "fate-knots-npc",
          name: "Fate Knots NPC",
          features: ["tone-casual", "detail-normal"],
          instructionId: "fate-knots-npc-role",
          capabilities: [],
        },
        {
          id: "fate-knots-image",
          name: "Fate Knots Görsel Üreticisi",
          features: ["detail-verbose"],
          instructionId: "fate-knots-image-role",
          capabilities: ["image-generation"],
        },
      ];
      for (const seed of seeds)
        this.writeProfile(
          {
            id: seed.id,
            name: seed.name,
            description: "",
            selectedFeatureIds: seed.features,
            instructionId: seed.instructionId,
            requestedCapabilities: seed.capabilities,
            version: 1,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
          1
        );
    });
  }

  get revision(): number {
    return (
      this.db
        .prepare<[], { revision: number }>("SELECT revision FROM agent_registry_meta WHERE id=1")
        .get()?.revision ?? 0
    );
  }

  private bump(): void {
    this.db.prepare("UPDATE agent_registry_meta SET revision=revision+1 WHERE id=1").run();
  }

  list(): AgentCharacterProfile[] {
    const rows = this.db
      .prepare<
        [],
        {
          id: string;
          name: string;
          description: string;
          features: string;
          instruction_id: string | null;
          requested_capabilities: string;
          version: number;
          created_at: number;
          updated_at: number;
        }
      >("SELECT * FROM agent_profiles ORDER BY created_at,id")
      .all();
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      selectedFeatureIds: JSON.parse(row.features) as string[],
      instructionId: row.instruction_id,
      requestedCapabilities: JSON.parse(row.requested_capabilities) as string[],
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  listInstructions(purpose: AgentProfileScope["purpose"]): AgentInstruction[] {
    if (!["development", "runtime"].includes(purpose)) throw new Error("Invalid purpose");
    return this.db
      .prepare<[string], { id: string }>(
        "SELECT id FROM agent_instructions WHERE purpose=? ORDER BY layer,target_id"
      )
      .all(purpose)
      .map((row) => this.instruction(row.id))
      .filter((item): item is AgentInstruction => item !== null);
  }

  saveProfile(
    profile: Omit<AgentCharacterProfile, "version" | "createdAt" | "updatedAt">,
    expectedVersion: number
  ): AgentCharacterProfile {
    return this.transaction(() => {
      const existing = this.list().find((item) => item.id === profile.id);
      if ((existing?.version ?? 0) !== expectedVersion) throw new Error("Profile version conflict");
      this.writeProfile(
        { ...profile, version: expectedVersion + 1, createdAt: Date.now(), updatedAt: Date.now() },
        expectedVersion + 1
      );
      const stored = this.list().find((item) => item.id === profile.id);
      if (!stored) throw new Error("Profile write failed");
      const selections = this.db
        .prepare<[string], { scope: string }>(
          "SELECT scope FROM agent_profile_selections WHERE profile_id=?"
        )
        .all(profile.id);
      for (const selection of selections) {
        const [purpose, agentId, roomId, roleId] = JSON.parse(selection.scope) as [
          AgentProfileScope["purpose"],
          string,
          string,
          string,
        ];
        this.compatible(stored, { purpose, agentId, roomId, roleId });
      }
      this.bump();
      return stored;
    });
  }

  deleteProfile(id: string, expectedVersion: number): void {
    this.transaction(() => {
      const existing = this.list().find((item) => item.id === id);
      if (existing?.version !== expectedVersion) throw new Error("Profile version conflict");
      this.db.prepare("DELETE FROM agent_profiles WHERE id=?").run(id);
      this.bump();
    });
  }

  private instruction(id: string): AgentInstruction | null {
    const row = this.db
      .prepare<
        [string],
        {
          id: string;
          purpose: AgentInstruction["purpose"];
          layer: AgentInstruction["layer"];
          target_id: string;
          content: string;
          version: number;
        }
      >("SELECT * FROM agent_instructions WHERE id=?")
      .get(id);
    return row
      ? {
          id: row.id,
          purpose: row.purpose,
          layer: row.layer,
          targetId: row.target_id,
          content: row.content,
          version: row.version,
        }
      : null;
  }

  private layer(
    scope: AgentProfileScope,
    layer: AgentInstruction["layer"],
    target: string
  ): AgentInstruction | null {
    const row = this.db
      .prepare<[string, string, string], { id: string }>(
        "SELECT id FROM agent_instructions WHERE purpose=? AND layer=? AND target_id=?"
      )
      .get(scope.purpose, layer, target);
    return row ? this.instruction(row.id) : null;
  }

  private compatible(profile: AgentCharacterProfile, scope: AgentProfileScope): void {
    if (profile.instructionId !== null) {
      const instruction = this.instruction(profile.instructionId);
      if (
        instruction?.purpose !== scope.purpose ||
        instruction.layer !== "role" ||
        instruction.targetId !== scope.roleId
      )
        throw new Error("Profile task instructions do not match this scope");
    }
  }

  selected(scope: AgentProfileScope): AgentCharacterProfile {
    const row = this.db
      .prepare<[string], { profile_id: string }>(
        "SELECT profile_id FROM agent_profile_selections WHERE scope=?"
      )
      .get(scopeKey(scope));
    const profile = this.list().find((p) => p.id === (row?.profile_id ?? "normal"));
    if (!profile) throw new Error("Select a profile for this scope");
    this.compatible(profile, scope);
    return profile;
  }

  select(scope: AgentProfileScope, profileId: string): void {
    this.transaction(() => {
      this.writeSelection(scope, profileId);
      this.bump();
    });
  }

  private writeSelection(scope: AgentProfileScope, profileId: string): void {
    const key = scopeKey(scope);
    const profile = this.list().find((p) => p.id === profileId);
    if (!profile) throw new Error("Profile not found");
    this.compatible(profile, scope);
    this.db
      .prepare(
        "INSERT INTO agent_profile_selections VALUES (?,?) ON CONFLICT(scope) DO UPDATE SET profile_id=excluded.profile_id"
      )
      .run(key, profileId);
  }

  editorRead(scope: AgentProfileScope): AgentCharacterEditorState {
    const row = this.db
      .prepare<[string], { profile_id: string }>(
        "SELECT profile_id FROM agent_profile_selections WHERE scope=?"
      )
      .get(scopeKey(scope));
    const profiles = this.list();
    return {
      revision: this.revision,
      profiles,
      activeProfileId: row?.profile_id ?? profiles.find((p) => p.id === "normal")?.id ?? null,
    };
  }

  private writeProfile(profile: AgentCharacterProfile, version: number): void {
    validateId(profile.id);
    validateText(profile.name, 200);
    validateText(profile.description, 4000);
    if (profile.name.trim() === "") throw new Error("Profile name is required");
    if (
      !Array.isArray(profile.selectedFeatureIds) ||
      profile.selectedFeatureIds.some(
        (id) =>
          this.db.prepare("SELECT id FROM agent_character_features WHERE id=?").get(id) ===
          undefined
      )
    )
      throw new Error("Unknown character feature");
    if (
      !Array.isArray(profile.requestedCapabilities) ||
      profile.requestedCapabilities.some(
        (id) => typeof id !== "string" || !/^[a-z0-9-]{1,100}$/.test(id)
      )
    )
      throw new Error("Invalid requested capabilities");
    if (profile.instructionId !== null && this.instruction(profile.instructionId)?.layer !== "role")
      throw new Error("Profile instruction must be a role");
    this.db
      .prepare(
        `INSERT INTO agent_profiles VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,features=excluded.features,instruction_id=excluded.instruction_id,requested_capabilities=excluded.requested_capabilities,version=excluded.version,updated_at=excluded.updated_at`
      )
      .run(
        profile.id,
        profile.name.trim(),
        profile.description,
        JSON.stringify([...new Set(profile.selectedFeatureIds)].sort()),
        profile.instructionId,
        JSON.stringify([...new Set(profile.requestedCapabilities)].sort()),
        version,
        Date.now(),
        Date.now()
      );
  }

  saveEditor(
    scope: AgentProfileScope,
    state: AgentCharacterEditorState
  ): AgentCharacterEditorState {
    return this.transaction(() => {
      if (state.revision !== this.revision)
        throw new Error("Registry changed; reopen the editor before saving");
      if (
        !Array.isArray(state.profiles) ||
        state.profiles.length > 500 ||
        new Set(state.profiles.map((p) => p.id)).size !== state.profiles.length
      )
        throw new Error("Invalid profile list");
      const old = this.list();
      for (const profile of state.profiles) {
        const existing = old.find((p) => p.id === profile.id);
        // The character editor cannot change task instructions or tool requirements.
        const next = {
          ...profile,
          instructionId: existing?.instructionId ?? null,
          requestedCapabilities: existing?.requestedCapabilities ?? [],
        };
        if (
          existing?.name !== next.name.trim() ||
          existing.description !== next.description ||
          JSON.stringify([...existing.selectedFeatureIds].sort()) !==
            JSON.stringify([...new Set(next.selectedFeatureIds)].sort())
        ) {
          this.writeProfile(next, (existing?.version ?? 0) + 1);
        }
      }
      for (const profile of old) {
        if (!state.profiles.some((p) => p.id === profile.id))
          this.db.prepare("DELETE FROM agent_profiles WHERE id=?").run(profile.id);
      }
      if (state.activeProfileId !== null) {
        const active = state.profiles.find((p) => p.id === state.activeProfileId);
        if (!active) throw new Error("Active profile not found");
        this.writeSelection(scope, active.id);
      } else
        this.db.prepare("DELETE FROM agent_profile_selections WHERE scope=?").run(scopeKey(scope));
      this.bump();
      return this.editorRead(scope);
    });
  }

  private writeInstruction(input: Omit<AgentInstruction, "version">, version: number): void {
    validateId(input.id);
    if (
      !["runtime", "development"].includes(input.purpose) ||
      !["base", "agent", "room", "role"].includes(input.layer)
    )
      throw new Error("Invalid instruction scope");
    if (input.layer === "base") {
      if (input.targetId !== "*") throw new Error("Base target must be *");
    } else validateId(input.targetId);
    validateText(input.content, 32000);
    this.db
      .prepare(
        `INSERT INTO agent_instructions VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET purpose=excluded.purpose,layer=excluded.layer,target_id=excluded.target_id,content=excluded.content,version=excluded.version`
      )
      .run(input.id, input.purpose, input.layer, input.targetId, input.content, version);
  }

  saveInstruction(input: Omit<AgentInstruction, "version">, expectedVersion: number): void {
    this.transaction(() => {
      const existing = this.instruction(input.id);
      if ((existing?.version ?? 0) !== expectedVersion)
        throw new Error("Instruction version conflict");
      if (
        existing &&
        (existing.purpose !== input.purpose ||
          existing.layer !== input.layer ||
          existing.targetId !== input.targetId)
      )
        throw new Error("Instruction scope is immutable");
      this.writeInstruction(input, expectedVersion + 1);
      this.bump();
    });
  }

  deleteInstruction(id: string, expectedVersion: number): void {
    this.transaction(() => {
      const existing = this.instruction(id);
      if (existing?.version !== expectedVersion) throw new Error("Instruction version conflict");
      if (existing.layer === "base") throw new Error("Base instruction is required");
      this.db.prepare("DELETE FROM agent_instructions WHERE id=?").run(id);
      this.bump();
    });
  }

  resolve(scope: AgentProfileScope, actual: AgentCapabilitySnapshot): AgentProfileResolution {
    return this.transaction(() => this.resolveSnapshot(scope, actual));
  }

  private resolveSnapshot(
    scope: AgentProfileScope,
    actual: AgentCapabilitySnapshot
  ): AgentProfileResolution {
    const profile = this.selected(scope);
    const instructions = [
      this.layer(scope, "base", "*"),
      this.layer(scope, "agent", scope.agentId),
      this.layer(scope, "room", scope.roomId),
      this.layer(scope, "role", scope.roleId),
    ].filter((item): item is AgentInstruction => item !== null);
    const capabilities = {
      source: actual.source,
      modelId: actual.modelId,
      systemInstructions: actual.systemInstructions,
      tools: [...new Set(actual.tools)].sort(),
    };
    const layers: AgentProfileResolution["layers"] = instructions.map((item) => ({
      id: item.id,
      version: item.version,
      layer: item.layer,
    }));
    layers.push({ id: profile.id, version: profile.version, layer: "character" });
    const characterFeatures = profile.selectedFeatureIds.map((id) => {
      const feature = this.db
        .prepare<[string], { id: string; content: string; version: number }>(
          "SELECT * FROM agent_character_features WHERE id=?"
        )
        .get(id);
      if (!feature) throw new Error("Character feature not found");
      return feature;
    });
    const unavailableCapabilities = profile.requestedCapabilities.filter(
      (id) => !capabilities.tools.includes(id)
    );
    const policy =
      scope.purpose === "runtime"
        ? ISOLATION_POLICY
        : "Personality preferences do not grant tools or override development workspace constraints. Use only host-attested capabilities and report unverified capabilities honestly.";
    const system = [
      policy,
      ...instructions.map((item) => `## ${item.layer}\n${item.content}`),
      `## Character preferences\n${characterFeatures.map((feature) => `- ${feature.content}`).join("\n")}`,
      `## Host capabilities\n${JSON.stringify(capabilities)}\nUnavailable requested capabilities: ${unavailableCapabilities.length > 0 ? unavailableCapabilities.join(", ") : "none"}`,
    ].join("\n\n");
    if (system.length > 16000)
      throw new Error("Resolved instructions exceed the 16000 character system budget");
    const normalizedScope: AgentProfileScope = {
      purpose: scope.purpose,
      agentId: scope.agentId,
      roomId: scope.roomId,
      roleId: scope.roleId,
    };
    const hash = createHash("sha256")
      .update(
        JSON.stringify({
          resolverVersion: RESOLVER_VERSION,
          scope: normalizedScope,
          layers,
          characterFeatures,
          system,
        })
      )
      .digest("hex");
    return {
      scope: normalizedScope,
      profile,
      resolverVersion: RESOLVER_VERSION,
      hash,
      layers,
      characterFeatures,
      system,
      capabilities,
      unavailableCapabilities,
      delivery: capabilities.systemInstructions ? "system" : "workspace",
    };
  }
}
