(function () {
  const isListPage =
    window.location.pathname === "/blog" ||
    window.location.pathname.endsWith("/blog/") ||
    window.location.pathname.endsWith("/blog/index.html");
  const isPostPage = window.location.pathname.endsWith("/blog/post.html");

  if (isListPage) {
    loadBlogList();
  }

  if (isPostPage) {
    loadSinglePost();
  }
})();

async function loadBlogList() {
  const grid = document.querySelector("#blog-posts-grid");
  const feedback = document.querySelector("#blog-feedback");

  feedback.textContent = "Зареждане на статии...";

  try {
    const result = await fetchJson("/api/blog-posts");
    const posts = result.posts || [];

    if (!posts.length) {
      grid.innerHTML = "";
      feedback.textContent = "Все още няма публикувани статии.";
      return;
    }

    feedback.textContent = "";
    grid.innerHTML = posts
      .map(
        (post) => `
          <article class="blog-card">
            ${post.image ? `<img src="${escapeAttribute(post.image)}" alt="${escapeAttribute(post.title || "Статия")}" />` : ""}
            <div class="blog-card-body">
              <span class="blog-card-date">${formatDate(post.created_at)}</span>
              <h2>${escapeHtml(post.title || "")}</h2>
              <p>${escapeHtml(trimText(post.content || "", 170))}</p>
              <a class="blog-card-link" href="post.html?id=${encodeURIComponent(post.id)}">Прочети статията</a>
            </div>
          </article>
        `
      )
      .join("");
  } catch (error) {
    console.error(error);
    feedback.textContent = "Не успяхме да заредим статиите.";
  }
}

async function loadSinglePost() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const container = document.querySelector("#single-post");
  const feedback = document.querySelector("#blog-feedback");

  if (!id) {
    feedback.textContent = "Липсва статия за зареждане.";
    return;
  }

  feedback.textContent = "Зареждане на статия...";

  try {
    const result = await fetchJson(`/api/blog-post?id=${encodeURIComponent(id)}`);
    const post = result.post;

    if (!post) {
      feedback.textContent = "Статията не беше намерена.";
      return;
    }

    document.title = `SonoCare | ${post.title}`;
    feedback.textContent = "";
    container.innerHTML = `
      ${post.image ? `<img class="single-post-image" src="${escapeAttribute(post.image)}" alt="${escapeAttribute(post.title || "Статия")}" />` : ""}
      <span class="eyebrow">SonoCare Blog</span>
      <h1>${escapeHtml(post.title || "")}</h1>
      <p class="single-post-meta">${formatDate(post.created_at)}</p>
      <div class="single-post-content">${escapeHtml(post.content || "")}</div>
    `;
  } catch (error) {
    console.error(error);
    feedback.textContent = "Не успяхме да заредим статията.";
  }
}

async function fetchJson(url) {
  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error || "Request failed.");
  }

  return data;
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("bg-BG", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function trimText(value, limit) {
  const text = String(value || "");
  return text.length > limit ? `${text.slice(0, limit).trim()}…` : text;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
