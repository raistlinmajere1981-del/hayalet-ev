/**
 * OpenCode Provider - Conversation Scraper
 * 
 * DOM'dan mesajları çeker ve yapılandırılmış formata dönüştürür
 */

export function scrapeMessages() {
  const result = [];
  let index = 0;

  // Kullanıcı mesajlarını bul
  const userMessages = document.querySelectorAll(
    '[data-component="user-message"] [data-slot="user-message-text"]'
  );

  // Asistan mesajlarını bul
  const assistantMessages = document.querySelectorAll(
    '[data-slot="session-turn-summary-section"] [data-component="markdown"]'
  );

  // Session turn'leri bul (sıralama için)
  const sessionTurns = document.querySelectorAll('[data-slot="session-turn-message-content"]');
  
  if (sessionTurns.length > 0) {
    // Session turn bazlı scraping
    sessionTurns.forEach((turn) => {
      // Kullanıcı mesajı
      const userMsg = turn.querySelector('[data-component="user-message"] [data-slot="user-message-text"]');
      if (userMsg) {
        const text = (userMsg.innerText || userMsg.textContent || "").trim();
        if (text) {
          result.push({ index: index++, role: "user", text });
        }
      }
    });

    // Asistan response'ları (summary section içinde)
    const summaries = document.querySelectorAll('[data-slot="session-turn-summary-section"]');
    summaries.forEach((summary) => {
      const markdown = summary.querySelector('[data-component="markdown"]');
      if (markdown) {
        const text = (markdown.innerText || markdown.textContent || "").trim();
        if (text) {
          result.push({ index: index++, role: "assistant", text });
        }
      }
    });
  } else {
    // Fallback: Ayrı ayrı mesajları topla
    userMessages.forEach((node) => {
      const text = (node.innerText || node.textContent || "").trim();
      if (text) {
        result.push({ index: index++, role: "user", text });
      }
    });

    assistantMessages.forEach((node) => {
      const text = (node.innerText || node.textContent || "").trim();
      if (text) {
        result.push({ index: index++, role: "assistant", text });
      }
    });
  }

  return result;
}

