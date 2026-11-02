// The plugin uses the v2 promise API without importing user/global plugins or their dependencies.
export const AI0_BOUNDARY_PLUGIN = String.raw`
export default {
  id: "hev.ai0.boundary",
  async setup(ctx) {
    const allowed = new Set(ctx.options.allowedTools ?? []);
    const probes = new Set();
    const captures = new Map();
    const registrations = [];
    registrations.push(await ctx.tool.transform(editor => {
      for (const tool of editor.list()) {
        if (!allowed.has(tool.id)) editor.remove(tool.id);
        else editor.update(tool.id, item => {
          item.options = { ...item.options, codemode: false };
        });
      }
    }));
    const restrict = value => {
      value.tools = Object.fromEntries(Object.entries(value.tools).filter(([id]) => allowed.has(id)));
    };
    registrations.push(await ctx.session.hook("context", restrict));
    registrations.push(await ctx.session.hook("generate", value => {
      restrict(value);
      if (probes.has(value.sessionID)) {
        captures.set(value.sessionID, { sessionId: value.sessionID, model: value.model, tools: value.tools });
        throw new Error("HEV_AI0_CAPABILITY_PROBE_COMPLETE");
      }
    }));
    registrations.push(await ctx.session.hook("model.request", value => {
      if (probes.has(value.sessionID)) throw new Error("HEV_AI0_PROBE_MUST_NOT_CALL_PROVIDER");
    }));
    registrations.push(await ctx.session.hook("title", value => { value.result = "AI0"; }));
    registrations.push(await ctx.tool.hook("execute.before", value => {
      if (!allowed.has(value.tool)) throw new Error("Tool is outside the AI0 task boundary");
    }));
    registrations.push(await ctx.rpc.register({
      id: "hev.ai0", events: {}, methods: {
        ready: { input: { type: "object" }, output: { type: "object" } },
        probe: { input: { type: "object", properties: { sessionId: { type: "string" } }, required: ["sessionId"] }, output: { type: "object" } },
      }
    }, {
      async ready() {
        const tools = await ctx.tool.list();
        return { ready: true, toolIds: tools.map(tool => tool.id).filter(id => allowed.has(id)) };
      },
      async probe(input) {
        await ctx.session.get({ sessionID: input.sessionId });
        probes.add(input.sessionId);
        try { await ctx.session.generate({ sessionID: input.sessionId, prompt: "Inspect this session's model and tools without contacting the provider." }); }
        catch (error) { if (!captures.has(input.sessionId)) return { sessionId: input.sessionId, error: error instanceof Error ? error.message : "Effective session probe failed" }; }
        finally { probes.delete(input.sessionId); }
        const capture = captures.get(input.sessionId);
        captures.delete(input.sessionId);
        if (!capture) throw new Error("No effective session capability snapshot was captured");
        return capture;
      },
    }));
    return async () => { for (const registration of registrations.reverse()) await registration.dispose(); };
  }
};
`;
