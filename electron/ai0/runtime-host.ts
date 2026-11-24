import { opencodeServerManager } from "../opencode-server-manager.ts";
import type { ServerInfo, ServerOptions } from "../types/server.js";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { Paths } from "../paths.ts";
import { createAgentProfileWorkspace } from "../agent-profile-workspace.js";
import {
  getAgentProfileRegistry,
  attestAgentCapabilities,
  invalidateAgentCapabilities,
} from "../agent-profile-service.js";
import type { AgentProfileRegistry } from "../database/agent-profile-registry.js";
import { validateProfileScope } from "../database/agent-profile-registry.js";
import { normalizeOpencodeUiSharedState } from "../../shared/opencode-ui-state.js";
import {
  AI0_ASSISTANT_SCOPE,
  AI0_IMAGE_SCOPE,
  AI0_ROOM_SCOPE,
  FATE_KNOTS_NPC_SCOPE,
} from "../../shared/ai0-runtime.js";
import type {
  Ai0CapabilityStatus,
  Ai0ImageArtifact,
  Ai0Model,
  Ai0TextResult,
} from "../../shared/ai0-runtime.js";
import type { AgentProfileScope, AgentProfileResolution } from "../../shared/agent-profiles.js";
import { isRecord, startAi0Process, unwrap } from "./opencode-process.js";
import type { Ai0Engine } from "./opencode-process.js";
import {
  assertImagePlugin,
  IMAGE_TOOL,
  imageSize,
  readImageToolResult,
} from "./native-image-service.js";
import { verifyPngArtifact } from "./png-artifact.js";

export interface Ai0HostDependencies {
  registry: () => AgentProfileRegistry;
  root: () => string;
  artifactRoot: () => string;
  projectRoot: () => string;
  defaultModel: () => Promise<Ai0Model | null>;
  start: typeof startAi0Process;
}
interface Context {
  engine: Ai0Engine;
  fingerprint: string;
  sessions: Set<string>;
  scope: AgentProfileScope;
  idle: ReturnType<typeof setTimeout> | null;
}
function scopeKey(scope: AgentProfileScope): string {
  return JSON.stringify([scope.purpose, scope.agentId, scope.roomId, scope.roleId]);
}
function validateScope(scope: AgentProfileScope): void {
  validateProfileScope(scope);
  if (scope.purpose !== "runtime" || scope.agentId !== "ai0")
    throw new Error("Common AI0 runtime accepts only explicit AI0 runtime scopes");
}
function isImageScope(scope: AgentProfileScope): boolean {
  return ["image-generator", "fate-knots-image"].includes(scope.roleId);
}
function modelKey(model: Ai0Model): string {
  return `${model.providerID}:${model.id}`;
}
function timeout(value: number | undefined, image: boolean): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(5_000, Math.min(900_000, value))
    : image
      ? 600_000
      : 180_000;
}
export function extractAi0AssistantMessages(value: unknown): Record<string, unknown>[] {
  const data = unwrap(value);
  if (!Array.isArray(data)) throw new Error("Invalid OpenCode v2 session messages");
  const assistants = data.filter(
    (item): item is Record<string, unknown> => isRecord(item) && item["type"] === "assistant"
  );
  for (const item of assistants)
    if (item["error"] !== undefined && item["error"] !== null) {
      const error = item["error"];
      if (
        isRecord(error) &&
        typeof error["message"] === "string" &&
        /^AI0 image generation: [A-Z_0-9]+$/.test(error["message"])
      )
        throw new Error(error["message"]);
      const status = isRecord(error) ? error["status"] : undefined;
      const type = isRecord(error) ? error["type"] : undefined;
      const knownTypes = [
        "provider.rate-limit",
        "provider.auth",
        "provider.quota",
        "provider.content-filter",
        "provider.transport",
        "provider.internal",
        "provider.invalid-output",
        "provider.invalid-request",
        "provider.unsupported-operation",
        "provider.no-route",
        "provider.unknown",
        "provider.timeout",
        "permission.rejected",
        "unknown",
      ];
      const kind = typeof type === "string" && knownTypes.includes(type) ? ` [${type}]` : "";
      // Provider messages and response bodies can contain secrets; expose only canonical kinds and bounded HTTP status.
      const suffix =
        typeof status === "number" && Number.isInteger(status) && status >= 100 && status <= 599
          ? ` (HTTP ${status})`
          : "";
      throw new Error(
        `AI0 model request failed${kind}${suffix}; no successful response was produced`
      );
    }
  return assistants;
}
function textFromMessages(messages: Record<string, unknown>[]): string {
  return messages
    .flatMap((item) => (Array.isArray(item["content"]) ? (item["content"] as unknown[]) : []))
    .filter(
      (item): item is Record<string, unknown> =>
        isRecord(item) && item["type"] === "text" && typeof item["text"] === "string"
    )
    .map((item) => String(item["text"]))
    .join("\n")
    .trim();
}
export class Ai0RuntimeHost {
  private readonly contexts = new Map<string, Context>();
  private readonly queues = new Map<string, Promise<unknown>>();
  private readonly artifacts = new Map<string, Ai0ImageArtifact>();
  private readonly verifiedImageModels = new Set<string>();
  private closing = false;
  constructor(private readonly deps: Ai0HostDependencies) {}

