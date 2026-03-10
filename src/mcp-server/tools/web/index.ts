/**
 * Web Tools - Export Hub
 *
 * Central export hub for all web tools
 * - Web search (DuckDuckGo)
 * - Content fetch & scrape
 *
 * @module web
 */

export { webSearch } from "./search.js";
export { webFetchUrl, webSearchAndFetch } from "./fetch.js";

import { WEB_SEARCH_TOOL } from "./search.js";
import { WEB_FETCH_URL_TOOL, WEB_SEARCH_AND_FETCH_TOOL_DEFINITION } from "./fetch.js";

export const WEB_TOOL_DEFINITIONS = [
  WEB_SEARCH_TOOL,
  WEB_FETCH_URL_TOOL,
  WEB_SEARCH_AND_FETCH_TOOL_DEFINITION,
];

export const WEB_TOOL_METADATA = {
  category: "Web",
  emoji: "🌐",
  tools: WEB_TOOL_DEFINITIONS.map((t) => t.name),
};
