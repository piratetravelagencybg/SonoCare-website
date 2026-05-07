const BUSINESS_HOURS = {
  weekday: { start: "16:00", end: "18:00" },
};

const serviceInput = document.querySelector("#service");
const dateInput = document.querySelector("#appointment-date");
const hoursGrid = document.querySelector("#hours-grid");
const hoursLoading = document.querySelector("#hours-loading");
const hoursMessage = document.querySelector("#hours-message");
const hoursNote = document.querySelector("#working-hours-note");
const bookingForm = document.querySelector("#booking-form");
const selectedTimeInput = document.querySelector("#selected-time");
const submitButton = document.querySelector("#submit-button");
const feedback = document.querySelector("#form-feedback");
const API_BASE = getApiBaseUrl();

let selectedTime = "";
let bookedHours = [];
let blockedHours = [];
let selectedDayBlocked = false;
let availabilityRequestController = null;
let latestAvailabilityRequest = 0;

const availabilityCache = new Map();

initializeBooking();

function initializeBooking() {
  const today = getLocalDateString(new Date());
  dateInput.min = today;
  dateInput.value = today;

  dateInput.addEventListener("change", handleDateChange);
  bookingForm.addEventListener("submit", handleBooking);

  handleDateChange();
}

function getLocalDateString(date) {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60000);
  return localDate.toISOString().slice(0, 10);
}

function isPastDate(dateString) {
  return dateString < getLocalDateString(new Date());
}

function getBusinessHours(dateString) {
  const day = new Date(`${dateString}T12:00:00`).getDay();

  if (day >= 1 && day <= 5) {
    return BUSINESS_HOURS.weekday;
  }

  return null;
}

function buildSlots(start, end) {
  const slots = [];
  let [hours, minutes] = start.split(":").map(Number);
  const [endHours, endMinutes] = end.split(":").map(Number);

  while (hours < endHours || (hours === endHours && minutes <= endMinutes - 30)) {
    const label = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    slots.push(label);
    minutes += 30;

    if (minutes === 60) {
      hours += 1;
      minutes = 0;
    }
  }

  return slots;
}

async function handleDateChange() {
  const selectedDate = dateInput.value;
  selectedTime = "";
  selectedTimeInput.value = "";
  selectedDayBlocked = false;
  clearFormFeedback();

  if (!selectedDate) {
    hoursGrid.innerHTML = "";
    setHoursMessage("Изберете дата, за да видите свободните часове.");
    hoursNote.textContent = "Първо изберете дата";
    return;
  }

  if (isPastDate(selectedDate)) {
    hoursGrid.innerHTML = "";
    setHoursMessage("Не може да изберете минала дата.", true);
    hoursNote.textContent = "Невалидна дата";
    return;
  }

  await renderHours(selectedDate);
}

async function fetchAvailability(date, signal) {
  if (availabilityCache.has(date)) {
    return availabilityCache.get(date);
  }

  const response = await fetch(`${API_BASE}/api/booking-availability?date=${encodeURIComponent(date)}`, {
    cache: "no-store",
    signal,
  });
  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result?.error || "Availability request failed");
  }

  const data = {
    blockedDay: Boolean(result?.blockedDay),
    blockedHours: Array.isArray(result?.blockedHours) ? result.blockedHours : [],
    bookedHours: Array.isArray(result?.bookedHours) ? result.bookedHours : [],
  };

  availabilityCache.set(date, data);
  return data;
}

async function renderHours(date) {
  const businessHours = getBusinessHours(date);
  const requestId = ++latestAvailabilityRequest;

  if (availabilityRequestController) {
    availabilityRequestController.abort();
  }

  availabilityRequestController = new AbortController();
  hoursGrid.innerHTML = "";
  bookedHours = [];
  blockedHours = [];

  if (!businessHours) {
    hoursNote.textContent = "Почивни дни";
    setHoursMessage("Събота и неделя кабинетът не работи.");
    return;
  }

  hoursNote.textContent = `${businessHours.start} – ${businessHours.end}`;
  setHoursLoading(true);
  setHoursMessage("Зареждане на свободните часове...");

  try {
    const availability = await fetchAvailability(date, availabilityRequestController.signal);

    if (requestId !== latestAvailabilityRequest) {
      return;
    }

    bookedHours = availability.bookedHours;
    blockedHours = availability.blockedHours;
    selectedDayBlocked = availability.blockedDay;

    if (selectedDayBlocked) {
      hoursGrid.innerHTML = "";
      hoursNote.textContent = "Денят е блокиран";
      setHoursMessage("Тази дата е блокирана и не приема записвания.", true);
      return;
    }

    const timeSlots = buildSlots(businessHours.start, businessHours.end);

    if (!timeSlots.length) {
      setHoursMessage("Няма налични часове за тази дата.");
      return;
    }

    const fragment = document.createDocumentFragment();

    timeSlots.forEach((time) => {
      const isUnavailable = bookedHours.includes(time) || blockedHours.includes(time);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "hour-button";
      button.textContent = `${time}ч.`;
      button.dataset.time = time;
      button.disabled = isUnavailable;
      button.setAttribute("aria-pressed", "false");

      if (isUnavailable) {
        button.classList.add("is-disabled");
        button.setAttribute("aria-disabled", "true");
      } else {
        button.addEventListener("click", () => selectHour(time));
      }

      fragment.appendChild(button);
    });

    hoursGrid.appendChild(fragment);

    if (bookedHours.length || blockedHours.length) {
      setHoursMessage("Заетите и блокираните часове са деактивирани.");
    } else {
      setHoursMessage("Всички показани часове в момента са свободни.");
    }
  } catch (error) {
    if (error.name === "AbortError") {
      return;
    }

    console.error(error);
    setHoursMessage("Възникна проблем при зареждането на часовете. Опитайте отново.", true);
  } finally {
    if (requestId === latestAvailabilityRequest) {
      setHoursLoading(false);
    }
  }
}

