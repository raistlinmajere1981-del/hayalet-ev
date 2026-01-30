/**
 * Export OpenCodeApp singleton globally
 */

import OpenCodeApp from './manager';

// Export globally
(window as any).OpenCodeApp = OpenCodeApp;


// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', async () => {
    console.log('[OpenCode] DOM ready, initializing...');
    await window.OpenCodeApp?.init();
  });
} else {
  console.log('[OpenCode] DOM already ready, initializing...');
  (async () => {
    await window.OpenCodeApp?.init();
  })();
}

export default OpenCodeApp;
