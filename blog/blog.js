(function () {
  const API_BASE = getApiBaseUrl();
  const isListPage =
    window.location.pathname === "/blog" ||
    window.location.pathname.endsWith("/blog/") ||
    window.location.pathname.endsWith("/blog/index.html");
  const isPostPage = window.location.pathname.endsWith("/blog/post.html");

  if (isListPage) {
    loadBlogList(API_BASE);
  }

  if (isPostPage) {
    loadSinglePost(API_BASE);
  }
})();

async function loadBlogList(apiBase) {
  const grid = document.querySelector("#blog-posts-grid");
  const feedback = document.querySelector("#blog-feedback");

  feedback.textContent = "Зареждане на статиите...";

  try {
    const result = await fetchJson(`${apiBase}/api/blog-posts`);
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
            ${
              post.image
                ? `<img src="${escapeAttribute(post.image)}" alt="${escapeAttribute(post.title || "Статия")}" loading="lazy" decoding="async" />`
                : ""
            }
            <div class="blog-card-body">
              <span class="blog-card-date">${formatDate(post.created_at)}</span>
              <h2>${escapeHtml(post.title || "")}</h2>
              <p>${escapeHtml(post.excerpt || "")}</p>
              <a class="blog-card-link" href="${buildBlogPostUrl(post)}">Прочети статията</a>
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

async function loadSinglePost(apiBase) {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const slug = params.get("slug");
  const container = document.querySelector("#single-post");
  const feedback = document.querySelector("#blog-feedback");

  if (!id && !slug) {
    feedback.textContent = "Липсва статия за зареждане.";
    return;
  }

  feedback.textContent = "Зареждане на статия...";

  try {
    const result = await fetchJson(`${apiBase}/api/blog-post?${buildPostQuery({ id, slug })}`);
    const post = result.post;

    if (!post) {
      feedback.textContent = "Статията не беше намерена.";
      return;
    }

    const canonicalUrl = `https://www.sonocare.bg${buildBlogPostUrl(post)}`;

    document.title = `${post.title} | SonoCare Blog`;
    upsertMetaTag("name", "description", post.excerpt || "Полезна статия от SonoCare.");
    upsertMetaTag("property", "og:title", `${post.title} | SonoCare Blog`);
    upsertMetaTag("property", "og:description", post.excerpt || "Полезна статия от SonoCare.");
    if (post.image) {
      upsertMetaTag("property", "og:image", post.image);
    }
    upsertCanonicalLink(canonicalUrl);
    renderArticleStructuredData(post, canonicalUrl);

    feedback.textContent = "";
    container.innerHTML = `
      ${post.image ? `<img class="single-post-image" src="${escapeAttribute(post.image)}" alt="${escapeAttribute(post.title || "Статия")}" decoding="async" />` : ""}
      <span class="eyebrow">SonoCare Blog</span>
      <h1>${escapeHtml(post.title || "")}</h1>
      <p class="single-post-meta">${formatDate(post.created_at)}</p>
      <div class="single-post-content">${formatPostContent(post.content || "")}</div>
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

function formatPostContent(value) {
  return String(value || "")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
    .join("");
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("bg-BG", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function upsertMetaTag(attributeName, attributeValue, content) {
  if (!content) return;

  let element = document.head.querySelector(`meta[${attributeName}="${attributeValue}"]`);

  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attributeName, attributeValue);
    document.head.appendChild(element);
  }

  element.setAttribute("content", content);
}

function upsertCanonicalLink(href) {
  let link = document.head.querySelector('link[rel="canonical"]');

  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    document.head.appendChild(link);
  }

  link.setAttribute("href", href);
}

function renderArticleStructuredData(post, url) {
  let script = document.querySelector("#blog-article-structured-data");

  if (!script) {
    script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = "blog-article-structured-data";
    document.body.appendChild(script);
  }

  script.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title || "",
    datePublished: post.created_at || "",
    dateModified: post.created_at || "",
    mainEntityOfPage: url,
    image: post.image ? [post.image] : undefined,
    description: post.excerpt || "",
    author: {
      "@type": "Organization",
      name: "SonoCare",
    },
    publisher: {
      "@type": "Organization",
      name: "SonoCare",
      logo: {
        "@type": "ImageObject",
        url: "https://www.sonocare.bg/logo.png",
      },
    },
  });
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

function buildBlogPostUrl(post) {
  const id = String(post?.id || "").trim();
  const slug = String(post?.slug || "").trim();
  const query = new URLSearchParams();

  if (id) {
    query.set("id", id);
  }

  if (slug) {
    query.set("slug", slug);
  }

  return `/blog/post.html?${query.toString()}`;
}

function buildPostQuery(params) {
  const query = new URLSearchParams();

  if (params?.id) {
    query.set("id", params.id);
  }

  if (params?.slug) {
    query.set("slug", params.slug);
  }

  return query.toString();
}

function getApiBaseUrl() {
  if (window.location.protocol === "file:") {
    return "https://www.sonocare.bg";
  }

  const host = window.location.hostname;
  return !host || host === "127.0.0.1" || host === "localhost" || host === "::1"
    ? "https://www.sonocare.bg"
    : "";
}
