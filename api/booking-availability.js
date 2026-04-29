const { isMissingRelationError, supabaseSelect } = require("./_supabase");

module.exports = async (request, response) => {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed." });
  }

  const date = String(request.query?.date || "").trim();

  if (!date) {
    return response.status(400).json({
      error: "Date is required.",
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
        select: "id,date,time",
        date: `eq.${date}`,
      }),
    ]);

    return response.status(200).json({
      blockedDay: Array.isArray(blockedDays) && blockedDays.length > 0,
      bookedHours: (appointments || []).map((item) => item.appointment_time),
      blockedHours: (blockedHours || []).map((item) => item.time),
    });
  } catch (error) {
    if (isMissingRelationError(error)) {
      return response.status(200).json({
        blockedDay: false,
        bookedHours: [],
        blockedHours: [],
      });
    }

    console.error("booking-availability error", error);
    return response.status(500).json({
      error: "Не успяхме да заредим наличните часове.",
      code: "AVAILABILITY_ERROR",
    });
  }
};
