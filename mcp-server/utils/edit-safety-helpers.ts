/**
 * Edit Safety Helpers
 * 
 * Tool'ların hata oranını düşürmek için yardımcı fonksiyonlar
 * 
 * Bu helper'lar hev_dev_edit_lines gibi tool'lara entegre edilebilir.
 */

/**
 * Check if content contains regex patterns that might be simplified
 * 
 * Use case: Regex pattern'leri korumak için kullanılır
 * 
 * @example
 * const oldCode = "const imports = [...content.matchAll(/import\\s+.*?\\s+from\\s+['\"]/g)]";
 * const newCode = "const imports = [...content.matchAll(/from\\s+['\"]/g)]";
 * const check = detectRegexPatterns(newCode);
 * // Warning: Regex simplified!
 */
export function detectRegexPatterns(content: string): { 
  hasRegex: boolean; 
  patterns: string[] 
} {
  const regexPatterns: string[] = [];
  
  // Match regex literals: /pattern/flags
  const regexLiteralMatches = Array.from(content.matchAll(/\/(?:[^\/\\]|\\.)+\/[gimsuvy]*/g));
  for (const match of regexLiteralMatches) {
    regexPatterns.push(match[0]);
  }
  
  // Match RegExp constructor: new RegExp(...) or RegExp(...)
  const regexConstructorMatches = Array.from(content.matchAll(/(?:new\s+)?RegExp\s*\([^)]+\)/g));
  for (const match of regexConstructorMatches) {
    regexPatterns.push(match[0]);
  }
  
  return {
    hasRegex: regexPatterns.length > 0,
    patterns: regexPatterns
  };
}

/**
 * Compare regex patterns between old and new code
 */
export function compareRegexPatterns(oldContent: string, newContent: string): {
  warning?: string;
  originalCount: number;
  newCount: number;
} {
  const oldRegex = detectRegexPatterns(oldContent);
  const newRegex = detectRegexPatterns(newContent);
  
  if (oldRegex.hasRegex && newRegex.patterns.length < oldRegex.patterns.length) {
    return {
      warning: `⚠️  REGEX WARNING: Original had ${oldRegex.patterns.length} regex patterns, new has ${newRegex.patterns.length}.\nPatterns might be simplified!\nOriginal: ${oldRegex.patterns.join(', ')}`,
      originalCount: oldRegex.patterns.length,
      newCount: newRegex.patterns.length
    };
  }
  
  return {
    originalCount: oldRegex.patterns.length,
    newCount: newRegex.patterns.length
  };
}

/**
 * Check if content has non-null assertions and suggest defensive alternatives
 * 
 * Use case: Non-null assertion (!) yerine defensive check önermek
 * 
 * @example
 * const oldCode = "const item = items[index];";
 * const newCode = "const item = items[index]!;";
 * const analysis = detectNonNullAssertions(newCode, oldCode);
 * // Suggestion: Use defensive check instead
 */
export function detectNonNullAssertions(content: string, oldContent: string): { 
  hasAssertions: boolean; 
  suggestions: Array<{ line: string; suggestion: string; reason: string }>
} {
  const suggestions: Array<{ line: string; suggestion: string; reason: string }> = [];
  const newLines = content.split('\n');
  const oldLines = oldContent.split('\n');
  
  newLines.forEach((line, idx) => {
    const oldLine = oldLines[idx] || '';
    
    // Detect new non-null assertions (!) that weren't in the original
    if (line.includes('!') && !oldLine.includes('!')) {
      // Check for common patterns: array[index]!, object.prop!
      const assertionMatch = line.match(/([a-zA-Z0-9_]+(?:\[[^\]]+\]|\.[a-zA-Z0-9_]+)*)!/g);
      
      if (assertionMatch) {
        assertionMatch.forEach(assertion => {
          const varName = assertion.replace('!', '');
          
          // Suggest defensive check
          let suggestion = '';
          let reason = '';
          
          if (varName.includes('[')) {
            // Array access: arr[i]! → if (!arr[i]) ...
            suggestion = `if (!${varName}) { /* handle missing value */ }\n// Or use optional chaining: ${varName}?.`;
            reason = 'Array access can return undefined';
          } else {
            // Property access: obj.prop! → if (!obj.prop) ...
            suggestion = `if (!${varName}) { /* handle missing value */ }\n// Or use optional chaining: ${varName}?.`;
            reason = 'Property might be undefined';
          }
          
          suggestions.push({ line, suggestion, reason });
        });
      }
    }
  });
  
  return {
    hasAssertions: suggestions.length > 0,
    suggestions
  };
}
