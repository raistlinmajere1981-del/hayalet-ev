/**
 * Web Tools - Export Hub
 *
 * Tüm web araçları için merkezi export noktası
 * - Web search (DuckDuckGo)
 * - Content fetch & scrape
 *
 * @module web
 */

// Function exports
export { webSearch } from "./search.js";
export { webFetchUrl, webSearchAndFetch } from "./fetch.js";

// Tool definition imports
import { WEB_SEARCH_TOOL } from "./search.js";
import { WEB_FETCH_URL_TOOL, WEB_SEARCH_AND_FETCH_TOOL_DEFINITION } from "./fetch.js";

// Combined tool definitions array (for MCP registration)
export const WEB_TOOL_DEFINITIONS = [
  WEB_SEARCH_TOOL,
  WEB_FETCH_URL_TOOL,
  WEB_SEARCH_AND_FETCH_TOOL_DEFINITION,
];

// Metadata for tool listing
export const WEB_TOOL_METADATA = {
  category: "Web",
  emoji: "🌐",
  tools: WEB_TOOL_DEFINITIONS.map((t) => t.name),
};
