(() => {
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
  let comments = [];
  let reports = [];
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

  function renderViewTabs() {
    viewTabs.replaceChildren();
    [
      { label: "Comments / 评论", value: "comments" },
      { label: "Reports / 举报", value: "reports" },
    ].forEach(({ label, value }) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = activeView === value ? "is-active" : "";
      button.textContent = label;
      button.addEventListener("click", () => {
        activeView = value;
        commentsRoot.hidden = activeView !== "comments";
        reportsRoot.hidden = activeView !== "reports";
        renderViewTabs();
        renderFilters();
        if (activeView === "comments") {
          renderComments();
        } else {
          void loadReports();
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
        <p class="ya-content">${escapeHtml(comment.content)}</p>
        <dl>
          <div><dt>创建时间</dt><dd>${escapeHtml(formatLocalTime(comment.createdAt))}</dd></div>
          <div><dt>邮箱</dt><dd>${escapeHtml(comment.email || "")}</dd></div>
          <div><dt>点赞</dt><dd>${escapeHtml(normalizeLikeCount(comment.likeCount))}</dd></div>
        </dl>
        <footer></footer>
      `;
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
      reportsRoot.innerHTML = `<div class="ya-empty">璇峰厛杈撳叆 ADMIN_TOKEN銆?/div>`;
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
            ? `<p class="ya-content">${escapeHtml(report.message)}</p>`
            : ""
        }
        ${
          comment
            ? `<section class="ya-report-comment">
                <h3>Reported comment / 被举报评论</h3>
                <p class="ya-content">${escapeHtml(comment.content || "")}</p>
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
    showMessage("姝ｅ湪鍔犺浇...");
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
      showMessage("");
      renderFilters();
      renderReports();
    } catch (error) {
      showMessage(
        error instanceof Error ? error.message : "Reports failed to load. / 举报加载失败。",
      );
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
    } else {
      void loadReports();
    }
  });
  searchInput.addEventListener("input", () => {
    if (activeView === "comments") {
      renderComments();
    } else {
      renderReports();
    }
  });
  renderViewTabs();
  void loadComments();
})();
