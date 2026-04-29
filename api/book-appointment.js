const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
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
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed" });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return response.status(500).json({
      error: "Server configuration is incomplete.",
      code: "CONFIG_ERROR",
    });
  }

  try {
    const payload = normalizePayload(request.body);
    const validationError = validatePayload(payload);

    if (validationError) {
      return response.status(400).json({ error: validationError, code: "VALIDATION_ERROR" });
    }

    const slotTaken = await checkIfSlotTaken(payload.appointment_date, payload.appointment_time);

    if (slotTaken) {
      return response.status(409).json({
        error: "Този час вече е зает",
        code: "SLOT_TAKEN",
      });
    }

    const insertedAppointment = await insertAppointment(payload);
    const emailSent = await sendNotificationEmail(payload);

    return response.status(200).json({
      success: true,
      emailSent,
      appointment: insertedAppointment,
    });
  } catch (error) {
    console.error("book-appointment error", error);

    if (error?.code === "23505") {
      return response.status(409).json({
        error: "Този час вече е зает",
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

  return "";
}

async function checkIfSlotTaken(date, time) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/appointments`);
  url.searchParams.set("select", "id");
  url.searchParams.set("appointment_date", `eq.${date}`);
  url.searchParams.set("appointment_time", `eq.${time}`);
  url.searchParams.set("limit", "1");

  const result = await fetch(url, {
    headers: getSupabaseHeaders(),
  });

  if (!result.ok) {
    throw new Error(`Supabase slot check failed: ${result.status}`);
  }

  const data = await result.json();
  return Array.isArray(data) && data.length > 0;
}

async function insertAppointment(payload) {
  const result = await fetch(`${SUPABASE_URL}/rest/v1/appointments`, {
    method: "POST",
    headers: {
      ...getSupabaseHeaders(),
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify([payload]),
  });

  if (!result.ok) {
    const error = await safeJson(result);
    const enhancedError = new Error(error?.message || `Supabase insert failed: ${result.status}`);
    enhancedError.code = error?.code;
    throw enhancedError;
  }

  const data = await result.json();
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

function getSupabaseHeaders() {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  };
}

async function safeJson(result) {
  try {
    return await result.json();
  } catch {
    return null;
  }
}
