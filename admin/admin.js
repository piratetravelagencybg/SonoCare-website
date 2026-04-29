(function () {
  const isLoginPage =
    window.location.pathname === "/admin" ||
    window.location.pathname.endsWith("/admin/") ||
    window.location.pathname.endsWith("/admin/index.html");
  const isDashboardPage = window.location.pathname.endsWith("/admin/dashboard.html");

  if (isLoginPage) {
    initializeLoginPage();
  }

  if (isDashboardPage) {
    initializeDashboardPage();
  }
})();

async function initializeLoginPage() {
  try {
    const session = await fetchJson("/api/admin-auth");
    if (session.authenticated) {
      window.location.replace("/admin/dashboard.html");
      return;
    }
  } catch {}

  const form = document.querySelector("#admin-login-form");
  const feedback = document.querySelector("#admin-login-feedback");
  const button = document.querySelector("#admin-login-button");

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    feedback.textContent = "";
    feedback.className = "admin-feedback";
    button.disabled = true;
    button.textContent = "Влизане...";

    try {
      const result = await fetchJson("/api/admin-auth", {
        method: "POST",
        body: {
          email: document.querySelector("#admin-email").value.trim(),
          password: document.querySelector("#admin-password").value,
        },
      });

      window.location.replace(result.redirectTo || "/admin/dashboard.html");
    } catch (error) {
      feedback.textContent = error.message || "Неуспешен вход.";
      feedback.className = "admin-feedback is-error";
    } finally {
      button.disabled = false;
      button.textContent = "Вход";
    }
  });
}

async function initializeDashboardPage() {
  let session;

  try {
    session = await fetchJson("/api/admin-auth");
  } catch {
    window.location.replace("/admin/index.html");
    return;
  }

  if (!session.authenticated) {
    window.location.replace("/admin/index.html");
    return;
  }

  document.querySelector("#admin-user-email").textContent = session.user?.email || "Администратор";
  document.querySelector("#blog-date").value = getToday();

  bindDashboardNavigation();
  activateSectionFromHash();
  window.addEventListener("hashchange", activateSectionFromHash);
  bindLogout();
  bindBlockForms();
  bindBlogForm();

  await Promise.all([
    loadOverview(),
    loadAppointments(),
    loadBlockedDays(),
    loadBlockedHours(),
    loadBlogPosts(),
  ]);
}

function bindDashboardNavigation() {
  const navButtons = Array.from(document.querySelectorAll(".admin-nav-link"));

  navButtons.forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      const targetId = button.dataset.target;
      setActiveSection(targetId);
      window.location.hash = targetId;
    });
  });
}

function activateSectionFromHash() {
  const targetId = window.location.hash.replace("#", "") || "overview-section";
  setActiveSection(targetId);
}

function setActiveSection(targetId) {
  const navButtons = Array.from(document.querySelectorAll(".admin-nav-link"));
  const sections = Array.from(document.querySelectorAll(".admin-section"));
  const hasTarget = sections.some((section) => section.id === targetId);
  const safeTargetId = hasTarget ? targetId : "overview-section";

  navButtons.forEach((item) =>
    item.classList.toggle("is-active", item.dataset.target === safeTargetId)
  );

  sections.forEach((section) =>
    section.classList.toggle("is-active", section.id === safeTargetId)
  );
}

function bindLogout() {
  const button = document.querySelector("#admin-logout-button");

  button?.addEventListener("click", async () => {
    await fetchJson("/api/admin-auth", { method: "DELETE" }).catch(() => null);
    window.location.replace("/admin/index.html");
  });
}

function bindBlockForms() {
  document.querySelector("#block-day-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const date = document.querySelector("#block-day-date").value;
    if (!date) return;

    try {
      await fetchJson("/api/admin-blocked-days", {
        method: "POST",
        body: { date },
      });

      event.currentTarget.reset();
      await Promise.all([loadBlockedDays(), loadOverview()]);
    } catch (error) {
      alert(error.message || "Не успяхме да блокираме деня.");
    }
  });

  document.querySelector("#block-hour-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const date = document.querySelector("#block-hour-date").value;
    const time = document.querySelector("#block-hour-time").value;
    if (!date || !time) return;

    try {
      await fetchJson("/api/admin-blocked-hours", {
        method: "POST",
        body: { date, time },
      });

      event.currentTarget.reset();
      await loadBlockedHours();
    } catch (error) {
      alert(error.message || "Не успяхме да блокираме часа.");
    }
  });
}

