interface Host {
  registerCommand: (
    name: string,
    handler: (input: { roomArgs: { requestId?: string } | null }) => { success: boolean },
    options: { scope: "room-ui"; exposure: "internal" }
  ) => void;
  notifyRoom: (type: string, payload: Record<string, unknown>) => void;
}

export default function activate(api: Host) {
  for (const command of [
    "GaiaProjects",
    "GaiaCreate",
    "GaiaOpen",
    "GaiaSave",
    "GaiaReference",
    "GaiaStatus",
  ]) {
    api.registerCommand(
      command,
      ({ roomArgs }) => {
        if (typeof roomArgs?.requestId !== "string") return { success: false };
        api.notifyRoom("room-storage-dispatch", { command, requestId: roomArgs.requestId });
        return { success: true };
      },
      { scope: "room-ui", exposure: "internal" }
    );
  }
  return {
    onRoomEvent(message: { type?: string }) {
      if (message.type !== "host-context") return;
      const style = getComputedStyle(document.documentElement);
      api.notifyRoom(
        "gaia-theme",
        Object.fromEntries(
          [
            "bg-surface",
            "text-primary",
            "border-default",
            "color-accent",
            "color-error",
            "color-warning",
          ].map((key) => [key, style.getPropertyValue("--" + key).trim()])
        )
      );
    },
  };
}
