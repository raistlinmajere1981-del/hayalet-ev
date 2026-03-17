function nowIso() {
  return new Date().toISOString();
}

export function createWrapperSessionId(prefix = "wr") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function formatCommand(command, args = []) {
  return [command, ...args].join(" ");
}

export function isNoiseLogLine(line) {
  if (typeof line !== "string") return true;
  const trimmed = line.trim();
  if (trimmed === "") return true;
  return ["xapp-gtk3-module", "bind() failed", "Cannot start http server for devtools"].some((pattern) =>
    trimmed.includes(pattern)
  );
}

export function createUserMessage(event, details = {}) {
  switch (event) {
    case "wrapper.start":
      return "Wrapper basladi. Gecisler bu terminalden yonetilecek.";
    case "wrapper.stop":
      return "Wrapper durdu.";
    case "main.prepare":
      return details.assistantStartup === true
        ? "Ana uygulama hazirlaniyor. Asistan sayfasi acilacak."
        : "Ana uygulama hazirlaniyor.";
    case "main.build":
      return "Ana uygulama build ediliyor.";
    case "vite.reset":
      return "Vite yeniden baslatiliyor.";
    case "vite.ready":
      return "Vite hazir.";
    case "main.launch":
      return "Ana uygulama aciliyor.";
    case "main.closed":
      return "Ana uygulama kapandi.";
    case "ghost.prepare":
      return "Ghost Agent hazirlaniyor.";
    case "ghost.build":
      return "Ghost Agent build ediliyor.";
    case "ghost.launch":
      return "Ghost Agent aciliyor.";
    case "ghost.closed":
      return "Ghost Agent kapandi.";
    case "cycle.to-ghost":
      return "Gecis ghost moda yonlendirildi.";
    case "cycle.to-app":
      return "Gecis ana uygulamaya yonlendirildi.";
    case "cycle.stop":
      return "Calisma dongusu sonlandi.";
    case "cleanup":
      return "Arka plan surecleri kapatiliyor.";
    case "error":
      return typeof details.message === "string" && details.message.trim() !== ""
        ? `Hata: ${details.message}`
        : "Beklenmeyen bir hata olustu.";
    default:
      return typeof details.message === "string" && details.message.trim() !== ""
        ? details.message
        : `[${nowIso()}] ${event}`;
  }
}

export function formatProcessLine(role, streamName, line) {
  return `[${role}:${streamName}] ${line}`;
}
