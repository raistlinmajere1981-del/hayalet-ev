interface WhisperRecord {
  user: string;
  text: string;
  when?: number;
  done?: boolean;
  id?: string;
}

export class WhisperPanel {
    listEl: HTMLElement | null;
    overdueWhispers: WhisperRecord[];

    constructor() {
        this.listEl = null;
        this.overdueWhispers = [];
    }

    init() {
        this.listEl = document.getElementById("whisper-pending-list");
        this.setupListeners();
        this.render();
    }

    setupListeners() {
        this.listEl?.addEventListener("click", (ev) => this.handleListClick(ev));
        document.getElementById("whisper-clear-btn")?.addEventListener("click", () => {
            this.clearAll();
        });
    }

    async render() {
        if (!this.listEl) return;
        
        // This requires CoreEngine to be imported or available globally/passed in.
        // Assuming CoreEngine is available via window or import. 
        // We will pass it or import it in the main controller, but here we can try dynamic import or rely on CoreEngine module
        const { CoreEngine } = await import("../../modules/core-engine.js");

        const now = Date.now();
        const chatList = (await CoreEngine.whisper("list", { user: "ai1" })) || [];
        const ai2List = (await CoreEngine.whisper("list", { user: "ai2" })) || [];
        
        const records = [...(Array.isArray(chatList) ? chatList : []), ...(Array.isArray(ai2List) ? ai2List : [])].filter(
            (rec) => !rec.done && (rec.when || 0) <= now,
        );
        
        this.overdueWhispers = records.sort((a, b) => (a.when || 0) - (b.when || 0));
        
        this.listEl.innerHTML = "";
        
        if (!this.overdueWhispers.length) {
            this.listEl.innerHTML = '<div class="empty-message">Kayıt yok</div>';
            return;
        }

        this.overdueWhispers.forEach((rec) => {
            const row = document.createElement("div");
            row.className = "whisper-item";
            
            const when = rec.when ? new Date(rec.when).toLocaleTimeString("tr-TR", {hour:'2-digit', minute:'2-digit'}) : "-";
            
            row.innerHTML = `
                <div class="whisper-content">
                    <div class="whisper-meta">
                        <span class="badge ${rec.user}">${rec.user.toUpperCase()}</span>
                        <span>${when}</span>
                    </div>
                    <div class="whisper-text" title="${this.escapeHtml(rec.text)}">${this.escapeHtml(rec.text)}</div>
                </div>
                <button class="icon-btn-text delete-btn" title="Sil">×</button>
            `;

            row.querySelector(".delete-btn")?.addEventListener("click", async (e) => {
                e.stopPropagation();
                await CoreEngine.whisper("remove", { user: rec.user, id: rec.id });
                this.render();
            });

            this.listEl?.appendChild(row);
        });
    }

    async clearAll() {
        const { CoreEngine } = await import("../../modules/core-engine.js");
        for (const rec of this.overdueWhispers) {
            await CoreEngine.whisper("remove", { user: rec.user, id: rec.id });
        }
        this.overdueWhispers = [];
        this.render();
    }

    handleListClick(_ev: Event) {
        // Selection logic if needed
    }

    escapeHtml(text: string) {
        if (!text) return "";
        return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
}
