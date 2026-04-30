const revealItems = document.querySelectorAll(".section-reveal");

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 }
);

revealItems.forEach((item) => revealObserver.observe(item));

const bookingForm = document.querySelector(".booking-form");
const formNote = document.querySelector(".form-note");

if (bookingForm && formNote) {
  bookingForm.addEventListener("submit", (event) => {
    event.preventDefault();
    formNote.textContent = "Благодарим Ви. Ще се свържем с Вас за потвърждение.";
    bookingForm.reset();
  });
}

document.querySelectorAll("img").forEach((image) => {
  image.addEventListener("error", () => {
    image.style.opacity = "0";
  });
});

const topbar = document.querySelector(".topbar");
const menuButton = document.querySelector(".menu-btn");

if (topbar && menuButton) {
  const isServicePage = window.location.pathname.includes("/services/");
  const basePath = isServicePage ? "../" : "";
  const menu = document.createElement("nav");
  menu.className = "site-menu";
  menu.setAttribute("aria-label", "Меню");
  menu.innerHTML = `
    <a href="${basePath}index.html#top">Начало</a>
    <a href="${basePath}index.html#services">Услуги</a>
    <a href="${basePath}doctor.html">Д-р Доленска</a>
    <a href="${basePath}booking.html">Запази час</a>
    <a href="${basePath}blog/">Блог</a>
    <a href="${basePath}index.html#contact">Контакти</a>
  `;
  topbar.insertAdjacentElement("afterend", menu);

  menuButton.setAttribute("aria-expanded", "false");

  const closeMenu = () => {
    menu.classList.remove("is-open");
    menuButton.classList.remove("is-open");
    menuButton.setAttribute("aria-expanded", "false");
  };

  menuButton.addEventListener("click", (event) => {
    event.preventDefault();
    const shouldOpen = !menu.classList.contains("is-open");
    menu.classList.toggle("is-open", shouldOpen);
    menuButton.classList.toggle("is-open", shouldOpen);
    menuButton.setAttribute("aria-expanded", String(shouldOpen));
  });

  menu.addEventListener("click", (event) => {
    if (event.target.closest("a")) closeMenu();
  });

  document.addEventListener("click", (event) => {
    if (!topbar.contains(event.target) && !menu.contains(event.target)) closeMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });
}

document.querySelectorAll(".faq-item").forEach((item) => {
  item.addEventListener("toggle", () => {
    if (!item.open) return;
    document.querySelectorAll(".faq-item[open]").forEach((openItem) => {
      if (openItem !== item) openItem.removeAttribute("open");
    });
  });
});

const homeBlogTrack = document.querySelector("#home-blog-track");

if (homeBlogTrack) {
  loadHomeBlogPosts();
}

async function loadHomeBlogPosts() {
  homeBlogTrack.innerHTML = '<div class="home-blog-status">Зареждане на последните статии...</div>';

  try {
    const response = await fetch("/api/blog-posts", { cache: "no-store" });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result?.error || "Не успяхме да заредим статиите.");
    }

    const posts = Array.isArray(result?.posts) ? result.posts.slice(0, 5) : [];

    if (!posts.length) {
      homeBlogTrack.innerHTML = '<div class="home-blog-status">Скоро тук ще има полезни новини и статии.</div>';
      return;
    }

    homeBlogTrack.innerHTML = posts
      .map(
        (post) => `
          <a class="home-blog-card" href="/blog/post.html?id=${encodeURIComponent(post.id)}">
            ${
              post.image
                ? `<img src="${escapeHtml(post.image)}" alt="${escapeHtml(post.title || "Статия")}" />`
                : '<div class="home-blog-card-placeholder">SonoCare Blog</div>'
            }
            <div class="home-blog-card-body">
              <span>${formatBlogDate(post.created_at)}</span>
              <h3>${escapeHtml(post.title || "")}</h3>
              <p>${escapeHtml(trimBlogText(post.content || "", 110))}</p>
            </div>
          </a>
        `
      )
      .join("");
  } catch (error) {
    console.error(error);
    homeBlogTrack.innerHTML = '<div class="home-blog-status is-error">Не успяхме да заредим последните новини.</div>';
  }
}

function formatBlogDate(value) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("bg-BG", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function trimBlogText(value, limit) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, limit).trim()}...` : text;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}