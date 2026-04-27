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
    <a href="${basePath}index.html#booking">Запази час</a>
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
