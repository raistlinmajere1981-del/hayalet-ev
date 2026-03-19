export const OVERLAY_KINDS = {
  workspace: "workspace",
  scenario: "scenario",
  assistant: "assistant",
  loading: "loading",
  status: "status",
  modal: "modal",
} as const;

export const OVERLAY_GROUPS = {
  workspace: "workspace-overlays",
  assistantTools: "assistant-tool-overlays",
  entranceScenario: "entrance-scenario-overlays",
  assistantScenario: "assistant-scenario-overlays",
  opencodeUi: "opencode-ui-overlays",
  loading: "loading-overlays",
} as const;

export type OverlayKind = (typeof OVERLAY_KINDS)[keyof typeof OVERLAY_KINDS];
type OverlayGroup = string;

interface ManagedOverlayDefinition {
  id: string;
  element: HTMLElement;
  kind: OverlayKind;
  isOpen: () => boolean;
  setOpen: (open: boolean) => void;
  exclusiveGroup?: OverlayGroup | undefined;
  lockScroll?: boolean | undefined;
  closeOnEscape?: boolean | undefined;
  onAfterOpen?: (() => void) | undefined;
  onAfterClose?: (() => void) | undefined;
}

interface ManagedOverlay {
  id: string;
  element: HTMLElement;
  kind: OverlayKind;
  isOpen: () => boolean;
  setOpen: (open: boolean) => void;
  exclusiveGroup: OverlayGroup | null;
  lockScroll: boolean;
  closeOnEscape: boolean;
  onAfterOpen?: (() => void) | undefined;
  onAfterClose?: (() => void) | undefined;
}

export interface ManagedOverlayController {
  open: () => void;
  close: () => void;
  toggle: () => void;
  isOpen: () => boolean;
  sync: () => void;
  destroy: () => void;
}

export interface InlineStatusOverlayState {
  stateClass: string;
  title: string;
  subtitle: string;
  icon?: string;
}

export interface InlineStatusOverlayController extends ManagedOverlayController {
  setState: (state: InlineStatusOverlayState | null) => void;
}

interface CreateHiddenClassOverlayControllerOptions {
  id: string;
  element: HTMLElement;
  kind: OverlayKind;
  hiddenClass?: string;
  syncAriaHidden?: boolean;
  exclusiveGroup?: OverlayGroup;
  lockScroll?: boolean;
  closeOnEscape?: boolean;
  onAfterOpen?: () => void;
  onAfterClose?: () => void;
}

interface CreateInlineStatusOverlayControllerOptions {
  id: string;
  element: HTMLElement;
  kind?: OverlayKind;
  hiddenClass?: string;
  syncAriaHidden?: boolean;
  baseClasses?: string[];
  stateClasses?: string[];
  iconSelector?: string;
  titleSelector?: string;
  subtitleSelector?: string;
  blockedTarget?: HTMLElement | null;
  blockedClass?: string;
  exclusiveGroup?: OverlayGroup;
  lockScroll?: boolean;
  closeOnEscape?: boolean;
  onAfterOpen?: () => void;
  onAfterClose?: () => void;
}

const overlays = new Map<string, ManagedOverlay>();
const overlayStack: string[] = [];

let escapeHandlerBound = false;

function markOverlayElementState(overlay: ManagedOverlay): void {
  overlay.element.dataset["overlayKind"] = overlay.kind;
  overlay.element.dataset["overlayOpen"] = String(overlay.isOpen());

  if (overlay.exclusiveGroup === null) {
    delete overlay.element.dataset["overlayGroup"];
    return;
  }

  overlay.element.dataset["overlayGroup"] = overlay.exclusiveGroup;
}

function removeOverlayElementState(overlay: ManagedOverlay): void {
  delete overlay.element.dataset["overlayKind"];
  delete overlay.element.dataset["overlayOpen"];
  delete overlay.element.dataset["overlayGroup"];
}

