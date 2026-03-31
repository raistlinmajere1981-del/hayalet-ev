import assert from "node:assert/strict";
import test from "node:test";

class FakeClassList {
  private readonly tokens = new Set<string>();

  add(...nextTokens: string[]): void {
    nextTokens.forEach((token) => {
      if (token !== "") {
        this.tokens.add(token);
      }
    });
  }

  remove(...nextTokens: string[]): void {
    nextTokens.forEach((token) => {
      this.tokens.delete(token);
    });
  }

  contains(token: string): boolean {
    return this.tokens.has(token);
  }
}

class FakeNode {
  static readonly TEXT_NODE = 3;

  nodeType = 0;
  parentNode: FakeNode | null = null;
  childNodes: FakeNode[] = [];

  get nextSibling(): FakeNode | null {
    if (this.parentNode === null) {
      return null;
    }

    const siblings = this.parentNode.childNodes;
    const index = siblings.indexOf(this);
    return index >= 0 ? (siblings[index + 1] ?? null) : null;
  }

  get textContent(): string {
    return this.childNodes.map((child) => child.textContent).join("");
  }

  set textContent(value: string) {
    this.childNodes = value === "" ? [] : [new FakeTextNode(value)];
    this.childNodes.forEach((child) => {
      child.parentNode = this;
    });
  }
}

class FakeTextNode extends FakeNode {
  nodeType = FakeNode.TEXT_NODE;

  constructor(private value: string) {
    super();
  }

  override get textContent(): string {
    return this.value;
  }

  override set textContent(value: string) {
    this.value = value;
  }
}

class FakeDocumentFragment extends FakeNode {
  nodeType = 11;

  append(...items: Array<FakeNode | string>): void {
    items.forEach((item) => {
      const node = typeof item === "string" ? new FakeTextNode(item) : item;
      node.parentNode = this;
      this.childNodes.push(node);
    });
  }
}

class FakeHTMLElement extends FakeNode {
  nodeType = 1;
  dataset: Record<string, string> = {};
  classList = new FakeClassList();
  contentEditable = "inherit";
  title = "";
  value = "";
  private attributes = new Map<string, string>();

  constructor(public readonly tagName: string) {
    super();
  }

  append(...items: Array<FakeNode | string>): void {
    items.forEach((item) => {
      const node =
        item instanceof FakeDocumentFragment
          ? item
          : (typeof item === "string" ? new FakeTextNode(item) : item);
      if (node instanceof FakeDocumentFragment) {
        node.childNodes.forEach((child) => {
          child.parentNode = this;
          this.childNodes.push(child);
        });
        return;
      }

      node.parentNode = this;
      this.childNodes.push(node);
    });
  }

  replaceChildren(...items: Array<FakeNode | string>): void {
    this.childNodes = [];
    this.append(...items);
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }
}

class FakeHTMLSpanElement extends FakeHTMLElement {
  constructor() {
    super("SPAN");
  }
}

class FakeHTMLBRElement extends FakeHTMLElement {
  constructor() {
    super("BR");
  }
}

class FakeHTMLTextAreaElement extends FakeHTMLElement {
  constructor() {
    super("TEXTAREA");
  }
}

class FakeDocument {
  createElement(tagName: string): FakeHTMLElement {
    const normalizedTag = tagName.toLowerCase();
    if (normalizedTag === "span") {
      return new FakeHTMLSpanElement();
    }
    if (normalizedTag === "br") {
      return new FakeHTMLBRElement();
    }
    if (normalizedTag === "textarea") {
      return new FakeHTMLTextAreaElement();
    }
    return new FakeHTMLElement(tagName.toUpperCase());
  }

  createTextNode(value: string): FakeTextNode {
    return new FakeTextNode(value);
  }

  createDocumentFragment(): FakeDocumentFragment {
    return new FakeDocumentFragment();
  }
}

class FakeBroadcastChannel {
  constructor(_name: string) {}

  addEventListener(): void {}

  removeEventListener(): void {}

  postMessage(): void {}

  close(): void {}
}

