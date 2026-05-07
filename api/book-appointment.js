const {
  isMissingRelationError,
  supabaseInsert,
  supabaseSelect,
} = require("../lib/supabase");
const {
  getBusinessHours,
  isBookableSlot,
  isPastDate,
  isValidDateString,
  isValidTimeString,
} = require("../lib/booking");
const { handleCorsPreflight, setPublicCorsHeaders } = require("../lib/cors");

const NOTIFICATION_EMAIL = process.env.NOTIFICATION_EMAIL || "Sonocare.bg@gmail.com";
const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID;
const EMAILJS_TEMPLATE_ID = process.env.EMAILJS_TEMPLATE_ID;
const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY;
const EMAILJS_PRIVATE_KEY = process.env.EMAILJS_PRIVATE_KEY;

const REQUIRED_FIELDS = [
  "service",
  "patient_name",
  "patient_phone",
  "patient_email",
  "appointment_date",
  "appointment_time",
];

module.exports = async (request, response) => {
  if (handleCorsPreflight(request, response)) {
    return;
  }

  setPublicCorsHeaders(response);

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed" });
  }

  response.setHeader("Cache-Control", "no-store");

  try {
    const payload = normalizePayload(request.body);
    const validationError = validatePayload(payload);

    if (validationError) {
      return response.status(400).json({ error: validationError, code: "VALIDATION_ERROR" });
    }

    const [blockedDay, blockedHour, slotTaken] = await Promise.all([
      isBlockedDay(payload.appointment_date),
      isBlockedHour(payload.appointment_date, payload.appointment_time),
      checkIfSlotTaken(payload.appointment_date, payload.appointment_time),
    ]);

    if (blockedDay) {
      return response.status(409).json({
        error: "Тази дата не е налична за записване.",
        code: "DAY_BLOCKED",
      });
    }

    if (blockedHour) {
      return response.status(409).json({
        error: "Този час не е наличен за записване.",
        code: "HOUR_BLOCKED",
      });
    }

    if (slotTaken) {
      return response.status(409).json({
        error: "Този час вече е зает.",
        code: "SLOT_TAKEN",
      });
    }

    const insertedAppointment = await insertAppointment(payload);
    const emailSent = await sendNotificationEmail(payload).catch(() => false);

    return response.status(200).json({
      success: true,
      emailSent,
      appointment: insertedAppointment,
    });
  } catch (error) {
    console.error("book-appointment error", error);

    if (error?.code === "23505") {
      return response.status(409).json({
        error: "Този час вече е зает.",
        code: "SLOT_TAKEN",
      });
    }

    return response.status(500).json({
      error: "Не успяхме да обработим записа. Моля, опитайте отново.",
      code: "BOOKING_ERROR",
    });
  }
};

function normalizePayload(body) {
  return {
    service: String(body?.service ?? "").trim(),
    patient_name: String(body?.patient_name ?? "").trim(),
    patient_phone: String(body?.patient_phone ?? "").trim(),
    patient_email: String(body?.patient_email ?? "").trim(),
    appointment_date: String(body?.appointment_date ?? "").trim(),
    appointment_time: String(body?.appointment_time ?? "").trim(),
    notes: String(body?.notes ?? "").trim(),
    reminder_sent: false,
    review_sent: false,
  };
}

function validatePayload(payload) {
  for (const field of REQUIRED_FIELDS) {
    if (!payload[field]) {
      return "Моля, попълнете всички задължителни полета.";
    }
  }

  const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.patient_email);
  if (!emailIsValid) {
    return "Моля, въведете валиден имейл адрес.";
  }

  const phoneIsValid = /^[+\d][\d\s()-]{7,}$/.test(payload.patient_phone);
  if (!phoneIsValid) {
    return "Моля, въведете валиден телефонен номер.";
  }

  if (!isValidDateString(payload.appointment_date) || isPastDate(payload.appointment_date)) {
    return "Моля, изберете валидна бъдеща дата.";
  }

  if (!isValidTimeString(payload.appointment_time)) {
    return "Моля, изберете валиден час.";
  }

  if (!getBusinessHours(payload.appointment_date)) {
    return "Кабинетът работи от понеделник до петък. Изберете работен ден.";
  }

  if (!isBookableSlot(payload.appointment_date, payload.appointment_time)) {
    return "Избраният час е извън работното време на кабинета.";
  }

  return "";
}

async function isBlockedDay(date) {
  try {
    const days = await supabaseSelect("blocked_days", {
      select: "id",
      date: `eq.${date}`,
      limit: 1,
    });

    return Array.isArray(days) && days.length > 0;
  } catch (error) {
    if (isMissingRelationError(error)) {
      return false;
    }
    throw error;
  }
}

async function checkIfSlotTaken(date, time) {
  const bookings = await supabaseSelect("appointments", {
    select: "id",
    appointment_date: `eq.${date}`,
    appointment_time: `eq.${time}`,
    limit: 1,
  });

  return Array.isArray(bookings) && bookings.length > 0;
}

async function isBlockedHour(date, time) {
  try {
    const blockedHours = await supabaseSelect("blocked_hours", {
      select: "id",
      date: `eq.${date}`,
      time: `eq.${time}`,
      limit: 1,
    });

    return Array.isArray(blockedHours) && blockedHours.length > 0;
  } catch (error) {
    if (isMissingRelationError(error)) {
      return false;
    }
    throw error;
  }
}

async function insertAppointment(payload) {
  const data = await supabaseInsert("appointments", payload);
  return data?.[0] ?? null;
}

async function sendNotificationEmail(payload) {
  if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_PUBLIC_KEY || !EMAILJS_PRIVATE_KEY) {
    return false;
  }

  const emailJsResponse = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      service_id: EMAILJS_SERVICE_ID,
      template_id: EMAILJS_TEMPLATE_ID,
      user_id: EMAILJS_PUBLIC_KEY,
      accessToken: EMAILJS_PRIVATE_KEY,
      template_params: {
        to_email: NOTIFICATION_EMAIL,
        clinic_email: NOTIFICATION_EMAIL,
        patient_name: payload.patient_name,
        patient_phone: payload.patient_phone,
        patient_email: payload.patient_email,
        service: payload.service,
        appointment_date: payload.appointment_date,
        appointment_time: payload.appointment_time,
        notes: payload.notes || "Няма",
      },
    }),
  });

  return emailJsResponse.ok;
}