function selectHour(time) {
  selectedTime = time;
  selectedTimeInput.value = time;

  document.querySelectorAll(".hour-button").forEach((button) => {
    const isSelected = button.dataset.time === time;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });

  setHoursMessage(`Избраният час е ${time}ч.`);
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePhone(phone) {
  return /^[+\d][\d\s()-]{7,}$/.test(phone);
}

function validateForm() {
  const service = serviceInput.value.trim();
  const appointmentDate = dateInput.value;
  const patientName = document.querySelector("#patient-name").value.trim();
  const patientPhone = document.querySelector("#patient-phone").value.trim();
  const patientEmail = document.querySelector("#patient-email").value.trim();

  if (!service || !appointmentDate || !patientName || !patientPhone || !patientEmail) {
    return "Моля, попълнете всички задължителни полета.";
  }

  if (!selectedTime) {
    return "Моля, изберете час за преглед.";
  }

  if (selectedDayBlocked) {
    return "Тази дата е блокирана и не приема записвания.";
  }

  if (blockedHours.includes(selectedTime)) {
    return "Този час не е наличен за записване.";
  }

  if (isPastDate(appointmentDate)) {
    return "Не може да запишете час за минала дата.";
  }

  if (!validatePhone(patientPhone)) {
    return "Моля, въведете валиден телефонен номер.";
  }

  if (!validateEmail(patientEmail)) {
    return "Моля, въведете валиден имейл адрес.";
  }

  if (!getBusinessHours(appointmentDate)) {
    return "Събота и неделя кабинетът не работи. Изберете дата от понеделник до петък.";
  }

  return "";
}

async function handleBooking(event) {
  event.preventDefault();
  clearFormFeedback();

  const validationError = validateForm();
  if (validationError) {
    showFormFeedback(validationError, "error");
    return;
  }

  const payload = {
    service: serviceInput.value.trim(),
    patient_name: document.querySelector("#patient-name").value.trim(),
    patient_phone: document.querySelector("#patient-phone").value.trim(),
    patient_email: document.querySelector("#patient-email").value.trim(),
    appointment_date: dateInput.value,
    appointment_time: selectedTime,
    notes: document.querySelector("#notes").value.trim(),
    reminder_sent: false,
    review_sent: false,
  };

  setSubmitting(true);

  try {
    const bookingResponse = await fetch(`${API_BASE}/api/book-appointment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await bookingResponse.json().catch(() => ({}));

    if (!bookingResponse.ok) {
      if (
        bookingResponse.status === 409 &&
        ["SLOT_TAKEN", "DAY_BLOCKED", "HOUR_BLOCKED"].includes(result?.code)
      ) {
        showFormFeedback(result?.error || "Този час вече не е наличен.", "error");
        availabilityCache.delete(payload.appointment_date);
        await renderHours(payload.appointment_date);
        return;
      }

      throw new Error(result?.error || "Booking request failed");
    }

    bookingForm.reset();
    dateInput.value = payload.appointment_date;
    selectedTime = "";
    selectedTimeInput.value = "";

    const notificationSent = Boolean(result?.emailSent);

    showFormFeedback(
      notificationSent
        ? "Вашият час беше записан успешно. Ще получите потвърждение по имейл."
        : "Вашият час беше записан успешно. Заявката е запазена в системата.",
      "success"
    );

    availabilityCache.delete(payload.appointment_date);
    await renderHours(payload.appointment_date);
  } catch (error) {
    console.error(error);
    showFormFeedback(
      "Възникна проблем при записването. Моля, опитайте отново след малко.",
      "error"
    );
  } finally {
    setSubmitting(false);
  }
}

function setSubmitting(isSubmitting) {
  submitButton.disabled = isSubmitting;
  submitButton.querySelector("span").textContent = isSubmitting ? "Записване..." : "Запази час";
}

function setHoursLoading(isLoading) {
  hoursLoading.hidden = !isLoading;
  hoursGrid.setAttribute("aria-busy", String(isLoading));
}

function setHoursMessage(message, isError = false) {
  hoursMessage.textContent = message;
  hoursMessage.classList.toggle("is-error", isError);
}

function showFormFeedback(message, type) {
  feedback.textContent = message;
  feedback.className = `form-feedback is-visible is-${type}`;
}

function clearFormFeedback() {
  feedback.textContent = "";
  feedback.className = "form-feedback";
}

function getApiBaseUrl() {
  const host = window.location.hostname;
  return host === "127.0.0.1" || host === "localhost" || host === "::1"
    ? "https://www.sonocare.bg"
    : "";
}

