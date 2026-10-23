import { pathToFileURL } from "node:url";
export async function installDOM(
  html = "<html><head></head><body><main></main></body></html>",
) {
  const { parseHTML } = await import(
    pathToFileURL(process.env.WIKI_TEST_DOM_PACKAGE)
  );
  const { document, window } = parseHTML(html),
    keys = [
      "document",
      "window",
      "FormData",
      "Event",
      "localStorage",
      "sessionStorage",
      "BroadcastChannel",
      "confirm",
    ],
    previous = new Map(
      keys.map((key) => [
        key,
        { present: Object.hasOwn(globalThis, key), value: globalThis[key] },
      ]),
    ),
    channels = [];
  Object.defineProperty(window.HTMLSelectElement.prototype, "value", {
    configurable: true,
    get() {
      return (
        [...this.querySelectorAll("option")].find((option) =>
          option.hasAttribute("selected"),
        )?.value ??
        this.querySelector("option")?.value ??
        ""
      );
    },
    set(value) {
      for (const option of this.querySelectorAll("option"))
        option.toggleAttribute(
          "selected",
          String(option.value) === String(value),
        );
    },
  });
  const textarea = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value",
    ),
    typed = new WeakMap();
  Object.defineProperty(window.HTMLTextAreaElement.prototype, "value", {
    configurable: true,
    get() {
      if (typed.has(this)) return typed.get(this);
      return textarea.get
        .call(this)
        .replace(
          /&(quot|#39|lt|gt|amp);/g,
          (_, name) =>
            ({ quot: '"', "#39": "'", lt: "<", gt: ">", amp: "&" })[name],
        );
    },
    set(value) {
      typed.set(this, String(value));
      textarea.set.call(this, value);
    },
  });
  Object.defineProperty(window.HTMLElement.prototype, "elements", {
    configurable: true,
    get() {
      return {
        namedItem: (name) => this.querySelector('[name="' + name + '"]'),
      };
    },
  });
  window.HTMLElement.prototype.scrollIntoView = function () {};
  const storage = () => {
    const values = new Map();
    return {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: (key) => values.delete(key),
      values,
    };
  };
  Object.assign(globalThis, {
    document,
    window,
    Event: window.Event,
    localStorage: storage(),
    sessionStorage: storage(),
    confirm: () => true,
    FormData: class {
      constructor(form) {
        this.values = [
          ...form.querySelectorAll("input[name],select[name],textarea[name]"),
        ]
          .filter((input) => !input.disabled)
          .map((input) => [input.name, input.value ?? ""]);
      }
      *[Symbol.iterator]() {
        yield* this.values;
      }
    },
    BroadcastChannel: class {
      constructor() {
        channels.push(this);
      }
      postMessage(value) {
        this.sent = value;
      }
      close() {}
    },
  });
  return {
    document,
    window,
    channels,
    restore() {
      for (const [key, prior] of previous)
        if (prior.present) globalThis[key] = prior.value;
        else delete globalThis[key];
    },
  };
}
