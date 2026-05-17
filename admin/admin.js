(() => {
  const statuses = ["pending", "approved", "spam", "deleted"];
  const storageKey = "yuucomments-admin-token";
  const apiBase = document.body.dataset.apiBase || "";
  const tokenForm = document.querySelector("[data-token-form]");
  const tokenInput = tokenForm.elements.token;
  const searchInput = document.querySelector("[data-search]");
  const filters = document.querySelector("[data-filters]");
  const feedback = document.querySelector("[data-feedback]");
  const commentsRoot = document.querySelector("[data-comments]");
  let comments = [];
  let activeStatus = "";

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

  function renderFilters() {
    const counts = comments.reduce(
      (acc, comment) => {
        acc.all += 1;
        acc[comment.status] += 1;
        return acc;
      },
      { all: 0, pending: 0, approved: 0, spam: 0, deleted: 0 },
    );
    filters.replaceChildren();
    [{ label: "all", value: "" }, ...statuses.map((value) => ({ label: value, value }))].forEach(
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

  function renderComments() {
    const visible = visibleComments();
    commentsRoot.replaceChildren();
    if (!getToken()) {
      commentsRoot.innerHTML = `<div class="ya-empty">Enter ADMIN_TOKEN first.</div>`;
      return;
    }
    if (!visible.length) {
      commentsRoot.innerHTML = `<div class="ya-empty">No matching comments.</div>`;
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
          <span class="status status-${comment.status}">${comment.status}</span>
        </header>
        <p class="ya-content">${escapeHtml(comment.content)}</p>
        <dl>
          <div><dt>Created</dt><dd>${escapeHtml(formatLocalTime(comment.createdAt))}</dd></div>
          <div><dt>Email</dt><dd>${escapeHtml(comment.email || "")}</dd></div>
        </dl>
        <footer></footer>
      `;
      const footer = article.querySelector("footer");
      statuses.forEach((status) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = status;
        button.disabled = comment.status === status;
        button.addEventListener("click", () => updateStatus(comment.id, status));
        footer.append(button);
      });
      commentsRoot.append(article);
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
    showMessage("Loading...");
    try {
      const response = await fetch(`${apiBase}/api/admin/comments`, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (!response.ok || !data.ok || !Array.isArray(data.comments)) {
        throw new Error(data.message || "Failed to load comments.");
      }
      comments = data.comments;
      showMessage("");
      renderFilters();
      renderComments();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Failed to load comments.");
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
        throw new Error(data.message || "Failed to update status.");
      }
      comments = comments.map((comment) =>
        comment.id === id ? { ...comment, status } : comment,
      );
      renderFilters();
      renderComments();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Failed to update status.");
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

  tokenInput.value = localStorage.getItem(storageKey) || "";
  tokenForm.addEventListener("submit", (event) => {
    event.preventDefault();
    localStorage.setItem(storageKey, tokenInput.value.trim());
    void loadComments();
  });
  searchInput.addEventListener("input", renderComments);
  void loadComments();
})();
