/**
 * OpenCode UI - Stores
 * 
 * Barrel export for all store modules.
 * Import order matters - types first, then stores, then bridge.
 */

// Types are loaded via types.js (JSDoc only, no runtime exports needed)

// Re-export from window globals for consistency
// These are set by each module's self-registration

/**
 * @typedef {typeof window.MessageStore} MessageStoreType
 * @typedef {typeof window.SessionStore} SessionStoreType  
 * @typedef {typeof window.StoreBridge} StoreBridgeType
 */

// Verify all stores are loaded
function verifyStores() {
  const missing = [];
  
  if (typeof window.MessageStore === 'undefined') missing.push('MessageStore');
  if (typeof window.SessionStore === 'undefined') missing.push('SessionStore');
  if (typeof window.StoreBridge === 'undefined') missing.push('StoreBridge');
  
  if (missing.length > 0) {
    console.error('[Stores] Missing stores:', missing.join(', '));
    return false;
  }
  
  console.log('[Stores] All stores loaded successfully');
  return true;
}

// Initialize stores integration
function initStores() {
  if (!verifyStores()) {
    throw new Error('Store initialization failed - missing dependencies');
  }

  // Connect MessageStore changes to trigger re-renders
  // This is handled by MessageRenderer.init() subscribing to MessageStore
  
  console.log('[Stores] Initialized', {
    messages: window.MessageStore.getStats(),
    sessions: window.SessionStore.getStats(),
  });
}

// Export initialization function
window.initStores = initStores;
window.verifyStores = verifyStores;

// Auto-init when DOM is ready (if not already initialized)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // Delay to ensure all scripts are loaded
    setTimeout(verifyStores, 0);
  });
} else {
  setTimeout(verifyStores, 0);
}
