export function revealSearchTarget(host, hash, { rank } = {}) {
  const id = String(hash ?? "").replace(/^#/, "");
  if (!/^entry-(?:skills|upgrades)-\d+$|^effects$/.test(id)) return false;
  const target = host.querySelector("#" + id);
  if (!target) return false;
  for (let node = target; node && node !== host; node = node.parentElement)
    if (node.tagName === "DETAILS") node.open = true;
  if (id === "effects" && Number.isFinite(Number(rank))) {
    const select = host.querySelector("#effect-rank");
    if (select) {
      const option = [...select.options].find(
        (item) => item.textContent === String(rank),
      );
      if (option) {
        select.value = option.value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
  }
  target.classList.add("entry-search-highlight");
  target.scrollIntoView({ block: "center" });
  return true;
}