function syncManagedOverlayScrollLock(): void {
  const shouldLock = Array.from(overlays.values()).some(
    (overlay) => overlay.lockScroll && overlay.isOpen()
  );

  document.body.classList.toggle("is-scroll-locked", shouldLock);
}

function removeFromStack(id: string): void {
  const index = overlayStack.indexOf(id);
  if (index >= 0) {
    overlayStack.splice(index, 1);
  }
}

function pushToStack(id: string): void {
  removeFromStack(id);
  overlayStack.push(id);
}

function closeManagedOverlay(overlay: ManagedOverlay): void {
  if (!overlay.isOpen()) {
    removeFromStack(overlay.id);
    markOverlayElementState(overlay);
    syncManagedOverlayScrollLock();
    return;
  }

  overlay.setOpen(false);
  removeFromStack(overlay.id);
  markOverlayElementState(overlay);
  syncManagedOverlayScrollLock();
  overlay.onAfterClose?.();
}

function closeOverlayGroup(group: OverlayGroup, exceptId?: string): void {
  overlays.forEach((overlay) => {
    if (overlay.exclusiveGroup !== group || overlay.id === exceptId || !overlay.isOpen()) {
      return;
    }

    closeManagedOverlay(overlay);
  });
}

function openManagedOverlay(overlay: ManagedOverlay): void {
  if (overlay.exclusiveGroup !== null) {
    closeOverlayGroup(overlay.exclusiveGroup, overlay.id);
  }

  if (overlay.isOpen()) {
    pushToStack(overlay.id);
    markOverlayElementState(overlay);
    syncManagedOverlayScrollLock();
    return;
  }

  overlay.setOpen(true);
  pushToStack(overlay.id);
  markOverlayElementState(overlay);
  syncManagedOverlayScrollLock();
  overlay.onAfterOpen?.();
}

function getTopmostEscapeOverlay(): ManagedOverlay | null {
  for (let index = overlayStack.length - 1; index >= 0; index -= 1) {
    const overlayId = overlayStack[index];
    if (overlayId == null) {
      continue;
    }

    const overlay = overlays.get(overlayId);
    if (overlay == null || !overlay.isOpen() || overlay.closeOnEscape === false) {
      continue;
    }

    return overlay;
  }

  return null;
}

function handleManagedOverlayEscape(event: KeyboardEvent): void {
  if (event.key !== "Escape") {
    return;
  }

  const overlay = getTopmostEscapeOverlay();
  if (overlay == null) {
    return;
  }

  closeManagedOverlay(overlay);
}

function ensureEscapeHandler(): void {
  if (escapeHandlerBound) {
    return;
  }

  document.addEventListener("keydown", handleManagedOverlayEscape);
  escapeHandlerBound = true;
}

function maybeRemoveEscapeHandler(): void {
  if (!escapeHandlerBound || overlays.size > 0) {
    return;
  }

  document.removeEventListener("keydown", handleManagedOverlayEscape);
  escapeHandlerBound = false;
}

export function createManagedOverlayController(
  definition: ManagedOverlayDefinition
): ManagedOverlayController {
  const managedOverlay: ManagedOverlay = {
    ...definition,
    exclusiveGroup: definition.exclusiveGroup ?? null,
    lockScroll: definition.lockScroll !== false,
    closeOnEscape: definition.closeOnEscape !== false,
  };

  overlays.set(managedOverlay.id, managedOverlay);
  markOverlayElementState(managedOverlay);
  ensureEscapeHandler();
  syncManagedOverlayScrollLock();

  return {
    open(): void {
      openManagedOverlay(managedOverlay);
    },
    close(): void {
      closeManagedOverlay(managedOverlay);
    },
    toggle(): void {
      if (managedOverlay.isOpen()) {
        closeManagedOverlay(managedOverlay);
        return;
      }

      openManagedOverlay(managedOverlay);
    },
    isOpen(): boolean {
      return managedOverlay.isOpen();
    },
    sync(): void {
      if (managedOverlay.isOpen()) {
        pushToStack(managedOverlay.id);
      } else {
        removeFromStack(managedOverlay.id);
      }

      markOverlayElementState(managedOverlay);
      syncManagedOverlayScrollLock();
    },
    destroy(): void {
      removeFromStack(managedOverlay.id);
      overlays.delete(managedOverlay.id);
      removeOverlayElementState(managedOverlay);
      syncManagedOverlayScrollLock();
      maybeRemoveEscapeHandler();
    },
  };
}