function installFakeDom(): () => void {
  const originalGlobals = {
    Node: globalThis.Node,
    HTMLElement: globalThis.HTMLElement,
    HTMLBRElement: globalThis.HTMLBRElement,
    HTMLSpanElement: globalThis.HTMLSpanElement,
    HTMLTextAreaElement: globalThis.HTMLTextAreaElement,
    BroadcastChannel: globalThis.BroadcastChannel,
    document: globalThis.document,
  };

  Object.assign(globalThis, {
    Node: FakeNode,
    HTMLElement: FakeHTMLElement,
    HTMLBRElement: FakeHTMLBRElement,
    HTMLSpanElement: FakeHTMLSpanElement,
    HTMLTextAreaElement: FakeHTMLTextAreaElement,
    BroadcastChannel: FakeBroadcastChannel,
    document: new FakeDocument(),
  });

  return () => {
    Object.assign(globalThis, originalGlobals);
  };
}

test("archives protocol editor renders placeholder chips and serializes them back to raw tags", async () => {
  const restoreDom = installFakeDom();
  const { AppState } = await import("../../src/js/modules/app-state.ts");
  const { applyProtocolSelectionView, readProtocolEditorValue } = await import(
    "../../src/js/pages/archives/protocol-editor.ts"
  );
  const originalGetNickname = AppState.getNickname;
  (AppState.getNickname as unknown as (provider: string) => string) = (provider: string) =>
    ({
      ai0: "Asistan",
      ai1: "Ada",
      ai2: "Bora",
      us1: "Uzak Kullanici",
    })[provider] ?? provider.toUpperCase();

  try {
    const protocolEditorTitleEl = new FakeHTMLElement("DIV");
    const protocolEditorEl = new FakeHTMLElement("DIV");
    const protocolTextareaEl = new FakeHTMLTextAreaElement();
    const protocolEmptyEl = new FakeHTMLElement("DIV");
    const protocolSaveBtn = new FakeHTMLElement("BUTTON");
    let latestStatus = "initial";

    applyProtocolSelectionView({
      key: "AI-assistant",
      protocols: {
        "AI-assistant": "Merhaba <AI0>\n<US1> burada.",
      },
      protocolEditorTitleEl,
      protocolEditorEl,
      protocolTextareaEl,
      protocolEmptyEl,
      protocolSaveBtn,
      protocolTagButtonsEl: null,
      setStatus: (text) => {
        latestStatus = text;
      },
    });

    assert.equal(protocolEditorTitleEl.textContent, "AI-assistant");
    assert.equal(protocolTextareaEl.value, "Merhaba <AI0>\n<US1> burada.");
    assert.equal(
      protocolEditorEl.childNodes.some(
        (node) => node instanceof FakeHTMLElement && node.dataset["protocolTag"] === "<AI0>"
      ),
      true
    );
    assert.equal(
      protocolEditorEl.childNodes.some(
        (node) => node instanceof FakeHTMLElement && node.dataset["protocolTag"] === "<US1>"
      ),
      true
    );
    assert.equal(
      readProtocolEditorValue({
        protocolEditorEl,
        protocolTextareaEl,
      }),
      "Merhaba <AI0>\n<US1> burada."
    );
    assert.equal(protocolEmptyEl.classList.contains("is-hidden"), true);
    assert.equal(protocolSaveBtn.classList.contains("is-hidden"), false);
    assert.equal(latestStatus, "");
  } finally {
    (AppState.getNickname as unknown as (provider: string) => string) = originalGetNickname.bind(AppState);
    restoreDom();
  }
});

test("archives protocol locale change reloads protocols when the page is open", async () => {
  const restoreDom = installFakeDom();
  const { handleProtocolLocaleChange } = await import("../../src/js/pages/archives/protocol-locale.ts");
  let loadProtocolsCalls = 0;
  let applyTranslationsCalls = 0;

  try {
    await handleProtocolLocaleChange({
      isOpen: true,
      loadProtocols: async () => {
        loadProtocolsCalls += 1;
      },
      applyTranslations: () => {
        applyTranslationsCalls += 1;
      },
    });

    assert.equal(loadProtocolsCalls, 1);
    assert.equal(applyTranslationsCalls, 2);
  } finally {
    restoreDom();
  }
});
