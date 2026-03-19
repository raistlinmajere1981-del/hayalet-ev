export type ExternalToolPageName = "archives" | "settings" | "whisper";

const DEFAULT_RETURN_PAGE = "entrance";
const HOST_CLOSE_SPECIAL_PAGE_EVENT = "close-special-page";

function isHostedInMainShell(): boolean {
  return document.getElementById("pages-container") instanceof HTMLElement;
}

function dispatchHostPageNavigation(page: string): void {
  document.dispatchEvent(
    new CustomEvent<{ page: string }>("navigate-page", {
      detail: { page },
    })
  );
}

function dispatchHostSpecialPageClose(page: string): void {
  document.dispatchEvent(
    new CustomEvent<{ page: string }>(HOST_CLOSE_SPECIAL_PAGE_EVENT, {
      detail: { page },
    })
  );
}

function normalizePageName(value: string | null | undefined, fallback: string): string {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized === "" ? fallback : normalized;
}

function setOptionalParam(url: URL, key: string, value: string | null | undefined): void {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (normalized === "") {
    url.searchParams.delete(key);
    return;
  }

  url.searchParams.set(key, normalized);
}

export function buildExternalToolPageUrl(
  page: ExternalToolPageName,
  options: {
    panel?: string | null;
    returnPage?: string | null;
  } = {}
): URL {
  const url = new URL(`./pages/${page}.html`, window.location.href);
  setOptionalParam(url, "returnPage", normalizePageName(options.returnPage, DEFAULT_RETURN_PAGE));
  setOptionalParam(url, "panel", options.panel);
  return url;
}

export function openExternalToolPage(
  page: ExternalToolPageName,
  options: {
    panel?: string | null;
    returnPage?: string | null;
    replace?: boolean;
  } = {}
): void {
  if (isHostedInMainShell()) {
    dispatchHostPageNavigation(page);
    if (page === "settings") {
      document.dispatchEvent(
        new CustomEvent<{ panel?: string | null }>("settings-hub:open", {
          detail: { panel: options.panel ?? null },
        })
      );
    }
    return;
  }

  const targetUrl = buildExternalToolPageUrl(page, options).toString();
  if (options.replace === true) {
    window.location.replace(targetUrl);
    return;
  }

  window.location.assign(targetUrl);
}

export function buildMainShellUrl(returnPage?: string | null): URL {
  const url = new URL("../index.html", window.location.href);
  setOptionalParam(url, "page", normalizePageName(returnPage, DEFAULT_RETURN_PAGE));
  return url;
}

export function navigateMainShellPage(pageName: string, options: { replace?: boolean } = {}): void {
  const normalizedPageName = normalizePageName(pageName, DEFAULT_RETURN_PAGE);
  if (isHostedInMainShell()) {
    dispatchHostPageNavigation(normalizedPageName);
    return;
  }

  const targetUrl = buildMainShellUrl(normalizedPageName).toString();
  if (options.replace === true) {
    window.location.replace(targetUrl);
    return;
  }

  window.location.assign(targetUrl);
}

export function resolveExternalReturnPage(fallback = DEFAULT_RETURN_PAGE): string {
  return normalizePageName(new URLSearchParams(window.location.search).get("returnPage"), fallback);
}

export function resolveExternalPanel(): string | null {
  const panel = new URLSearchParams(window.location.search).get("panel");
  const normalized = typeof panel === "string" ? panel.trim() : "";
  return normalized === "" ? null : normalized;
}

export function closeExternalPage(
  options: { fallbackPage?: string; replace?: boolean } = {}
): void {
  if (isHostedInMainShell()) {
    const activePage = normalizePageName(
      document.documentElement.getAttribute("data-active-page"),
      ""
    );
    if (activePage !== "") {
      dispatchHostSpecialPageClose(activePage);
      return;
    }

    dispatchHostPageNavigation(normalizePageName(options.fallbackPage, DEFAULT_RETURN_PAGE));
    return;
  }

  const targetUrl = buildMainShellUrl(
    resolveExternalReturnPage(options.fallbackPage ?? DEFAULT_RETURN_PAGE)
  ).toString();

  if (options.replace === true) {
    window.location.replace(targetUrl);
    return;
  }

  window.location.assign(targetUrl);
}
