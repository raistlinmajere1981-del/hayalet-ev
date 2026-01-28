/**
 * Smart Scroll Management
 * Auto-scroll detection + user scroll intent handling
 */

class SmartScroll {
  /** Auto-scroll enabled */
  _autoScrollEnabled: boolean = true;

  /** Timestamp when user last scrolled */
  _userScrollIntentUntil: number = 0;

  /** IntersectionObserver for scroll sentinel */
  _scrollObserver: IntersectionObserver | null = null;

  /** Scroll sentinel element */
  _scrollSentinel: HTMLDivElement | null = null;

  /**
   * Initialize smart scroll management
   */
  init(container: HTMLElement) {
    if (!container) return;

    // Create bottom sentinel element
    this._scrollSentinel = document.createElement('div');
    this._scrollSentinel.className = 'scroll-sentinel';
    this._scrollSentinel.style.height = '1px';
    container.appendChild(this._scrollSentinel);

    // Create IntersectionObserver to detect if user is at bottom
    this._scrollObserver = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        // If sentinel is visible, user is at bottom - enable auto-scroll
        if (entry.isIntersecting) {
          this._autoScrollEnabled = true;
        }
      },
      {
        root: container,
        threshold: 0.1,
      }
    );

    this._scrollObserver.observe(this._scrollSentinel);

    // Detect user scroll intent
    container.addEventListener('wheel', () => this._handleUserScrollIntent(), { passive: true });
    container.addEventListener('touchmove', () => this._handleUserScrollIntent(), { passive: true });
    container.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home'].includes(e.key)) {
        this._handleUserScrollIntent();
      }
    });

    console.log('[MessageRenderer] Smart scroll initialized');
  }

  /**
   * Handle user scroll intent - disable auto-scroll temporarily
   */
  _handleUserScrollIntent() {
    this._autoScrollEnabled = false;
    this._userScrollIntentUntil = Date.now() + 3000; // Disable for 3 seconds
  }

  /**
   * Scroll to bottom if auto-scroll is enabled
   */
  scrollToBottomIfEnabled(container: HTMLElement, force = false) {
    if (!container) return;

    // Check if user scroll intent has expired
    if (Date.now() > this._userScrollIntentUntil) {
      this._autoScrollEnabled = true;
    }

    if (force || this._autoScrollEnabled) {
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
    }
  }

  /**
   * Force scroll to bottom (for new messages from user)
   */
  scrollToBottom(container: HTMLElement) {
    this.scrollToBottomIfEnabled(container, true);
    this._autoScrollEnabled = true;
  }

  /**
   * Check if auto-scroll is currently enabled
   */
  isAutoScrollEnabled(): boolean {
    return this._autoScrollEnabled;
  }

  /**
   * Cleanup scroll observer
   */
  destroy() {
    if (this._scrollObserver) {
      this._scrollObserver.disconnect();
      this._scrollObserver = null;
    }
    if (this._scrollSentinel) {
      this._scrollSentinel.remove();
      this._scrollSentinel = null;
    }
  }
}

export { SmartScroll };