export function createHiddenClassOverlayController(
  options: CreateHiddenClassOverlayControllerOptions
): ManagedOverlayController {
  const hiddenClass = options.hiddenClass ?? "is-hidden";
  const syncAriaHidden = options.syncAriaHidden === true;

  return createManagedOverlayController({
    id: options.id,
    element: options.element,
    kind: options.kind,
    exclusiveGroup: options.exclusiveGroup,
    lockScroll: options.lockScroll,
    closeOnEscape: options.closeOnEscape,
    onAfterOpen: options.onAfterOpen,
    onAfterClose: options.onAfterClose,
    isOpen: () =>
      !options.element.classList.contains(hiddenClass) &&
      (!syncAriaHidden || options.element.getAttribute("aria-hidden") !== "true"),
    setOpen: (open: boolean) => {
      options.element.classList.toggle(hiddenClass, !open);
      if (syncAriaHidden) {
        options.element.setAttribute("aria-hidden", String(!open));
      }
    },
  });
}

export function createInlineStatusOverlayController(
  options: CreateInlineStatusOverlayControllerOptions
): InlineStatusOverlayController {
  const hiddenClass = options.hiddenClass ?? "is-hidden";
  const syncAriaHidden = options.syncAriaHidden === true;
  const stateClasses = options.stateClasses ?? [];
  const blockedClass = options.blockedClass ?? "webview-content-blocked";
  const baseClasses =
    options.baseClasses ??
    Array.from(options.element.classList).filter(
      (className) => className !== hiddenClass && !stateClasses.includes(className)
    );
  const iconEl = options.element.querySelector(options.iconSelector ?? ".overlay-icon");
  const titleEl = options.element.querySelector(options.titleSelector ?? ".overlay-title");
  const subtitleEl = options.element.querySelector(options.subtitleSelector ?? ".overlay-subtitle");

  const applyState = (state: InlineStatusOverlayState): void => {
    baseClasses.forEach((className) => {
      options.element.classList.add(className);
    });
    stateClasses.forEach((className) => {
      options.element.classList.remove(className);
    });
    if (state.stateClass !== "") {
      options.element.classList.add(state.stateClass);
    }

    if (iconEl instanceof HTMLElement) {
      iconEl.textContent = state.icon ?? "";
    }
    if (titleEl instanceof HTMLElement) {
      titleEl.textContent = state.title;
    }
    if (subtitleEl instanceof HTMLElement) {
      subtitleEl.textContent = state.subtitle;
    }
  };

  const overlayController = createManagedOverlayController({
    id: options.id,
    element: options.element,
    kind: options.kind ?? OVERLAY_KINDS.status,
    exclusiveGroup: options.exclusiveGroup,
    lockScroll: options.lockScroll ?? false,
    closeOnEscape: options.closeOnEscape ?? false,
    onAfterOpen: options.onAfterOpen,
    onAfterClose: options.onAfterClose,
    isOpen: () =>
      !options.element.classList.contains(hiddenClass) &&
      (!syncAriaHidden || options.element.getAttribute("aria-hidden") !== "true"),
    setOpen: (open: boolean) => {
      options.element.classList.toggle(hiddenClass, !open);
      options.blockedTarget?.classList.toggle(blockedClass, open);
      if (syncAriaHidden) {
        options.element.setAttribute("aria-hidden", String(!open));
      }
    },
  });

  return {
    ...overlayController,
    setState(state: InlineStatusOverlayState | null): void {
      if (state === null) {
        overlayController.close();
        return;
      }

      applyState(state);
      overlayController.open();
    },
  };
}

export { syncManagedOverlayScrollLock };
