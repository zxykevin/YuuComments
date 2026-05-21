(() => {
  function getHeight() {
    return Math.ceil(document.body.getBoundingClientRect().height);
  }

  function postHeight() {
    window.parent.postMessage(
      {
        type: "yuucomments:resize",
        height: getHeight(),
      },
      "*",
    );
  }

  function init() {
    postHeight();

    if ("ResizeObserver" in window) {
      const observer = new ResizeObserver(postHeight);
      observer.observe(document.body);
      return;
    }

    window.addEventListener("load", postHeight);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