  private async serialized<T>(
    scope: AgentProfileScope,
    operation: () => Promise<T> | T
  ): Promise<T> {
    validateScope(scope);
    if (this.closing) throw new Error("AI0 host is shutting down");
    const key = scopeKey(scope);
    const run = (this.queues.get(key) ?? Promise.resolve()).then(operation, operation);
    this.queues.set(
      key,
      run.catch(() => undefined)
    );
    return await run;
  }
  private async chosenModel(scope: AgentProfileScope): Promise<Ai0Model> {
    const registry = this.deps.registry();
    const model = isImageScope(scope)
      ? ((await this.deps.defaultModel()) ?? registry.selectedRuntimeModel(AI0_ASSISTANT_SCOPE))
      : ((scope.roomId !== "assistant" ? registry.selectedRuntimeModel(AI0_ROOM_SCOPE) : null) ??
        registry.selectedRuntimeModel(scope) ??
        registry.selectedRuntimeModel(AI0_ASSISTANT_SCOPE) ??
        (await this.deps.defaultModel()));
    if (!model)
      throw new Error("AI0 has no active model. Select an available model in Assistant first.");
    return model;
  }
  private profile(
    scope: AgentProfileScope,
    model: Ai0Model,
    tools: string[]
  ): AgentProfileResolution {
    return this.deps.registry().resolve(scope, {
      source: "OpenCode v2 effective session context",
      modelId: modelKey(model),
      systemInstructions: true,
      tools,
    });
  }
  private async context(scope: AgentProfileScope, model: Ai0Model): Promise<Context> {
    const tools: string[] = [];
    const policy = this.profile(scope, model, []);
    const fingerprint = policy.hash;
    const key = scopeKey(scope);
    const existing = this.contexts.get(key);
    if (existing?.fingerprint === fingerprint) {
      if (existing.idle !== null) clearTimeout(existing.idle);
      existing.idle = null;
      return existing;
    }
    if (existing) await this.dispose(existing);
    invalidateAgentCapabilities(scope);
    const workspace = await createAgentProfileWorkspace(this.deps.root(), policy);
    const engine = await this.deps.start(workspace.workspacePath, this.deps.projectRoot(), tools);
    const context: Context = {
      engine,
      fingerprint,
      sessions: new Set(),
      scope: { ...scope },
      idle: null,
    };
    this.contexts.set(key, context);
    return context;
  }
  private async createSession(context: Context, model: Ai0Model): Promise<string> {
    // User plugins/settings are inherited; runtime sessions still deny tool
    // execution, including user-installed shell, file and network tools.
    const permissions = [{ action: "*", resource: "*", effect: "deny" }];
    if (isImageScope(context.scope))
      permissions.push({ action: IMAGE_TOOL, resource: "*", effect: "allow" });
    const created = unwrap(
      await context.engine.request("POST", "/api/session", {
        title: "Hayalet Ev AI0",
        model,
        location: { directory: context.engine.workspacePath },
        permissions,
      })
    );
    if (!isRecord(created) || typeof created["id"] !== "string")
      throw new Error("AI0 session creation failed");
    const id = created["id"];
    context.sessions.add(id);
    return id;
  }
  private async probe(
    context: Context,
    model: Ai0Model,
    _sessionId: string
  ): Promise<{ resolution: AgentProfileResolution; tools: string[] }> {
    const models = unwrap(
      await context.engine.request(
        "GET",
        "/api/model?directory=" + encodeURIComponent(context.engine.workspacePath)
      )
    );
    if (!Array.isArray(models)) throw new Error("AI0 model inventory is unavailable");
    const inventory: unknown[] = models;
    const selected = inventory.find(
      (item) => isRecord(item) && item["id"] === model.id && item["providerID"] === model.providerID
    );
    if (!isRecord(selected))
      throw new Error("Selected AI0 model " + modelKey(model) + " is unavailable in OpenCode");
    // No global tool is granted to a text/NPC session. OpenCode enforces the
    // explicit deny-all rules supplied at session creation.
    attestAgentCapabilities(context.scope, {
      source: "OpenCode v2 configured session",
      modelId: modelKey(model),
      systemInstructions: true,
      tools: [],
    });
    return { resolution: this.profile(context.scope, model, []), tools: [] };
  }
  private async attach(
    context: Context,
    sessionId: string,
    resolution: AgentProfileResolution,
    extra: string
  ): Promise<void> {
    await context.engine.request(
      "PUT",
      `/api/experimental/session/${encodeURIComponent(sessionId)}/instructions/entries/hev-profile`,
      { value: { hash: resolution.hash, instructions: `${resolution.system}\n\n${extra}` } }
    );
  }
  private async runPrompt(
    context: Context,
    sessionId: string,
    text: string,
    timeoutMs: number
  ): Promise<Record<string, unknown>[]> {
    try {
      await context.engine.request(
        "POST",
        `/api/session/${encodeURIComponent(sessionId)}/prompt`,
        { text },
        30_000
      );
      await context.engine.request(
        "POST",
        `/api/experimental/session/${encodeURIComponent(sessionId)}/wait`,
        {},
        timeoutMs
      );
      return extractAi0AssistantMessages(
        await context.engine.request(
          "GET",
          `/api/session/${encodeURIComponent(sessionId)}/message?type=assistant&order=desc&limit=50`
        )
      );
    } catch (error) {
      // An HTTP timeout does not cancel the agent loop; terminate the owning process before reusing its scope.
      await this.dispose(context);
      throw error;
    }
  }
  private async removeSession(context: Context, sessionId: string): Promise<void> {
    context.sessions.delete(sessionId);
    try {
      await context.engine.request(
        "DELETE",
        `/api/session/${encodeURIComponent(sessionId)}`,
        undefined,
        10_000
      );
    } catch {
      await this.dispose(context);
    }
  }
  private armIdle(context: Context): void {
    if (this.contexts.get(scopeKey(context.scope)) !== context) return;
    context.idle = setTimeout(() => {
      void this.dispose(context);
    }, 10 * 60_000);
    context.idle.unref();
  }
  private async dispose(context: Context): Promise<void> {
    if (context.idle !== null) clearTimeout(context.idle);
    if (this.contexts.get(scopeKey(context.scope)) === context)
      this.contexts.delete(scopeKey(context.scope));
    invalidateAgentCapabilities(context.scope);
    context.sessions.clear();
    await context.engine.stop();
  }
  async startDevelopmentAssistant(options?: ServerOptions): Promise<ServerInfo> {
    return await opencodeServerManager.start(options);
  }
  async stopDevelopmentAssistant(): Promise<void> {
    await opencodeServerManager.stop();
  }
  developmentAssistantStatus(): ServerInfo {
    return opencodeServerManager.getStatus();
  }
  async findDevelopmentAssistant(start = 4096, end = 4110): Promise<ServerInfo> {
    return await opencodeServerManager.findRunningServer(start, end);
  }

