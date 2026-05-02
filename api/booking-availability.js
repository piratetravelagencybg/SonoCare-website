const { isMissingRelationError, supabaseSelect } = require("../lib/supabase");
const { getAvailableSlotsForDate, isValidDateString } = require("../lib/booking");

module.exports = async (request, response) => {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed." });
  }

  response.setHeader("Cache-Control", "no-store");

  const date = String(request.query?.date || "").trim();

  if (!date || !isValidDateString(date)) {
    return response.status(400).json({
      error: "Валидна дата е задължителна.",
      code: "VALIDATION_ERROR",
    });
  }

  try {
    const [appointments, blockedDays, blockedHours] = await Promise.all([
      supabaseSelect("appointments", {
        select: "appointment_time",
        appointment_date: `eq.${date}`,
      }),
      supabaseSelect("blocked_days", {
        select: "id,date",
        date: `eq.${date}`,
      }),
      supabaseSelect("blocked_hours", {
        select: "id,time",
        date: `eq.${date}`,
      }),
    ]);

    const validSlots = new Set(getAvailableSlotsForDate(date));

    return response.status(200).json({
      blockedDay: Array.isArray(blockedDays) && blockedDays.length > 0,
      blockedHours: (blockedHours || [])
        .map((item) => item.time)
        .filter((time) => validSlots.has(time)),
      bookedHours: (appointments || [])
        .map((item) => item.appointment_time)
        .filter((time) => validSlots.has(time)),
    });
  } catch (error) {
    if (isMissingRelationError(error)) {
      return response.status(200).json({
        blockedDay: false,
        blockedHours: [],
        bookedHours: [],
      });
    }

    console.error("booking-availability error", error);
    return response.status(500).json({
      error: "Не успяхме да заредим наличните часове.",
      code: "AVAILABILITY_ERROR",
    });
  }
};
