export const escapeHTML = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );

export function installUIControls(document) {
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