function bindBlogForm() {
  const form = document.querySelector("#blog-form");
  const resetButton = document.querySelector("#blog-reset-button");

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const postId = document.querySelector("#blog-post-id").value;
    const feedback = document.querySelector("#blog-form-feedback");
    const submitButton = document.querySelector("#blog-submit-button");

    feedback.textContent = "";
    feedback.className = "admin-feedback";
    submitButton.disabled = true;
    submitButton.textContent = postId ? "Запазване..." : "Публикуване...";

    const payload = {
      title: document.querySelector("#blog-title").value.trim(),
      content: document.querySelector("#blog-content").value.trim(),
      image: document.querySelector("#blog-image").value.trim(),
      created_at: normalizeDateForDatabase(document.querySelector("#blog-date").value),
    };

    try {
      if (postId) {
        await fetchJson(`/api/admin-blog-post?id=${encodeURIComponent(postId)}`, {
          method: "PUT",
          body: payload,
        });
      } else {
        await fetchJson("/api/admin-blog-posts", {
          method: "POST",
          body: payload,
        });
      }

      feedback.textContent = postId ? "Статията е обновена." : "Статията е публикувана.";
      feedback.className = "admin-feedback is-success";
      resetBlogForm();
      await Promise.all([loadBlogPosts(), loadOverview()]);
    } catch (error) {
      feedback.textContent = error.message || "Не успяхме да запазим статията.";
      feedback.className = "admin-feedback is-error";
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = postId ? "Запази промените" : "Публикувай";
    }
  });

  resetButton?.addEventListener("click", resetBlogForm);
}

async function loadOverview() {
  const result = await fetchJson("/api/admin-overview");
  document.querySelector("#overview-appointments-count").textContent = result.appointmentsCount || 0;
  document.querySelector("#overview-posts-count").textContent = result.blogPostsCount || 0;

  renderSimpleList(
    document.querySelector("#overview-latest-appointments"),
    result.latestAppointments,
    (appointment) => `
      <div class="admin-list-item">
        <strong>${escapeHtml(appointment.patient_name || "Пациент")}</strong>
        <span>${formatDate(appointment.appointment_date)} • ${escapeHtml(appointment.appointment_time || "")}</span>
        <p>${escapeHtml(appointment.service || "")}</p>
      </div>
    `,
    "Все още няма записвания."
  );

  renderSimpleList(
    document.querySelector("#overview-latest-posts"),
    result.latestPosts,
    (post) => `
      <div class="admin-list-item">
        <strong>${escapeHtml(post.title || "Статия")}</strong>
        <span>${formatDateTime(post.created_at)}</span>
      </div>
    `,
    "Все още няма статии."
  );
}

async function loadAppointments() {
  const result = await fetchJson("/api/admin-appointments");
  const container = document.querySelector("#admin-appointments-list");

  renderSimpleList(
    container,
    result.appointments,
    (appointment) => `
      <article class="admin-list-item">
        <div class="admin-list-item-header">
          <div>
            <strong>${escapeHtml(appointment.patient_name || "")}</strong>
            <p>${escapeHtml(appointment.patient_phone || "")} • ${escapeHtml(appointment.patient_email || "")}</p>
          </div>
          <div class="admin-list-actions">
            <button class="admin-inline-button is-delete" type="button" data-appointment-delete="${appointment.id}">Изтрий</button>
          </div>
        </div>
        <span>${escapeHtml(appointment.service || "")}</span>
        <p>${formatDate(appointment.appointment_date)} • ${escapeHtml(appointment.appointment_time || "")}</p>
      </article>
    `,
    "Все още няма записани часове."
  );

  container.querySelectorAll("[data-appointment-delete]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!confirm("Сигурни ли сте, че искате да изтриете това записване?")) return;

      try {
        await fetchJson(`/api/admin-appointments?id=${encodeURIComponent(button.dataset.appointmentDelete)}`, {
          method: "DELETE",
        });

        await Promise.all([loadAppointments(), loadOverview()]);
      } catch (error) {
        alert(error.message || "Не успяхме да изтрием записването.");
      }
    });
  });
}

async function loadBlockedDays() {
  const result = await fetchJson("/api/admin-blocked-days");
  const container = document.querySelector("#blocked-days-list");

  renderSimpleList(
    container,
    result.blockedDays,
    (item) => `
      <article class="admin-list-item">
        <div class="admin-list-item-header">
          <strong>${formatDate(item.date)}</strong>
          <div class="admin-list-actions">
            <button class="admin-inline-button is-delete" type="button" data-blocked-day-delete="${item.id}">Премахни</button>
          </div>
        </div>
      </article>
    `,
    "Няма блокирани дни."
  );

  container.querySelectorAll("[data-blocked-day-delete]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await fetchJson(`/api/admin-blocked-days?id=${encodeURIComponent(button.dataset.blockedDayDelete)}`, {
          method: "DELETE",
        });
        await loadBlockedDays();
      } catch (error) {
        alert(error.message || "Не успяхме да премахнем блокирания ден.");
      }
    });
  });
}

