/**
 * Asistan Provider Configurations
 * Her asistan CLI için yapılandırma bilgileri
 */

export const assistantConfigs = {
  opencode: {
    id: "opencode",
    name: "OpenCode",
    webPort: 8080,
    webStartCommand: "opencode web --port {port}",
    webUrl: "http://localhost:{port}",
    selectors: {
      inputSelector: "textarea[placeholder*='message'], textarea[data-testid='input'], .chat-input textarea",
      sendButtonSelector: "button[type='submit'], button[data-testid='send'], .send-button",
      messagesContainer: ".messages, .chat-messages, [data-testid='messages']",
      lastAssistantMessage: ".assistant-message:last-child, .message.assistant:last-child, [data-role='assistant']:last-child"
    },
    icon: "🔷",
    description: "OpenCode AI assistant"
  }
};

/**
 * Provider config'i ID ile al
 */
export function getProviderConfig(providerId) {
  return assistantConfigs[providerId] || null;
}

