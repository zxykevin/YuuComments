(() => {
  const ROOT_SELECTOR = "#yuucomments, #yuulog-comments";

  function resolveConfig(root) {
    const globalConfig = window.YuuCommentsConfig ?? {};
    return {
      apiBase: root.dataset.apiBase || globalConfig.apiBase || "",
      siteKey: root.dataset.siteKey || globalConfig.turnstileSiteKey || "",
    };
  }

  function isHttpWebsite(value) {
    if (!value) return true;
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }

  function safeWebsite(value) {
    return value && isHttpWebsite(value) ? value : null;
  }

  function formatLocalTime(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleString(undefined, {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        });
  }

  function createMarkup(root) {
    root.classList.add("yc-root");
    root.innerHTML = `
      <section class="yc-section" aria-label="评论">
        <div class="yc-header">
          <h2>评论</h2>
          <span data-yc-count aria-live="polite"></span>
        </div>
        <div class="yc-list" data-yc-list aria-live="polite"></div>
        <form class="yc-form" data-yc-form novalidate>
          <div class="yc-form-heading">
            <h3 data-yc-form-title>发表评论</h3>
            <button type="button" data-yc-cancel-reply hidden>取消回复</button>
          </div>
          <div class="yc-grid">
            <label>
              <span>昵称</span>
              <input name="nickname" type="text" required maxlength="30" />
            </label>
            <label>
              <span>邮箱</span>
              <input name="email" type="email" maxlength="160" />
            </label>
            <label>
              <span>网站</span>
              <input name="website" type="url" placeholder="https://example.com" maxlength="240" />
            </label>
          </div>
          <label>
            <span>评论内容</span>
            <textarea name="content" required rows="5" maxlength="1000"></textarea>
          </label>
          <div class="yc-turnstile" data-yc-turnstile hidden></div>
          <div class="yc-footer">
            <p class="yc-feedback" data-yc-feedback aria-live="polite"></p>
            <button type="submit" data-yc-submit>提交</button>
          </div>
        </form>
      </section>
    `;
  }

  function renderConfigurationError(root) {
    root.classList.add("yc-root");
    root.innerHTML = `
      <div class="yc-state">
        <p>YuuComments 配置缺失：apiBase 或 turnstileSiteKey</p>
      </div>
    `;
  }

  function getElements(root) {
    return {
      list: root.querySelector("[data-yc-list]"),
      count: root.querySelector("[data-yc-count]"),
      form: root.querySelector("[data-yc-form]"),
      formTitle: root.querySelector("[data-yc-form-title]"),
      cancelReplyButton: root.querySelector("[data-yc-cancel-reply]"),
      feedback: root.querySelector("[data-yc-feedback]"),
      submitButton: root.querySelector("[data-yc-submit]"),
      turnstileSlot: root.querySelector("[data-yc-turnstile]"),
    };
  }

  function loadTurnstileScript() {
    if (window.turnstile) return Promise.resolve(window.turnstile);
    if (window.__yuuCommentsTurnstileLoader) {
      return window.__yuuCommentsTurnstileLoader;
    }

    window.__yuuCommentsTurnstileLoader = new Promise((resolve, reject) => {
      const existingScript = document.querySelector(
        'script[data-yuucomments-turnstile="true"]',
      );
      const script = existingScript ?? document.createElement("script");

      script.addEventListener(
        "load",
        () => {
          if (window.turnstile) {
            resolve(window.turnstile);
          } else {
            reject(new Error("Turnstile API unavailable"));
          }
        },
        { once: true },
      );
      script.addEventListener(
        "error",
        () => reject(new Error("Turnstile script failed to load")),
        { once: true },
      );

      if (!existingScript) {
        script.src =
          "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.defer = true;
        script.dataset.yuucommentsTurnstile = "true";
        document.head.append(script);
      }
    });

    return window.__yuuCommentsTurnstileLoader;
  }

  function renderState(container, message) {
    container.innerHTML = `<div class="yc-state"><p>${message}</p></div>`;
  }

  function renderComments(root, comments) {
    const { list, count } = getElements(root);
    if (!list) return;

    list.replaceChildren();
    if (count) count.textContent = comments.length ? `${comments.length}` : "";
    if (!comments.length) {
      renderState(list, "还没有评论。");
      return;
    }

    const commentsById = new Map(comments.map((comment) => [comment.id, comment]));
    const repliesByParentId = new Map();
    for (const comment of comments) {
      if (!comment.parentId) continue;
      const replies = repliesByParentId.get(comment.parentId) ?? [];
      replies.push(comment);
      repliesByParentId.set(comment.parentId, replies);
    }

    comments
      .filter((comment) => !comment.parentId)
      .forEach((comment) => {
        const article = createCommentArticle(root, comment, commentsById);
        appendReplies(
          root,
          comment.id,
          article.querySelector(".yc-replies"),
          repliesByParentId,
          commentsById,
        );
        list.append(article);
      });
  }

  function appendReplies(root, parentId, container, repliesByParentId, commentsById) {
    if (!container) return;
    for (const reply of repliesByParentId.get(parentId) ?? []) {
      const article = createCommentArticle(root, reply, commentsById);
      appendReplies(
        root,
        reply.id,
        article.querySelector(".yc-replies"),
        repliesByParentId,
        commentsById,
      );
      container.append(article);
    }
  }

  function createCommentArticle(root, comment, commentsById) {
    const article = document.createElement("article");
    article.className = "yc-comment";

    const meta = document.createElement("div");
    meta.className = "yc-meta";
    const website = safeWebsite(comment.website);
    const author = website ? document.createElement("a") : document.createElement("span");
    const parent = comment.parentId ? commentsById.get(comment.parentId) : null;
    author.className = "yc-author";
    author.textContent = parent ? `回复 @${parent.nickname}` : comment.nickname;
    if (website && author instanceof HTMLAnchorElement) {
      author.href = website;
      author.target = "_blank";
      author.rel = "nofollow noopener noreferrer";
    }
    const time = document.createElement("time");
    time.dateTime = comment.createdAt;
    time.textContent = formatLocalTime(comment.createdAt);
    meta.append(author, time);

    const content = document.createElement("p");
    content.className = "yc-content";
    content.textContent = comment.content;

    const actions = document.createElement("div");
    actions.className = "yc-actions";
    const replyButton = document.createElement("button");
    replyButton.type = "button";
    replyButton.textContent = "回复";
    replyButton.addEventListener("click", () => {
      setReplyTarget(root, { id: comment.id, nickname: comment.nickname });
    });
    actions.append(replyButton);

    const replies = document.createElement("div");
    replies.className = "yc-replies";
    article.append(meta, content, actions, replies);
    return article;
  }

  async function loadComments(root) {
    const { list } = getElements(root);
    if (!list) return;
    const pageKey = root.dataset.pageKey || window.location.pathname;
    const { apiBase } = resolveConfig(root);
    renderState(list, "正在加载评论...");

    try {
      const response = await fetch(
        `${apiBase}/api/comments?path=${encodeURIComponent(pageKey)}`,
        { headers: { Accept: "application/json" } },
      );
      const data = await response.json();
      if (!response.ok || !data.ok || !Array.isArray(data.comments)) {
        throw new Error("评论加载失败");
      }
      renderComments(root, data.comments);
    } catch {
      renderState(list, "评论加载失败。");
    }
  }

  function resetTurnstile(root) {
    root.__yuuCommentsTurnstileToken = "";
    if (root.__yuuCommentsTurnstileWidgetId && window.turnstile) {
      window.turnstile.reset(root.__yuuCommentsTurnstileWidgetId);
    }
  }

  async function setupTurnstile(root) {
    const { turnstileSlot, feedback, submitButton } = getElements(root);
    if (!turnstileSlot || !feedback || !submitButton) return;
    const { siteKey } = resolveConfig(root);
    if (!siteKey) {
      feedback.textContent = "缺少 Turnstile site key。";
      submitButton.disabled = true;
      return;
    }

    turnstileSlot.hidden = false;
    try {
      const turnstile = await loadTurnstileScript();
      root.__yuuCommentsTurnstileWidgetId = turnstile.render(turnstileSlot, {
        sitekey: siteKey,
        callback: (token) => {
          root.__yuuCommentsTurnstileToken = token;
          if (feedback.textContent === "请先完成人机验证。") {
            feedback.textContent = "";
          }
        },
        "expired-callback": () => {
          root.__yuuCommentsTurnstileToken = "";
        },
        "error-callback": () => {
          root.__yuuCommentsTurnstileToken = "";
          feedback.textContent = "验证组件加载失败。";
        },
      });
    } catch {
      feedback.textContent = "验证组件加载失败。";
      submitButton.disabled = true;
    }
  }

  function setupForm(root) {
    const { form, feedback, submitButton, cancelReplyButton } = getElements(root);
    if (!form || !feedback || !submitButton) return;

    cancelReplyButton?.addEventListener("click", () => setReplyTarget(root, null));
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      feedback.textContent = "";
      const formData = new FormData(form);
      const nickname = String(formData.get("nickname") ?? "").trim();
      const email = String(formData.get("email") ?? "").trim();
      const website = String(formData.get("website") ?? "").trim();
      const content = String(formData.get("content") ?? "").trim();

      if (!nickname || !content) {
        feedback.textContent = "昵称和评论内容不能为空。";
        return;
      }
      if (!isHttpWebsite(website)) {
        feedback.textContent = "网站必须以 http:// 或 https:// 开头。";
        return;
      }
      if (!root.__yuuCommentsTurnstileToken) {
        feedback.textContent = "请先完成人机验证。";
        return;
      }

      submitButton.disabled = true;
      submitButton.textContent = "提交中...";
      try {
        const { apiBase } = resolveConfig(root);
        const response = await fetch(`${apiBase}/api/comments`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            pagePath: root.dataset.pageKey || window.location.pathname,
            parentId: root.__yuuCommentsReplyTarget?.id ?? null,
            nickname,
            email,
            website,
            content,
            turnstileToken: root.__yuuCommentsTurnstileToken,
          }),
        });
        const data = await response.json();
        if (!response.ok || !data.ok) {
          feedback.textContent = data.message || "评论提交失败。";
          return;
        }
        feedback.textContent = "评论已提交。";
        form.elements.content.value = "";
        setReplyTarget(root, null);
        await loadComments(root);
      } catch {
        feedback.textContent = "评论提交失败。";
      } finally {
        resetTurnstile(root);
        submitButton.disabled = false;
        submitButton.textContent = "提交";
      }
    });
  }

  function setReplyTarget(root, target) {
    const { formTitle, cancelReplyButton, form } = getElements(root);
    root.__yuuCommentsReplyTarget = target;
    if (formTitle) {
      formTitle.textContent = target
        ? `回复 @${target.nickname}`
        : "发表评论";
    }
    if (cancelReplyButton) cancelReplyButton.hidden = !target;
    if (target) form?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function init() {
    const root = document.querySelector(ROOT_SELECTOR);
    if (!root || root.dataset.yuuCommentsReady === "true") return;
    root.dataset.yuuCommentsReady = "true";
    const { apiBase, siteKey } = resolveConfig(root);
    if (!apiBase || !siteKey) {
      renderConfigurationError(root);
      return;
    }
    createMarkup(root);
    setupForm(root);
    void setupTurnstile(root);
    void loadComments(root);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
