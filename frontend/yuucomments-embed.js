(() => {
  const ROOT_SELECTOR = "#yuucomments-iframe";
  const MIN_HEIGHT = 320;

  function newIframeSrc(src, root) {
    const url = new URL(src, window.location.href);
    const pageKey = root.dataset.pageKey || "";
    const theme = root.dataset.theme || "";
    const lang = root.dataset.lang || "";

    if (pageKey) {
      url.searchParams.set("pageKey", pageKey);
    }
    if (theme) {
      url.searchParams.set("theme", theme);
    }
    if (lang) {
      url.searchParams.set("lang", lang);
    }

    return url.toString();
  }

  function init() {
    const root = document.querySelector(ROOT_SELECTOR);
    if (!root || root.dataset.yuuCommentsIframeReady === "true") return;

    const src = root.dataset.src;
    if (!src) return;

    root.dataset.yuuCommentsIframeReady = "true";

    const iframe = document.createElement("iframe");
    iframe.src = newIframeSrc(src, root);
    iframe.title = "YuuComments";
    iframe.loading = "lazy";
    iframe.style.width = "100%";
    iframe.style.border = "0";
    iframe.style.display = "block";
    iframe.style.minHeight = `${MIN_HEIGHT}px`;

    window.addEventListener("message", (event) => {
      if (event.source !== iframe.contentWindow) return;

      const data = event.data;
      if (!data || data.type !== "yuucomments:resize") return;

      const height = Number(data.height);
      if (!Number.isFinite(height) || height <= 0) return;

      iframe.style.height = `${Math.max(MIN_HEIGHT, Math.ceil(height))}px`;
    });

    root.replaceChildren(iframe);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
