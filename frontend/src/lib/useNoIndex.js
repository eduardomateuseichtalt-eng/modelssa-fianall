import { useEffect } from "react";

export function useNoIndex() {
  useEffect(() => {
    const head = document.head;
    if (!head) {
      return undefined;
    }

    let meta = head.querySelector('meta[name="robots"]');
    const created = !meta;
    const previousContent = meta?.getAttribute("content");

    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "robots");
      head.appendChild(meta);
    }

    meta.setAttribute("content", "noindex, nofollow, noarchive");

    return () => {
      if (!meta) {
        return;
      }

      if (created) {
        meta.remove();
        return;
      }

      if (previousContent === null) {
        meta.removeAttribute("content");
        return;
      }

      meta.setAttribute("content", previousContent);
    };
  }, []);
}
