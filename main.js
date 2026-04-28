import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://qpxkawjilyuibecnyoim.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_2dJPlMT5KmWCy-H140djow_9sTHL0Hj";

const supabaseConfigured =
  SUPABASE_ANON_KEY !== "YOUR_ANON_PUBLIC_KEY" &&
  SUPABASE_ANON_KEY !== "YOUR_SUPABASE_ANON_KEY";

const supabase = supabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

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

let selectedTime = "";
let bookedHours = [];

initializeBooking();

function initializeBooking() {
  const today = getLocalDateString(new Date());
  dateInput.min = today;
  dateInput.value = today;

  dateInput.addEventListener("change", handleDateChange);
  bookingForm.addEventListener("submit", handleBooking);

  if (!supabaseConfigured) {
    showFormFeedback(
      "Добавете Вашия Supabase anon public key в main.js, за да активирате реалното записване.",
      "error"
    );
  }

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

async function fetchBookedHours(date) {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("appointments")
    .select("appointment_time")
    .eq("appointment_date", date);

  if (error) {
    throw error;
  }

  return (data ?? []).map((item) => item.appointment_time);
}

async function renderHours(date) {
  const businessHours = getBusinessHours(date);
  hoursGrid.innerHTML = "";

  if (!businessHours) {
    hoursNote.textContent = "Неделя";
    setHoursMessage("В неделя кабинетът не работи.");
    return;
  }

  hoursNote.textContent = `${businessHours.start} – ${businessHours.end}`;
  setHoursLoading(true);
  setHoursMessage("Зареждане на свободните часове...");

  try {
    bookedHours = await fetchBookedHours(date);
    const timeSlots = buildSlots(businessHours.start, businessHours.end);

    if (!timeSlots.length) {
      setHoursMessage("Няма налични часове за тази дата.");
      return;
    }

    const fragment = document.createDocumentFragment();

    timeSlots.forEach((time) => {
      const isBooked = bookedHours.includes(time);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "hour-button";
      button.textContent = `${time}ч.`;
      button.dataset.time = time;
      button.disabled = isBooked;

      if (isBooked) {
        button.classList.add("is-disabled");
        button.setAttribute("aria-disabled", "true");
      } else {
        button.addEventListener("click", () => selectHour(time));
      }

      fragment.appendChild(button);
    });

    hoursGrid.appendChild(fragment);
    setHoursMessage(
      bookedHours.length
        ? "Заетите часове са деактивирани."
        : "Всички показани часове в момента са свободни."
    );
  } catch (error) {
    console.error(error);
    setHoursMessage("Възникна проблем при зареждането на часовете. Опитайте отново.", true);
  } finally {
    setHoursLoading(false);
  }
}

function selectHour(time) {
  selectedTime = time;
  selectedTimeInput.value = time;

  document.querySelectorAll(".hour-button").forEach((button) => {
    button.classList.toggle("is-selected", button.dataset.time === time);
  });

  setHoursMessage(`Избраният час е ${time}ч.`);
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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

  if (isPastDate(appointmentDate)) {
    return "Не може да запишете час за минала дата.";
  }

  if (!validateEmail(patientEmail)) {
    return "Моля, въведете валиден имейл адрес.";
  }

  if (!getBusinessHours(appointmentDate)) {
    return "Кабинетът не работи в неделя. Изберете друга дата.";
  }

  return "";
}

async function checkIfSlotTaken(selectedDate, selectedHour) {
  const { data, error } = await supabase
    .from("appointments")
    .select("id")
    .eq("appointment_date", selectedDate)
    .eq("appointment_time", selectedHour)
    .limit(1);

  if (error) {
    throw error;
  }

  return (data ?? []).length > 0;
}

async function handleBooking(event) {
  event.preventDefault();
  clearFormFeedback();

  const validationError = validateForm();
  if (validationError) {
    showFormFeedback(validationError, "error");
    return;
  }

  if (!supabase) {
    showFormFeedback(
      "Supabase не е конфигуриран. Добавете anon public key в main.js, за да активирате системата.",
      "error"
    );
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
    const slotTaken = await checkIfSlotTaken(payload.appointment_date, payload.appointment_time);

    if (slotTaken) {
      showFormFeedback("Този час вече е зает.", "error");
      await renderHours(payload.appointment_date);
      return;
    }

    const { error } = await supabase.from("appointments").insert([payload]);

    if (error) {
      throw error;
    }

    bookingForm.reset();
    dateInput.value = payload.appointment_date;
    selectedTime = "";
    selectedTimeInput.value = "";

    showFormFeedback(
      "Вашият час беше записан успешно. Ще получите потвърждение по имейл.",
      "success"
    );

    await renderHours(payload.appointment_date);
  } catch (error) {
    console.error(error);

    if (error?.code === "23505") {
      showFormFeedback("Този час вече е зает.", "error");
      await renderHours(payload.appointment_date);
      return;
    }

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
