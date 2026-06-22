import test from "node:test";
import assert from "node:assert/strict";
import { importLabRootModuleWithDomStub } from "./laboratory-runtime-truth.helpers.ts";

describe("observability runtime paths", () => {
  void test("laboratory observability runtime paths log region fallback and overlay health without replacing shell", async () => {
    class RuntimeHarnessElement extends ElementStub {
      appendedChildren: RuntimeHarnessElement[] = [];
      attributes = new Map<string, string>();
      childNodes: RuntimeHarnessElement[] = [];
      className = "";
      outerHtmlWrites: string[] = [];
      parentElement: RuntimeHarnessElement | null = null;
      private readonly queries = new Map<string, RuntimeHarnessElement | null>();

      constructor(
        readonly tagName = "DIV",
        attributes: Record<string, string> = {}
      ) {
        super();
        Object.entries(attributes).forEach(([key, value]) => {
          this.setAttribute(key, value);
        });
        this.className = attributes["class"] ?? "";
      }

      appendChild(child: RuntimeHarnessElement): RuntimeHarnessElement {
        child.parentElement = this;
        this.appendedChildren.push(child);
        this.childNodes.push(child);
        return child;
      }

      cloneNode(): RuntimeHarnessElement {
        return new RuntimeHarnessElement(this.tagName, Object.fromEntries(this.attributes));
      }

      get outerHTML(): string {
        return this.innerHTML;
      }

      set outerHTML(value: string) {
        this.outerHtmlWrites.push(value);
        this.innerHTML = value;
      }

      getAttribute(name: string): string | null {
        return this.attributes.get(name) ?? null;
      }

      getAttributeNames(): string[] {
        return Array.from(this.attributes.keys());
      }

      hasAttribute(name: string): boolean {
        return this.attributes.has(name);
      }

      override querySelector(selector?: string): null {
        if (selector == null || selector === "") return null;
        return (this.queries.get(selector) as unknown as null) ?? null;
      }

      remove(): void {
        this.parentElement?.childNodes.splice(this.parentElement.childNodes.indexOf(this), 1);
      }

      removeAttribute(name: string): void {
        this.attributes.delete(name);
      }

      replaceWith(next: RuntimeHarnessElement): void {
        this.outerHtmlWrites.push(next.outerHTML);
      }

      setAttribute(name: string, value: string): void {
        this.attributes.set(name, value);
        if (name === "class") {
          this.className = value;
        }
      }

      setQuery(selector: string, element: RuntimeHarnessElement | null): void {
        this.queries.set(selector, element);
      }
    }

    class RuntimeHarnessTemplate {
      content: { firstElementChild: RuntimeHarnessElement | null } = {
        firstElementChild: null,
      };

      set innerHTML(markup: string) {
        const trimmed = markup.trim();
        const tag = /^<([a-z0-9-]+)/i.exec(trimmed)?.[1]?.toUpperCase() ?? "";
        if (tag === "") {
          this.content.firstElementChild = null;
          return;
        }
        const className = /\sclass="([^"]*)"/.exec(trimmed)?.[1] ?? "";
        this.content.firstElementChild = new RuntimeHarnessElement(tag, { class: className });
        this.content.firstElementChild.innerHTML = trimmed;
      }
    }

    type LabRootObservabilityRuntime = {
      __testOnlyLabRootObservability: {
        queryRegion: (root: ParentNode, selectors: readonly string[]) => HTMLElement | null;
        shouldFallback: (regionsFound: number) => boolean;
        syncOverlayRoot: (
          documentRef: Document,
          root: HTMLElement,
          overlayKey: "report" | "tools",
          selector: string,
          render: () => string,
          debugShell?: Element | null
        ) => boolean;
        syncRegion: (input: {
          debugShell?: Element | null;
          documentRef: Document;
          preserveScroll?: boolean;
          regionKey?:
            | "contextPanel"
            | "inspectorPanel"
            | "leftRail"
            | "mainStage"
            | "processStrip"
            | "topBar";
          render: () => string;
          root: ParentNode;
          selectors: readonly string[];
        }) => boolean;
      };
    };

    const labRootModule = await importLabRootModuleWithDomStub<LabRootObservabilityRuntime>();
    const observability = labRootModule.__testOnlyLabRootObservability;
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, "HTMLElement");
    const documentRef = {
      createElement(tagName: string) {
        if (tagName === "template") {
          return new RuntimeHarnessTemplate();
        }
        return new RuntimeHarnessElement(tagName.toUpperCase());
      },
    } as unknown as Document;

    Object.defineProperty(globalThis, "HTMLElement", {
      configurable: true,
      value: RuntimeHarnessElement,
    });
    try {
      const root = new RuntimeHarnessElement("DIV");
      const debugShell = new RuntimeHarnessElement("DIV", {
        "data-lab-debug-regions": "true",
      });
      const topbar = new RuntimeHarnessElement("SECTION", {
        class: "labx-top-bar",
        "data-lab-region": "topbar",
      });
      topbar.scrollTop = 17;
      topbar.parentElement = root;
      root.setQuery('[data-lab-region="topbar"]', topbar);

      const regionLogs = captureDebugLogs(function () {
        const updated = observability.syncRegion({
          debugShell: debugShell as unknown as Element,
          documentRef,
          preserveScroll: true,
          regionKey: "topBar",
          render() {
            return '<article class="labx-top-bar">updated</article>';
          },
          root: root as unknown as ParentNode,
          selectors: ['[data-lab-region="topbar"]', ".labx-top-bar"],
        });
        const missing = observability.syncRegion({
          debugShell: debugShell as unknown as Element,
          documentRef,
          regionKey: "inspectorPanel",
          render() {
            return '<aside class="labx-workspace-inspector">missing</aside>';
          },
          root: root as unknown as ParentNode,
          selectors: ['[data-lab-region="inspector-panel"]', ".labx-workspace-inspector"],
        });

        assert.equal(updated, true);
        assert.equal(missing, false);
      });

      assert.equal(
        observability.queryRegion(root as unknown as ParentNode, ['[data-lab-region="topbar"]']),
        topbar
      );
      assert.equal(topbar.outerHtmlWrites.length, 1);
      assert.match(topbar.outerHtmlWrites[0] ?? "", /class="labx-top-bar"/);
      assert.deepEqual(
        regionLogs.map(function (entry) {
          return entry[0];
        }),
        ["[lab][region] topbar -> updated", "[lab][region] inspector -> missing"]
      );

      assert.equal(observability.shouldFallback(2), true);
      assert.equal(observability.shouldFallback(3), false);

      const overlayRoot = new RuntimeHarnessElement("DIV");
      const existingOverlay = new RuntimeHarnessElement("DIV", { class: "labx-overlay-root" });
      existingOverlay.parentElement = overlayRoot;
      overlayRoot.setQuery(".labx-overlay-root", existingOverlay);

      const overlayLogs = captureDebugLogs(function () {
        const updatedOverlay = observability.syncOverlayRoot(
          documentRef,
          overlayRoot as unknown as HTMLElement,
          "tools",
          ".labx-overlay-root",
          function () {
            return '<aside class="labx-overlay-root">updated</aside>';
          },
          debugShell as unknown as Element
        );
        const invalidOverlay = observability.syncOverlayRoot(
          documentRef,
          overlayRoot as unknown as HTMLElement,
          "report",
          "#lab-report-overlay-root",
          function () {
            return "";
          },
          debugShell as unknown as Element
        );

        assert.equal(updatedOverlay, true);
        assert.equal(invalidOverlay, false);
      });

      assert.equal(existingOverlay.outerHtmlWrites.length, 1);
      assert.equal(overlayRoot.outerHtmlWrites.length, 0);
      assert.equal(overlayRoot.appendedChildren.length, 0);
      assert.deepEqual(
        overlayLogs.map(function (entry) {
          return entry[0];
        }),
        ["[lab][overlay] report -> missing", "[lab][overlay] report -> invalid"]
      );

      const quietShell = new RuntimeHarnessElement("DIV");
      const quietLogs = captureDebugLogs(function () {
        observability.syncRegion({
          debugShell: quietShell as unknown as Element,
          documentRef,
          regionKey: "processStrip",
          render() {
            return '<div class="labx-process-strip"></div>';
          },
          root: root as unknown as ParentNode,
          selectors: ['[data-lab-region="process-strip"]'],
        });
        observability.syncOverlayRoot(
          documentRef,
          overlayRoot as unknown as HTMLElement,
          "report",
          "#lab-report-overlay-root",
          function () {
            return "";
          },
          quietShell as unknown as Element
        );
      });
      assert.equal(quietLogs.length, 0);
    } finally {
      if (descriptor) {
        Object.defineProperty(globalThis, "HTMLElement", descriptor);
      } else {
        Reflect.deleteProperty(globalThis, "HTMLElement");
      }
    }
  });
});