  async models(): Promise<unknown> {
    return await this.serialized(AI0_ASSISTANT_SCOPE, async () => {
      const model = this.deps.registry().selectedRuntimeModel(AI0_ASSISTANT_SCOPE) ??
        (await this.deps.defaultModel()) ?? {
          providerID: "unselected",
          id: "unselected",
        };
      let context: Context | null = null;
      try {
        context = await this.context(AI0_ASSISTANT_SCOPE, model);
        const models = unwrap(
          await context.engine.request(
            "GET",
            `/api/model?types=chat&directory=${encodeURIComponent(context.engine.workspacePath)}`
          )
        );
        if (!Array.isArray(models)) throw new Error("AI0 model inventory is unavailable");
        return models.filter(isRecord).map((item) => ({
          id: item["id"],
          providerID: item["providerID"],
          name: item["name"],
          capabilities: item["capabilities"],
        }));
      } finally {
        if (context) this.armIdle(context);
      }
    });
  }
  modelSelections(): Record<"chat" | "room", Ai0Model | null> {
    const registry = this.deps.registry();
    return {
      chat: registry.selectedRuntimeModel(AI0_ASSISTANT_SCOPE),
      room: registry.selectedRuntimeModel(AI0_ROOM_SCOPE),
    };
  }
  async selectModel(scope: AgentProfileScope, model: Ai0Model): Promise<void> {
    validateScope(scope);
    if (isImageScope(scope)) throw new Error("Image generation uses the active OpenCode model");
    if (
      typeof model.providerID !== "string" ||
      typeof model.id !== "string" ||
      model.providerID.trim() === "" ||
      model.id.trim() === ""
    )
      throw new Error("Invalid AI0 model");
    await this.serialized(scope, () => {
      // A model assignment is configuration, not a provider call: do not
      // start a second OpenCode process merely to save a selection.
      // Model inventory is checked when a task is executed.
      this.deps.registry().selectRuntimeModel(scope, model);
    });
    await this.invalidateChangedContexts();
  }
  async imageStatus(scope: AgentProfileScope = AI0_IMAGE_SCOPE): Promise<Ai0CapabilityStatus> {
    return await this.serialized(scope, async () => {
      let context: Context | null = null;
      let model: Ai0Model | null = null;
      try {
        if (!isImageScope(scope))
          throw new Error("Image generation requires an explicit image role");
        model = await this.chosenModel(scope);
        context = await this.context(scope, model);
        await assertImagePlugin(context.engine);
        const inventory = unwrap(
          await context.engine.request(
            "GET",
            "/api/model?types=chat&directory=" + encodeURIComponent(context.engine.workspacePath)
          )
        );
        if (
          !Array.isArray(inventory) ||
          !inventory.some(
            (entry) =>
              isRecord(entry) &&
              entry["providerID"] === model?.providerID &&
              entry["id"] === model?.id &&
              entry["enabled"] !== false
          )
        )
          throw new Error("Active OpenCode model is unavailable");
        return {
          available: true,
          verified: this.verifiedImageModels.has(modelKey(model)),
          reason: null,
          model,
          toolId: IMAGE_TOOL,
          verifiedTools: [IMAGE_TOOL],
          profileHash: context.fingerprint,
          sessionId: null,
        };
      } catch (error) {
        if (model) this.verifiedImageModels.delete(modelKey(model));
        invalidateAgentCapabilities(scope);
        return {
          available: false,
          verified: false,
          reason: error instanceof Error ? error.message : String(error),
          model,
          toolId: null,
          verifiedTools: [],
          profileHash: null,
          sessionId: null,
        };
      } finally {
        if (context) this.armIdle(context);
      }
    });
  }
  async chat(
    text: string,
    scope: AgentProfileScope = AI0_ASSISTANT_SCOPE,
    previousSessionId?: string,
    timeoutMs?: number,
    extra = ""
  ): Promise<Ai0TextResult> {
    return await this.serialized(scope, async () => {
      if (
        typeof text !== "string" ||
        text.trim() === "" ||
        text.length > 100_000 ||
        isImageScope(scope)
      )
        throw new Error("Invalid AI0 text task");
      const model = await this.chosenModel(scope);
      const context = await this.context(scope, model);
      if (previousSessionId !== undefined && !context.sessions.has(previousSessionId))
        throw new Error("AI0 session expired or its model/profile changed. Start a new session.");
      const sessionId = previousSessionId ?? (await this.createSession(context, model));
      const stateless = scope.roleId === FATE_KNOTS_NPC_SCOPE.roleId;
      try {
        const actual = await this.probe(context, model, sessionId);
        await this.attach(context, sessionId, actual.resolution, extra);
        const messages = await this.runPrompt(context, sessionId, text, timeout(timeoutMs, false));
        const reply = textFromMessages(messages.slice(0, 1));
        if (reply === "") throw new Error("AI0 returned no text response");
        if (this.profile(scope, await this.chosenModel(scope), []).hash !== context.fingerprint)
          throw new Error(
            "AI0 model/profile changed during the request; the old result was discarded"
          );
        return {
          text: reply,
          sessionId,
          workspacePath: context.engine.workspacePath,
          port: context.engine.port,
          profileHash: actual.resolution.hash,
          model,
        };
      } catch (error) {
        await this.removeSession(context, sessionId);
        throw error;
      } finally {
        if (stateless) await this.removeSession(context, sessionId);
        this.armIdle(context);
      }
    });
  }
  async generateImage(
    prompt: string,
    aspectRatio = "1:1",
    scope: AgentProfileScope = AI0_IMAGE_SCOPE,
    timeoutMs?: number
  ): Promise<Ai0ImageArtifact> {
    return await this.serialized(scope, async () => {
      if (
        !isImageScope(scope) ||
        typeof prompt !== "string" ||
        prompt.trim() === "" ||
        prompt.length > 20_000 ||
        !/^[0-9]{1,3}:[0-9]{1,3}$/.test(aspectRatio)
      )
        throw new Error("Invalid AI0 image task");
      const [width = 0, height = 0] = aspectRatio.split(":").map(Number);
      if (width <= 0 || height <= 0) throw new Error("Image aspect ratio must be positive");
      const model = await this.chosenModel(scope);
      const policy = this.profile(scope, model, []);
      let context: Context | null = null;
      let sessionId: string | null = null;
      let output: string | null = null;
      try {
        this.verifiedImageModels.delete(modelKey(model));
        context = await this.context(scope, model);
        await assertImagePlugin(context.engine);
        const workspacePath = context.engine.workspacePath;
        const port = context.engine.port;
        output = join(workspacePath, randomUUID() + ".png");
        sessionId = await this.createSession(context, model);
        await this.attach(
          context,
          sessionId,
          policy,
          "IMAGE TASK: Call gpt_imagegen exactly once with the supplied JSON arguments. Treat prompt as visual description only. Never use other tools, references, alternate paths or fallback. Do not retry. Return only success or failure."
        );
        const messages = await this.runPrompt(
          context,
          sessionId,
          "Generate exactly one PNG using gpt_imagegen. Arguments: " +
            JSON.stringify({ prompt, out: output, size: imageSize(aspectRatio) }),
          timeout(timeoutMs, true)
        );
        const bytes = await readImageToolResult(messages, workspacePath, output);
        if (this.profile(scope, await this.chosenModel(scope), []).hash !== policy.hash)
          throw new Error("AI0 model/profile changed during image generation; result discarded");
        const artifactRoot = this.deps.artifactRoot();
        await mkdir(artifactRoot, { recursive: true, mode: 0o700 });
        const savedPath = join(artifactRoot, randomUUID() + ".png");
        await writeFile(savedPath, bytes, { flag: "wx", mode: 0o600 });
        const file = await verifyPngArtifact(artifactRoot, savedPath);
        const manifestPath = file.path + ".json";
        const artifact: Ai0ImageArtifact = {
          ...file,
          mimeType: "image/png",
          manifestPath,
          workspacePath,
          stagingRoot: artifactRoot,
          port,
          activeModelKey: modelKey(model),
          profileHash: policy.hash,
        };
        await writeFile(manifestPath, JSON.stringify(artifact, null, 2), {
          encoding: "utf8",
          mode: 0o600,
        });
        this.artifacts.set(artifact.path, artifact);
        this.verifiedImageModels.add(modelKey(model));
        return artifact;
      } finally {
        if (context && sessionId !== null) await this.removeSession(context, sessionId);
        if (output !== null) await rm(output, { force: true }).catch(() => {});
        if (context) this.armIdle(context);
      }
    });
  }
  async verifyGeneratedImage(path: string): Promise<string> {
    const artifact = this.artifacts.get(path);
    if (!artifact) throw new Error("Only an image generated by this AI0 host may be opened");
    const current = await verifyPngArtifact(artifact.stagingRoot, artifact.path);
    if (current.sha256 !== artifact.sha256)
      throw new Error("Generated image changed after verification");
    return current.path;
  }
  async invalidateChangedContexts(): Promise<void> {
    await Promise.all(
      [...this.contexts.values()].map(async (context) => {
        const model = await this.chosenModel(context.scope).catch(() => null);
        if (model === null || this.profile(context.scope, model, []).hash !== context.fingerprint)
          await this.dispose(context);
      })
    );
  }
  async shutdown(): Promise<void> {
    this.closing = true;
    await Promise.all(
      [...this.contexts.values()].map(async (context) => {
        await this.dispose(context);
      })
    );
    await Promise.allSettled(this.queues.values());
  }
}
async function readDefaultModel(): Promise<Ai0Model | null> {
  try {
    const state = normalizeOpencodeUiSharedState(
      JSON.parse(
        await readFile(join(Paths.getDataDir(), "shared", "opencode-ui-state.json"), "utf8")
      ) as unknown
    );
    const key =
      state.modelPreferences.lastSelectedModelKey ?? state.modelPreferences.defaultModelKey;
    if (key === null) return null;
    const index = key.indexOf(":");
    return index > 0 && index < key.length - 1
      ? { providerID: key.slice(0, index), id: key.slice(index + 1) }
      : null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
export const ai0RuntimeHost = new Ai0RuntimeHost({
  registry: getAgentProfileRegistry,
  root: (): string => Paths.getAi0RuntimeRoot(),
  artifactRoot: (): string => Paths.getAi0ImageArtifactsDir(),
  projectRoot: (): string => Paths.getProjectRoot(),
  defaultModel: readDefaultModel,
  start: startAi0Process,
});
