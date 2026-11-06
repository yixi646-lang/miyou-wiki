export const escapeHTML = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );

export function installUIControls(document) {
  let pointerStart;
  const outside = (dialog, event) => {
    const rect = dialog.getBoundingClientRect();
    return event.clientX < rect.left || event.clientX > rect.right ||
      event.clientY < rect.top || event.clientY > rect.bottom;
  };
  document.addEventListener('pointerdown', event => {
    const dialog = event.target.closest?.('dialog[open]');
    pointerStart = dialog ? { dialog, outside: event.target === dialog && outside(dialog, event) } : null;
  }, true);
  document.addEventListener('click', event => {
    const start = pointerStart;
    pointerStart = null;
    const dialog = event.target;
    if (!dialog.matches?.('dialog[open]') || !outside(dialog, event)) return;
    if (start && (start.dialog !== dialog || !start.outside)) {
      event.stopPropagation();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (typeof dialog.requestClose === 'function') dialog.requestClose();
    else {
      const CancelEvent = document.defaultView?.Event ?? Event;
      if (dialog.dispatchEvent(new CancelEvent('cancel', { cancelable: true }))) dialog.close();
    }
  }, true);
  document.addEventListener("keydown", (event) => {
    const group = event.target.closest?.('[role="menu"],[role="tablist"]');
    if (
      !group ||
      ![
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "Home",
        "End",
      ].includes(event.key)
    )
      return;
    const choices = [
      ...group.querySelectorAll(
        'button:not(:disabled),a[href],[role="menuitem"]',
      ),
    ].filter((node) => !node.hidden);
    if (!choices.length) return;
    const current = choices.indexOf(event.target),
      next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? choices.length - 1
            : (current +
                (["ArrowLeft", "ArrowUp"].includes(event.key) ? -1 : 1) +
                choices.length) %
              choices.length;
    event.preventDefault();
    choices[next].focus();
  });
  document.addEventListener("click", (event) => {
    const close = event.target.closest?.("[data-close-dialog]");
    if (close) close.closest("dialog")?.close();
  });
}
