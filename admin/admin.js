(() => {
  const COMMENT_RENDER_ASSETS = {
    assetBase: "https://cdn.jsdelivr.net/npm",
    marked: "/marked@12.0.2/marked.min.js",
    dompurify: "/dompurify@3.1.6/dist/purify.min.js",
    katexCss: "/katex@0.16.10/dist/katex.min.css",
    katex: "/katex@0.16.10/dist/katex.min.js",
    katexAutoRender: "/katex@0.16.10/dist/contrib/auto-render.min.js",
  };
  const COMMENT_LINK_REL = "nofollow noopener noreferrer";
  const statuses = ["pending", "approved", "spam", "deleted"];
  const statusLabels = {
    pending: "待审核",
    approved: "已通过",
    spam: "垃圾",
    deleted: "已删除",
  };
  const reportStatuses = ["open", "resolved", "ignored", "all"];
  const reportStatusLabels = {
    open: "Open / 未处理",
    resolved: "Resolved / 已处理",
    ignored: "Ignored / 已忽略",
    all: "All / 全部",
  };
  const reportReasonLabels = {
    spam: "Spam / 垃圾广告",
    abuse: "Abuse / 辱骂攻击",
    harassment: "Harassment / 骚扰",
    privacy: "Privacy violation / 隐私泄露",
    illegal: "Illegal content / 违法内容",
    other: "Other / 其他",
  };
  const storageKey = "yuucomments-admin-token";
  const apiBase = document.body.dataset.apiBase || "";
  const tokenForm = document.querySelector("[data-token-form]");
  const tokenInput = tokenForm.elements.token;
  const searchInput = document.querySelector("[data-search]");
  const filters = document.querySelector("[data-filters]");
  const feedback = document.querySelector("[data-feedback]");
  const viewTabs = document.querySelector("[data-view-tabs]");
  const commentsRoot = document.querySelector("[data-comments]");
  const reportsRoot = document.querySelector("[data-reports]");
  const bansRoot = document.querySelector("[data-bans]");
  const spamBanDialog = document.querySelector("[data-spam-ban-dialog]");
  const spamBanForm = document.querySelector("[data-spam-ban-form]");
  const spamBanFeedback = document.querySelector("[data-spam-ban-feedback]");
  const customReasonField = document.querySelector("[data-custom-reason]");
  let comments = [];
  let reports = [];
  let bans = [];
  let spamBanCommentId = null;
  let activeView = "comments";
  let activeStatus = "";
  let activeReportStatus = "open";

  function formatLocalTime(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
  }

  function getToken() {
    return tokenInput.value.trim() || localStorage.getItem(storageKey) || "";
  }

  function showMessage(message) {
    feedback.textContent = message;
  }

  function shortHash(value) {
    return value ? `${value.slice(0, 12)}...` : "Unavailable";
  }

  function readBoolean(value, fallback) {
    if (value === "true") return true;
    if (value === "false") return false;
    return fallback;
  }

  function resolveCommentRenderConfig() {
    const globalConfig = window.YuuCommentsAdminConfig || window.YuuCommentsConfig || {};
    const assetBase =
      globalConfig.commentRenderAssetBase ||
      globalConfig.assetBase ||
      COMMENT_RENDER_ASSETS.assetBase;
    const assets = globalConfig.commentRenderAssets || {};
    const assetUrl = (key) => {
      const value = assets[key] || COMMENT_RENDER_ASSETS[key];
      return /^https?:\/\//i.test(value) ? value : `${assetBase}${value}`;
    };

    return {
      markdown: readBoolean(document.body.dataset.markdown, globalConfig.markdown !== false),
      math: readBoolean(document.body.dataset.math, globalConfig.math !== false),
      assets: {
        marked: assetUrl("marked"),
        dompurify: assetUrl("dompurify"),
        katexCss: assetUrl("katexCss"),
        katex: assetUrl("katex"),
        katexAutoRender: assetUrl("katexAutoRender"),
      },
    };
  }

  function loadScriptOnce(id, src, isReady) {
    if (isReady()) return Promise.resolve();
    const existingScript = document.querySelector(`script[data-yuucomments-lib="${id}"]`);
    const script = existingScript ?? document.createElement("script");

    if (!window.__yuuCommentsScriptLoaders) window.__yuuCommentsScriptLoaders = {};
    if (window.__yuuCommentsScriptLoaders[id]) {
      return window.__yuuCommentsScriptLoaders[id];
    }

    window.__yuuCommentsScriptLoaders[id] = new Promise((resolve, reject) => {
      script.addEventListener(
        "load",
        () => (isReady() ? resolve() : reject(new Error(`${id} unavailable`))),
        { once: true },
      );
      script.addEventListener(
        "error",
        () => reject(new Error(`${id} failed to load`)),
        { once: true },
      );

      if (!existingScript) {
        script.src = src;
        script.async = true;
        script.defer = true;
        script.dataset.yuucommentsLib = id;
        document.head.append(script);
      }
    });

    return window.__yuuCommentsScriptLoaders[id];
  }

  function loadStyleOnce(id, href) {
    if (document.querySelector(`link[data-yuucomments-lib="${id}"]`)) {
      return;
    }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.yuucommentsLib = id;
    document.head.append(link);
  }

  async function prepareCommentRendering() {
    const config = resolveCommentRenderConfig();
    if (!config.markdown && !config.math) return;

    try {
      const loaders = [];
      if (config.markdown) {
        loaders.push(
          loadScriptOnce("marked", config.assets.marked, () => Boolean(window.marked)),
          loadScriptOnce("dompurify", config.assets.dompurify, () =>
            Boolean(window.DOMPurify),
          ),
        );
      }
      if (config.math) {
        loadStyleOnce("katex-css", config.assets.katexCss);
        loaders.push(
          loadScriptOnce("katex", config.assets.katex, () => Boolean(window.katex)).then(
            () =>
              loadScriptOnce("katex-auto-render", config.assets.katexAutoRender, () =>
                Boolean(window.renderMathInElement),
              ),
          ),
        );
      }
      await Promise.all(loaders);
    } catch (error) {
      console.warn("YuuComments admin renderer dependencies failed to load.", error);
    }
  }

  function escapeUserHtml(value) {
    return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;");
  }

  function sanitizeContentHtml(html) {
    return window.DOMPurify.sanitize(html, {
      ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
      FORBID_TAGS: ["style", "script", "iframe", "object", "embed", "form", "input"],
      FORBID_ATTR: ["style", "onerror", "onload", "onclick"],
    });
  }

  function hardenContentLinks(container) {
    for (const link of container.querySelectorAll("a[href]")) {
      let url;
      try {
        url = new URL(link.getAttribute("href"), window.location.href);
      } catch {
        link.removeAttribute("href");
        continue;
      }
      if (!["http:", "https:", "mailto:"].includes(url.protocol)) {
        link.removeAttribute("href");
        continue;
      }
      link.target = "_blank";
      link.rel = COMMENT_LINK_REL;
    }
  }

  function renderContentMath(container) {
    if (!window.renderMathInElement) return;
    window.renderMathInElement(container, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "\\[", right: "\\]", display: true },
        { left: "\\(", right: "\\)", display: false },
        { left: "$", right: "$", display: false },
      ],
      ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"],
      throwOnError: false,
    });
  }

  function renderAdminContent(container, content) {
    const config = resolveCommentRenderConfig();
    container.classList.add("ya-content");

    if (!config.markdown && !config.math) {
      container.textContent = content;
      return;
    }

    if (config.markdown && window.marked && window.DOMPurify) {
      container.classList.add("ya-markdown");
      try {
        const html = window.marked.parse(escapeUserHtml(content), {
          gfm: true,
          breaks: true,
          headerIds: false,
          mangle: false,
        });
        container.innerHTML = sanitizeContentHtml(html);
        hardenContentLinks(container);
        if (config.math) renderContentMath(container);
      } catch (error) {
        console.warn("YuuComments admin failed to render content.", error);
        container.textContent = content;
      }
      return;
    }

    container.textContent = content;
    if (config.math && window.renderMathInElement) {
      container.classList.add("ya-markdown");
      renderContentMath(container);
    }
  }

  function renderViewTabs() {
    viewTabs.replaceChildren();
    [
      { label: "Comments / 评论", value: "comments" },
      { label: "Reports / 举报", value: "reports" },
      { label: "Bans / 封禁来源", value: "bans" },
    ].forEach(({ label, value }) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = activeView === value ? "is-active" : "";
      button.textContent = label;
      button.addEventListener("click", () => {
        activeView = value;
        commentsRoot.hidden = activeView !== "comments";
        reportsRoot.hidden = activeView !== "reports";
        bansRoot.hidden = activeView !== "bans";
        renderViewTabs();
        renderFilters();
        if (activeView === "comments") {
          renderComments();
        } else if (activeView === "reports") {
          void loadReports();
        } else {
          void loadBans();
        }
      });
      viewTabs.append(button);
    });
  }

  function renderFilters() {
    if (activeView === "reports") {
      renderReportFilters();
      return;
    }
    if (activeView === "bans") {
      filters.replaceChildren();
      return;
    }

    const counts = comments.reduce(
      (acc, comment) => {
        acc.all += 1;
        acc[comment.status] += 1;
        return acc;
      },
      { all: 0, pending: 0, approved: 0, spam: 0, deleted: 0 },
    );
    filters.replaceChildren();
    [{ label: "全部", value: "" }, ...statuses.map((value) => ({ label: statusLabels[value], value }))].forEach(
      ({ label, value }) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = activeStatus === value ? "is-active" : "";
        button.textContent = `${label} ${value ? counts[value] : counts.all}`;
        button.addEventListener("click", () => {
          activeStatus = value;
          renderFilters();
          renderComments();
        });
        filters.append(button);
      },
    );
  }

  function renderReportFilters() {
    filters.replaceChildren();
    reportStatuses.forEach((status) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = activeReportStatus === status ? "is-active" : "";
      button.textContent = reportStatusLabels[status];
      button.addEventListener("click", () => {
        activeReportStatus = status;
        renderReportFilters();
        void loadReports();
      });
      filters.append(button);
    });
  }

  function visibleComments() {
    const query = searchInput.value.trim().toLowerCase();
    return comments.filter((comment) => {
      const matchesStatus = !activeStatus || comment.status === activeStatus;
      const matchesQuery =
        !query ||
        [comment.nickname, comment.content, comment.pagePath]
          .join("\n")
          .toLowerCase()
          .includes(query);
      return matchesStatus && matchesQuery;
    });
  }

  function visibleReports() {
    const query = searchInput.value.trim().toLowerCase();
    return reports.filter((report) => {
      const comment = report.comment;
      return (
        !query ||
        [
          report.reporterEmail,
          report.reason,
          report.message,
          report.status,
          comment?.nickname,
          comment?.content,
          comment?.pagePath,
          comment?.status,
        ]
          .join("\n")
          .toLowerCase()
          .includes(query)
      );
    });
  }

  function renderComments() {
    const visible = visibleComments();
    commentsRoot.replaceChildren();
    if (!getToken()) {
      commentsRoot.innerHTML = `<div class="ya-empty">请先输入 ADMIN_TOKEN。</div>`;
      return;
    }
    if (!visible.length) {
      commentsRoot.innerHTML = `<div class="ya-empty">没有匹配的评论。</div>`;
      return;
    }

    visible.forEach((comment) => {
      const article = document.createElement("article");
      article.className = "ya-card";
      article.innerHTML = `
        <header>
          <div>
            <h2>${escapeHtml(comment.nickname)}</h2>
            <p>${escapeHtml(comment.pagePath)}</p>
          </div>
          <span class="status status-${comment.status}">${statusLabels[comment.status]}</span>
        </header>
        <div class="ya-content" data-comment-content></div>
        <dl>
          <div><dt>创建时间</dt><dd>${escapeHtml(formatLocalTime(comment.createdAt))}</dd></div>
          <div><dt>邮箱</dt><dd>${escapeHtml(comment.email || "")}</dd></div>
          <div><dt>点赞</dt><dd>${escapeHtml(normalizeLikeCount(comment.likeCount))}</dd></div>
          <div><dt>IP hash</dt><dd>${escapeHtml(shortHash(comment.ipHash))}</dd></div>
          <div><dt>Device</dt><dd>${escapeHtml(shortHash(comment.deviceFingerprint))}</dd></div>
        </dl>
        <footer></footer>
      `;
      renderAdminContent(article.querySelector("[data-comment-content]"), comment.content);
      const footer = article.querySelector("footer");
      statuses
        .filter((status) => status !== "deleted")
        .forEach((status) => {
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = statusLabels[status];
          button.disabled = comment.status === status;
          button.addEventListener("click", () => updateStatus(comment.id, status));
          footer.append(button);
        });
      const spamBanButton = document.createElement("button");
      spamBanButton.type = "button";
      spamBanButton.className = "is-danger";
      spamBanButton.textContent = "Mark spam & ban / 标记垃圾并封禁";
      spamBanButton.addEventListener("click", () => spamAndBanComment(comment.id));
      footer.append(spamBanButton);
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "is-danger";
      deleteButton.textContent = "删除";
      deleteButton.addEventListener("click", () => deleteComment(comment.id));
      footer.append(deleteButton);
      commentsRoot.append(article);
    });
  }

  function renderReports() {
    const visible = visibleReports();
    reportsRoot.replaceChildren();
    if (!getToken()) {
      reportsRoot.innerHTML = `<div class="ya-empty">请先输入 ADMIN_TOKEN。</div>`;
      return;
    }
    if (!visible.length) {
      reportsRoot.innerHTML = `<div class="ya-empty">No matching reports. / 没有匹配的举报。</div>`;
      return;
    }

    visible.forEach((report) => {
      const comment = report.comment;
      const article = document.createElement("article");
      article.className = "ya-card ya-report-card";
      article.innerHTML = `
        <header>
          <div>
            <h2>${escapeHtml(report.reporterEmail)}</h2>
            <p>${escapeHtml(reportReasonLabels[report.reason] || report.reason)}</p>
          </div>
          <span class="status status-report-${report.status}">${escapeHtml(reportStatusLabels[report.status] || report.status)}</span>
        </header>
        <dl>
          <div><dt>Reporter email / 举报者邮箱</dt><dd class="ya-email">${escapeHtml(report.reporterEmail)}</dd></div>
          <div><dt>Reported at / 举报时间</dt><dd>${escapeHtml(formatLocalTime(report.createdAt))}</dd></div>
          <div><dt>Status / 状态</dt><dd>${escapeHtml(reportStatusLabels[report.status] || report.status)}</dd></div>
        </dl>
        ${
          report.message
            ? `<div class="ya-content" data-report-message></div>`
            : ""
        }
        ${
          comment
            ? `<section class="ya-report-comment">
                <h3>Reported comment / 被举报评论</h3>
                <div class="ya-content" data-reported-comment-content></div>
                <dl>
                  <div><dt>Author / 作者</dt><dd>${escapeHtml(comment.nickname || "")}</dd></div>
                  <div><dt>Page / 页面</dt><dd>${escapeHtml(comment.pagePath || "")}</dd></div>
                  <div><dt>Comment status / 评论状态</dt><dd>${escapeHtml(comment.status || "")}</dd></div>
                </dl>
              </section>`
            : `<section class="ya-report-comment"><p class="ya-empty">Reported comment no longer exists. / 被举报评论已不存在。</p></section>`
        }
        <footer></footer>
      `;
      const reportMessage = article.querySelector("[data-report-message]");
      if (reportMessage) renderAdminContent(reportMessage, report.message);
      const reportedContent = article.querySelector("[data-reported-comment-content]");
      if (reportedContent) renderAdminContent(reportedContent, comment.content || "");
      const footer = article.querySelector("footer");
      const resolveButton = document.createElement("button");
      resolveButton.type = "button";
      resolveButton.textContent = "Resolve / 标记已处理";
      resolveButton.disabled = report.status === "resolved";
      resolveButton.addEventListener("click", () =>
        updateReportStatus(report.id, "resolved"),
      );
      footer.append(resolveButton);

      const ignoreButton = document.createElement("button");
      ignoreButton.type = "button";
      ignoreButton.textContent = "Ignore / 忽略";
      ignoreButton.disabled = report.status === "ignored";
      ignoreButton.addEventListener("click", () =>
        updateReportStatus(report.id, "ignored"),
      );
      footer.append(ignoreButton);

      if (comment?.id) {
        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "is-danger";
        deleteButton.textContent = "Delete comment / 删除评论";
        deleteButton.addEventListener("click", () =>
          deleteReportedComment(comment.id),
        );
        footer.append(deleteButton);
      }
      reportsRoot.append(article);
    });
  }

  function renderBans() {
    const visible = visibleBans();
    bansRoot.replaceChildren();
    if (!getToken()) {
      bansRoot.innerHTML = `<div class="ya-empty">Please enter ADMIN_TOKEN. / 请先输入 ADMIN_TOKEN。</div>`;
      return;
    }
    if (!visible.length) {
      bansRoot.innerHTML = `<div class="ya-empty">No matching bans. / 没有匹配的封禁来源。</div>`;
      return;
    }

    visible.forEach((ban) => {
      const expired = ban.expiresAt
        ? new Date(ban.expiresAt).getTime() <= Date.now()
        : false;
      const article = document.createElement("article");
      article.className = "ya-card";
      article.innerHTML = `
        <header>
          <div>
            <h2>${ban.type === "ip" ? "IP hash" : "Device fingerprint"}</h2>
            <p>${escapeHtml(shortHash(ban.valueHash))}</p>
          </div>
          <div>
            <span class="status status-ban-${ban.type}">${ban.type === "ip" ? "IP" : "Device"}</span>
            <span class="status status-ban-${expired ? "expired" : "active"}">${expired ? "Expired" : "Active"}</span>
          </div>
        </header>
        <dl>
          <div><dt>Reason</dt><dd>${escapeHtml(ban.reason || "")}</dd></div>
          <div><dt>Created at</dt><dd>${escapeHtml(formatLocalTime(ban.createdAt))}</dd></div>
          <div><dt>Expires at</dt><dd>${ban.expiresAt ? escapeHtml(formatLocalTime(ban.expiresAt)) : "Permanent"}</dd></div>
          <div><dt>Source comment ID</dt><dd>${escapeHtml(ban.sourceCommentId || "Unavailable")}</dd></div>
          <div><dt>Source author</dt><dd>${escapeHtml(ban.sourceCommentAuthor || "Unavailable")}</dd></div>
        </dl>
        ${
          ban.sourceCommentContentPreview
            ? `<div class="ya-content">${escapeHtml(ban.sourceCommentContentPreview)}</div>`
            : ""
        }
        <footer></footer>
      `;
      const unbanButton = document.createElement("button");
      unbanButton.type = "button";
      unbanButton.className = "is-danger";
      unbanButton.textContent = "Unban / 解除封禁";
      unbanButton.addEventListener("click", () => unbanSource(ban.id));
      article.querySelector("footer").append(unbanButton);
      bansRoot.append(article);
    });
  }

  async function loadComments() {
    const token = getToken();
    if (!token) {
      comments = [];
      renderFilters();
      renderComments();
      return;
    }
    showMessage("正在加载...");
    try {
      const response = await fetch(`${apiBase}/api/admin/comments`, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (!response.ok || !data.ok || !Array.isArray(data.comments)) {
        throw new Error(data.message || "评论加载失败。");
      }
      comments = data.comments;
      await prepareCommentRendering();
      showMessage("");
      renderFilters();
      renderComments();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "评论加载失败。");
    }
  }

  async function loadReports() {
    const token = getToken();
    if (!token) {
      reports = [];
      renderFilters();
      renderReports();
      return;
    }
    showMessage("正在加载...");
    try {
      const response = await fetch(
        `${apiBase}/api/admin/reports?status=${encodeURIComponent(activeReportStatus)}`,
        {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );
      const data = await response.json();
      if (!response.ok || !data.ok || !Array.isArray(data.reports)) {
        throw new Error(data.message || "Reports failed to load. / 举报加载失败。");
      }
      reports = data.reports;
      await prepareCommentRendering();
      showMessage("");
      renderFilters();
      renderReports();
    } catch (error) {
      showMessage(
        error instanceof Error ? error.message : "Reports failed to load. / 举报加载失败。",
      );
    }
  }

  async function loadBans() {
    const token = getToken();
    if (!token) {
      bans = [];
      renderFilters();
      renderBans();
      return;
    }
    showMessage("Loading bans... / 正在加载封禁来源...");
    try {
      const response = await fetch(`${apiBase}/api/admin/bans`, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (!response.ok || !data.ok || !Array.isArray(data.bans)) {
        throw new Error(data.message || "Bans failed to load.");
      }
      bans = data.bans;
      showMessage("");
      renderFilters();
      renderBans();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Bans failed to load.");
    }
  }

  async function updateStatus(id, status) {
    const token = getToken();
    try {
      const response = await fetch(
        `${apiBase}/api/admin/comments/${encodeURIComponent(id)}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status }),
        },
      );
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.message || "状态更新失败。");
      }
      comments = comments.map((comment) =>
        comment.id === id ? { ...comment, status } : comment,
      );
      renderFilters();
      renderComments();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "状态更新失败。");
    }
  }

  function spamAndBanComment(id) {
    spamBanCommentId = id;
    spamBanForm.reset();
    spamBanFeedback.textContent = "";
    customReasonField.hidden = true;
    spamBanDialog.showModal();
  }

  async function submitSpamAndBan() {
    if (!spamBanCommentId) return;

    const formData = new FormData(spamBanForm);
    const target = String(formData.get("banTarget") || "device");
    const selectedReason = String(formData.get("banReason") || "Spam");
    const customReason = String(formData.get("customReason") || "").trim();
    const reason =
      selectedReason === "Other" ? customReason || "Other" : selectedReason;
    const submitButton = spamBanForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    spamBanFeedback.textContent = "";

    try {
      const response = await fetch(
        `${apiBase}/api/admin/comments/${encodeURIComponent(spamBanCommentId)}/spam-ban`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({
            banIp: target === "ip" || target === "both",
            banDevice: target === "device" || target === "both",
            reason,
          }),
        },
      );
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.message || "Spam & ban failed.");
      }

      comments = comments.map((comment) =>
        comment.id === spamBanCommentId ? { ...comment, status: "spam" } : comment,
      );
      const skipped = Array.isArray(data.skipped) ? data.skipped : [];
      showMessage(
        skipped.length > 0
          ? `Comment was marked as spam, but some bans were skipped: ${skipped.join(", ")}.`
          : data.message || "Comment marked as spam and source banned.",
      );
      spamBanDialog.close();
      spamBanCommentId = null;
      renderFilters();
      renderComments();
    } catch (error) {
      spamBanFeedback.textContent =
        error instanceof Error ? error.message : "Spam & ban failed.";
    } finally {
      submitButton.disabled = false;
    }
  }

  function visibleBans() {
    const query = searchInput.value.trim().toLowerCase();
    return bans.filter((ban) => {
      return (
        !query ||
        [
          ban.type,
          ban.valueHash,
          ban.reason,
          ban.sourceCommentId,
          ban.sourceCommentAuthor,
          ban.sourceCommentContentPreview,
        ]
          .join("\n")
          .toLowerCase()
          .includes(query)
      );
    });
  }

  async function updateReportStatus(id, status) {
    const token = getToken();
    try {
      const response = await fetch(
        `${apiBase}/api/admin/reports/${encodeURIComponent(id)}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status }),
        },
      );
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.message || "Report status update failed. / 举报状态更新失败。");
      }
      if (activeReportStatus === "all") {
        reports = reports.map((report) =>
          report.id === id ? { ...report, status } : report,
        );
        renderReports();
      } else {
        reports = reports.filter((report) => report.id !== id);
        renderReports();
      }
    } catch (error) {
      showMessage(
        error instanceof Error
          ? error.message
          : "Report status update failed. / 举报状态更新失败。",
      );
    }
  }

  async function unbanSource(id) {
    if (!window.confirm("Unban this source? / 是否解除该来源的封禁？")) {
      return;
    }

    try {
      const response = await fetch(
        `${apiBase}/api/admin/bans/${encodeURIComponent(id)}`,
        {
          method: "DELETE",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${getToken()}`,
          },
        },
      );
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.message || "Unban failed.");
      }
      bans = bans.filter((ban) => ban.id !== id);
      showMessage(data.message || "Source unbanned.");
      renderBans();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Unban failed.");
    }
  }

  async function deleteComment(id) {
    if (!window.confirm("确定要永久删除这条评论吗？此操作不可恢复。")) {
      return;
    }

    const token = getToken();
    try {
      const response = await fetch(
        `${apiBase}/api/admin/comments/${encodeURIComponent(id)}`,
        {
          method: "DELETE",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.message || "评论删除失败。");
      }
      comments = comments.filter((comment) => comment.id !== id);
      showMessage("评论已永久删除。");
      renderFilters();
      renderComments();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "评论删除失败。");
    }
  }

  async function deleteReportedComment(id) {
    if (!window.confirm("Delete this reported comment permanently? / 确定要永久删除这条被举报评论吗？")) {
      return;
    }

    const token = getToken();
    try {
      const response = await fetch(
        `${apiBase}/api/admin/comments/${encodeURIComponent(id)}`,
        {
          method: "DELETE",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.message || "Comment deletion failed. / 评论删除失败。");
      }
      showMessage("Reported comment deleted. / 被举报评论已删除。");
      comments = comments.filter((comment) => comment.id !== id);
      await loadReports();
    } catch (error) {
      showMessage(
        error instanceof Error ? error.message : "Comment deletion failed. / 评论删除失败。",
      );
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeLikeCount(value) {
    const likeCount = Number(value);
    return Number.isFinite(likeCount) && likeCount > 0 ? likeCount : 0;
  }

  tokenInput.value = localStorage.getItem(storageKey) || "";
  tokenForm.addEventListener("submit", (event) => {
    event.preventDefault();
    localStorage.setItem(storageKey, tokenInput.value.trim());
    if (activeView === "comments") {
      void loadComments();
    } else if (activeView === "reports") {
      void loadReports();
    } else {
      void loadBans();
    }
  });
  searchInput.addEventListener("input", () => {
    if (activeView === "comments") {
      renderComments();
    } else if (activeView === "reports") {
      renderReports();
    } else {
      renderBans();
    }
  });
  spamBanForm.addEventListener("change", () => {
    const selectedReason = new FormData(spamBanForm).get("banReason");
    customReasonField.hidden = selectedReason !== "Other";
  });
  spamBanForm.addEventListener("submit", (event) => {
    event.preventDefault();
    void submitSpamAndBan();
  });
  document.querySelector("[data-spam-ban-cancel]").addEventListener("click", () => {
    spamBanDialog.close();
  });
  document.querySelector("[data-spam-ban-close]").addEventListener("click", () => {
    spamBanDialog.close();
  });
  spamBanDialog.addEventListener("close", () => {
    spamBanCommentId = null;
    spamBanFeedback.textContent = "";
  });
  renderViewTabs();
  void loadComments();
})();