async function loadBlockedHours() {
  const result = await fetchJson("/api/admin-blocked-hours");
  const container = document.querySelector("#blocked-hours-list");

  renderSimpleList(
    container,
    result.blockedHours,
    (item) => `
      <article class="admin-list-item">
        <div class="admin-list-item-header">
          <div>
            <strong>${formatDate(item.date)}</strong>
            <p>${escapeHtml(item.time || "")}</p>
          </div>
          <div class="admin-list-actions">
            <button class="admin-inline-button is-delete" type="button" data-blocked-hour-delete="${item.id}">Премахни</button>
          </div>
        </div>
      </article>
    `,
    "Няма блокирани часове."
  );

  container.querySelectorAll("[data-blocked-hour-delete]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await fetchJson(`/api/admin-blocked-hours?id=${encodeURIComponent(button.dataset.blockedHourDelete)}`, {
          method: "DELETE",
        });
        await loadBlockedHours();
      } catch (error) {
        alert(error.message || "Не успяхме да премахнем блокирания час.");
      }
    });
  });
}

async function loadBlogPosts() {
  const result = await fetchJson("/api/admin-blog-posts");
  const container = document.querySelector("#admin-posts-list");

  renderSimpleList(
    container,
    result.posts,
    (post) => `
      <article class="admin-list-item">
        ${post.image ? `<img class="admin-post-preview" src="${escapeAttribute(post.image)}" alt="${escapeAttribute(post.title || "Статия")}" />` : ""}
        <div class="admin-list-item-header">
          <div>
            <strong>${escapeHtml(post.title || "")}</strong>
            <p>${formatDateTime(post.created_at)}</p>
          </div>
          <div class="admin-list-actions">
            <button class="admin-inline-button is-edit" type="button" data-post-edit="${post.id}">Редакция</button>
            <button class="admin-inline-button is-delete" type="button" data-post-delete="${post.id}">Изтрий</button>
          </div>
        </div>
        <p>${escapeHtml(trimText(post.content || "", 180))}</p>
      </article>
    `,
    "Все още няма публикувани статии."
  );

  container.querySelectorAll("[data-post-edit]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        const result = await fetchJson(`/api/admin-blog-post?id=${encodeURIComponent(button.dataset.postEdit)}`);
        populateBlogForm(result.post);
        document.querySelector('[data-target="blog-section"]')?.click();
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (error) {
        alert(error.message || "Не успяхме да заредим статията за редакция.");
      }
    });
  });

  container.querySelectorAll("[data-post-delete]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!confirm("Сигурни ли сте, че искате да изтриете тази статия?")) return;

      try {
        await fetchJson(`/api/admin-blog-post?id=${encodeURIComponent(button.dataset.postDelete)}`, {
          method: "DELETE",
        });

        await Promise.all([loadBlogPosts(), loadOverview()]);
      } catch (error) {
        alert(error.message || "Не успяхме да изтрием статията.");
      }
    });
  });
}

function populateBlogForm(post) {
  document.querySelector("#blog-post-id").value = post?.id || "";
  document.querySelector("#blog-title").value = post?.title || "";
  document.querySelector("#blog-content").value = post?.content || "";
  document.querySelector("#blog-image").value = post?.image || "";
  document.querySelector("#blog-date").value = post?.created_at ? post.created_at.slice(0, 10) : getToday();
  document.querySelector("#blog-form-title").textContent = "Редакция на статия";
  document.querySelector("#blog-submit-button").textContent = "Запази промените";
  document.querySelector("#blog-reset-button").hidden = false;
}

function resetBlogForm() {
  document.querySelector("#blog-form").reset();
  document.querySelector("#blog-post-id").value = "";
  document.querySelector("#blog-form-title").textContent = "Нова статия";
  document.querySelector("#blog-submit-button").textContent = "Публикувай";
  document.querySelector("#blog-reset-button").hidden = true;
  document.querySelector("#blog-form-feedback").textContent = "";
  document.querySelector("#blog-form-feedback").className = "admin-feedback";
  document.querySelector("#blog-date").value = getToday();
}

function renderSimpleList(container, items, itemRenderer, emptyText) {
  if (!container) return;

  if (!items || !items.length) {
    container.innerHTML = `<div class="admin-list-empty">${escapeHtml(emptyText)}</div>`;
    return;
  }

  container.innerHTML = items.map(itemRenderer).join("");
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data?.error || "Request failed.");
    error.code = data?.code;
    throw error;
  }

  return data;
}

function normalizeDateForDatabase(value) {
  if (!value) return "";
  return new Date(`${value}T09:00:00`).toISOString();
}

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("bg-BG", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function formatDateTime(value) {
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
