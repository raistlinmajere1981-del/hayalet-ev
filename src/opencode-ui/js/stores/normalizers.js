/**
 * OpenCode UI - Part Normalizers
 * 
 * Adapted from CodeNomad's message-v2/normalizers.ts
 * Handles HTML entity decoding, validation, and sanitization of message parts.
 */

// =============================================================================
// HTML Entity Decoding
// =============================================================================

/**
 * Decode HTML entities in a string
 * @param {string} text
 * @returns {string}
 */
function decodeHtmlEntities(text) {
  if (typeof text !== 'string') return text;
  
  // Use textarea trick for proper decoding
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
}

/**
 * Decode text segment (string or object with text property)
 * @param {string | {text?: string}} segment
 * @returns {string | {text?: string}}
 */
function decodeTextSegment(segment) {
  if (typeof segment === 'string') {
    return decodeHtmlEntities(segment);
  }
  if (segment && typeof segment === 'object') {
    const updated = { ...segment };
    if (typeof updated.text === 'string') {
      updated.text = decodeHtmlEntities(updated.text);
    }
    return updated;
  }
  return segment;
}

// =============================================================================
// Part Validation
// =============================================================================

/**
 * Validate tool part has required fields
 * @param {Object} part
 * @returns {boolean}
 */
function isValidToolPart(part) {
  if (!part || part.type !== 'tool') return false;
  
  // Tool parts must have an ID
  if (!part.id || part.id.length === 0) {
    console.warn('[Normalizer] Tool part missing id:', part);
    return false;
  }
  
  // Tool call data should exist
  if (!part.toolCall) {
    console.warn('[Normalizer] Tool part missing toolCall data:', part);
    return false;
  }
  
  return true;
}

/**
 * Validate thinking part
 * @param {Object} part
 * @returns {boolean}
 */
function isValidThinkingPart(part) {
  if (!part || part.type !== 'thinking') return false;
  return part.thinking && typeof part.thinking.content === 'string';
}

/**
 * Validate text part
 * @param {Object} part
 * @returns {boolean}
 */
function isValidTextPart(part) {
  if (!part || part.type !== 'text') return false;
  return typeof part.text === 'string';
}

// =============================================================================
// Part Normalizer
// =============================================================================

const PartNormalizer = {
  /**
   * Normalize a message part
   * - Decodes HTML entities in text
   * - Validates required fields
   * - Clears render cache
   * 
   * @param {import('./types.js').MessagePart} part
   * @returns {import('./types.js').MessagePart | null} - null if invalid
   */
  normalize(part) {
    if (!part || typeof part !== 'object') return null;

    // Validate by type
    switch (part.type) {
      case 'tool':
        if (!isValidToolPart(part)) return null;
        break;
      case 'thinking':
        if (!isValidThinkingPart(part)) return null;
        break;
      case 'text':
        // Text parts are more lenient - empty string is valid
        break;
      default:
        console.warn('[Normalizer] Unknown part type:', part.type);
    }

    // Create normalized copy
    const normalized = {
      ...part,
      // Clear render cache on normalize
      renderCache: undefined,
    };

    // Decode HTML entities in text content
    if (part.type === 'text' && typeof normalized.text === 'string') {
      normalized.text = decodeHtmlEntities(normalized.text);
    }

    // Decode HTML entities in thinking content
    if (part.type === 'thinking' && normalized.thinking?.content) {
      normalized.thinking = {
        ...normalized.thinking,
        content: decodeHtmlEntities(normalized.thinking.content),
      };
    }

    // Decode HTML entities in tool output
    if (part.type === 'tool' && normalized.toolCall?.output) {
      normalized.toolCall = {
        ...normalized.toolCall,
        output: decodeHtmlEntities(normalized.toolCall.output),
      };
    }

    return normalized;
  },

  /**
   * Normalize an array of parts
   * @param {import('./types.js').MessagePart[]} parts
   * @returns {import('./types.js').MessagePart[]}
   */
  normalizeAll(parts) {
    if (!Array.isArray(parts)) return [];
    return parts
      .map(part => this.normalize(part))
      .filter(Boolean);
  },

  /**
   * Decode HTML entities (exposed for direct use)
   * @param {string} text
   * @returns {string}
   */
  decodeHtml: decodeHtmlEntities,

  /**
   * Check if a part needs normalization
   * @param {Object} part
   * @returns {boolean}
   */
  needsNormalization(part) {
    if (!part) return false;
    
    // Check for HTML entities
    const textToCheck = part.text || part.thinking?.content || part.toolCall?.output || '';
    return /&[#\w]+;/.test(textToCheck);
  },
};

// Global export
window.PartNormalizer = PartNormalizer;
