import { constants } from "node:fs";
import { opencodeServerManager } from "../opencode-server-manager.ts";
import type { ServerInfo, ServerOptions } from "../types/server.js";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
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
import type { Ai0Engine, Ai0SessionProbe } from "./opencode-process.js";
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
  for (const assistant of assistants) {
    const content = assistant["content"];
    if (!Array.isArray(content)) continue;
    for (const tool of content) {
      if (
        !isRecord(tool) ||
        tool["type"] !== "tool" ||
        tool["name"] !== "image_generate" ||
        !isRecord(tool["state"])
      )
        continue;
      const error = tool["state"]["error"];
      if (
        isRecord(error) &&
        typeof error["message"] === "string" &&
        /^AI0 image generation: [A-Z_0-9]+$/.test(error["message"])
      )
        throw new Error(error["message"]);
    }
  }
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
  private closing = false;
  constructor(private readonly deps: Ai0HostDependencies) {}

  private async serialized<T>(scope: AgentProfileScope, operation: () => Promise<T>): Promise<T> {
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
    const model =
      this.deps.registry().selectedRuntimeModel(scope) ??
      this.deps.registry().selectedRuntimeModel(AI0_ASSISTANT_SCOPE) ??
      (await this.deps.defaultModel());
    if (!model) throw new Error("AI0 has no selected model. Select an available model first.");
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
    const tools = isImageScope(scope) ? ["image_generate"] : [];
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
    const permissions = [
      { action: "*", resource: "*", effect: "deny" },
      ...(isImageScope(context.scope)
        ? [{ action: "image_generate", resource: "*", effect: "allow" }]
        : []),
    ];
    const created = unwrap(
      await context.engine.request("POST", "/api/session", {
        title: "Hayalet Ev AI0",
        agent: "hev-ai0",
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
    sessionId: string
  ): Promise<{ resolution: AgentProfileResolution; tools: string[] }> {
    if (isImageScope(context.scope) && model.providerID !== "openai")
      throw new Error(
        "Native AI0 image tasks require an available OpenAI session model and ChatGPT/Codex OAuth; no provider fallback is permitted"
      );
    const value = await context.engine.rpc("probe", { sessionId });
    if (isRecord(value) && typeof value["error"] === "string")
      throw new Error(`AI0 effective session probe failed: ${value["error"]}`);
    const models = unwrap(
      await context.engine.request(
        "GET",
        `/api/model?directory=${encodeURIComponent(context.engine.workspacePath)}`
      )
    );
    if (!Array.isArray(models)) throw new Error("AI0 model inventory is unavailable");
    const selected: unknown = models.find(
      (item) => isRecord(item) && item["id"] === model.id && item["providerID"] === model.providerID
    );
    if (!isRecord(selected))
      throw new Error(`Selected AI0 model ${modelKey(model)} is unavailable in this runtime`);
    const capabilities = selected["capabilities"];
    if (isImageScope(context.scope) && (!isRecord(capabilities) || capabilities["tools"] !== true))
      throw new Error("Selected AI0 model cannot call image_generate tools");
    if (
      !isRecord(value) ||
      value["sessionId"] !== sessionId ||
      !isRecord(value["model"]) ||
      !isRecord(value["tools"])
    )
      throw new Error("AI0 has no verified effective session capability snapshot");
    const actualModel = value["model"];
    if (actualModel["id"] !== model.id || actualModel["providerID"] !== model.providerID)
      throw new Error("AI0 session model does not match the selected model");
    const snapshot = value as unknown as Ai0SessionProbe;
    const toolIds = Object.keys(snapshot.tools);
    const allowed = isImageScope(context.scope) ? ["image_generate"] : [];
    if (toolIds.some((id) => !allowed.includes(id)))
      throw new Error("AI0 effective session includes tools outside the task boundary");
    if (isImageScope(context.scope)) {
      const properties = snapshot.tools["image_generate"]?.input.properties;
      if (!properties || !isRecord(properties["prompt"]) || !isRecord(properties["output_path"]))
        throw new Error(
          "No real image_generate tool with a prompt + output_path contract is available in this AI0 session"
        );
    }
    attestAgentCapabilities(context.scope, {
      source: "OpenCode v2 effective session context",
      modelId: modelKey(model),
      systemInstructions: true,
      tools: toolIds,
    });
    return { resolution: this.profile(context.scope, model, toolIds), tools: toolIds };
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
      if (isImageScope(context.scope)) await context.engine.rpc("image-release", { sessionId });
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
      const context = await this.context(AI0_ASSISTANT_SCOPE, model);
      try {
        const models = unwrap(
          await context.engine.request(
            "GET",
            `/api/model?directory=${encodeURIComponent(context.engine.workspacePath)}`
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
        this.armIdle(context);
      }
    });
  }
  async selectModel(scope: AgentProfileScope, model: Ai0Model): Promise<void> {
    validateScope(scope);
    const current = await this.chosenModel(scope).catch(() => null);
    const changed = current?.id !== model.id || current.providerID !== model.providerID;
    await this.serialized(scope, async () => {
      const context = await this.context(scope, model);
      const models = unwrap(
        await context.engine.request(
          "GET",
          `/api/model?directory=${encodeURIComponent(context.engine.workspacePath)}`
        )
      );
      if (
        !Array.isArray(models) ||
        !models.some(
          (item) =>
            isRecord(item) && item["id"] === model.id && item["providerID"] === model.providerID
        )
      )
        throw new Error("Selected model is unavailable in this AI0 runtime");
      this.deps.registry().selectRuntimeModel(scope, model);
      if (changed) await this.dispose(context);
      else this.armIdle(context);
    });
    await this.invalidateChangedContexts();
  }

  async imageStatus(scope: AgentProfileScope = AI0_IMAGE_SCOPE): Promise<Ai0CapabilityStatus> {
    return await this.serialized(scope, async () => {
      let context: Context | null = null;
      let sessionId: string | null = null;
      let model: Ai0Model | null = null;
      try {
        if (!isImageScope(scope))
          throw new Error("Image generation requires an explicit image role");
        model = await this.chosenModel(scope);
        context = await this.context(scope, model);
        sessionId = await this.createSession(context, model);
        const actual = await this.probe(context, model, sessionId);
        return {
          available: true,
          reason: null,
          model,
          toolId: "image_generate",
          verifiedTools: actual.tools,
          profileHash: actual.resolution.hash,
          sessionId,
        };
      } catch (error) {
        invalidateAgentCapabilities(scope);
        return {
          available: false,
          reason: error instanceof Error ? error.message : String(error),
          model,
          toolId: null,
          verifiedTools: [],
          profileHash: null,
          sessionId,
        };
      } finally {
        if (context && sessionId !== null) await this.removeSession(context, sessionId);
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
        !/^\d{1,3}:\d{1,3}$/.test(aspectRatio)
      )
        throw new Error("Invalid AI0 image task");
      const [width, height] = aspectRatio.split(":").map(Number);
      if (width === undefined || height === undefined || width <= 0 || height <= 0)
        throw new Error("Image aspect ratio must be positive");
      const model = await this.chosenModel(scope);
      const context = await this.context(scope, model);
      const sessionId = await this.createSession(context, model);
      try {
        const actual = await this.probe(context, model, sessionId);
        const relativeOutput = `images/${randomUUID()}.png`;
        const outputPath = join(context.engine.workspacePath, relativeOutput);
        await mkdir(join(context.engine.workspacePath, "images"), { recursive: true });
        const size = width === height ? "1024x1024" : width > height ? "1536x1024" : "1024x1536";
        await context.engine.rpc("output", {
          sessionId,
          path: relativeOutput,
          prompt,
          size,
          responseModel: model.id,
        });
        await this.attach(
          context,
          sessionId,
          actual.resolution,
          `Call image_generate exactly once. Its prompt must equal the user message verbatim, and output_path must equal ${relativeOutput}. PNG, ${size}, and opaque background are enforced by the host. Do not add parameters or use other tools. A prose claim of success is insufficient.`
        );
        const messages = await this.runPrompt(context, sessionId, prompt, timeout(timeoutMs, true));
        const completed = messages
          .flatMap((item) => (Array.isArray(item["content"]) ? (item["content"] as unknown[]) : []))
          .filter(
            (item) =>
              isRecord(item) &&
              item["type"] === "tool" &&
              item["name"] === "image_generate" &&
              isRecord(item["state"]) &&
              item["state"]["status"] === "completed"
          );
        if (completed.length !== 1) {
          const result = await context.engine.rpc("image-result", { sessionId });
          if (
            isRecord(result) &&
            typeof result["error"] === "string" &&
            /^AI0 image generation: [A-Z_0-9]+$/.test(result["error"])
          )
            throw new Error(result["error"]);
          if (isRecord(result) && result["attempted"] === false)
            throw new Error("AI0 image generation: IMAGE_TOOL_NOT_CALLED");
          throw new Error("AI0 image generation: IMAGE_TOOL_NOT_COMPLETED");
        }
        await verifyPngArtifact(context.engine.workspacePath, outputPath);
        const artifactRoot = this.deps.artifactRoot();
        await mkdir(artifactRoot, { recursive: true, mode: 0o700 });
        const savedPath = join(artifactRoot, `${randomUUID()}.png`);
        await copyFile(outputPath, savedPath, constants.COPYFILE_EXCL);
        const file = await verifyPngArtifact(artifactRoot, savedPath);
        if (this.profile(scope, await this.chosenModel(scope), []).hash !== context.fingerprint)
          throw new Error(
            "AI0 model/profile changed during image generation; the old result was discarded"
          );
        const manifestPath = `${file.path}.json`;
        const artifact: Ai0ImageArtifact = {
          ...file,
          mimeType: "image/png",
          manifestPath,
          workspacePath: context.engine.workspacePath,
          stagingRoot: artifactRoot,
          port: context.engine.port,
          activeModelKey: modelKey(model),
          profileHash: actual.resolution.hash,
        };
        await writeFile(manifestPath, JSON.stringify(artifact, null, 2), {
          encoding: "utf8",
          mode: 0o600,
        });
        this.artifacts.set(artifact.path, artifact);
        return artifact;
      } finally {
        await this.removeSession(context, sessionId);
        this.armIdle(context);
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
