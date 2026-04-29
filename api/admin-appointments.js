const { requireAdmin } = require("../lib/admin-auth");
const { supabaseDelete, supabaseSelect } = require("../lib/supabase");

module.exports = async (request, response) => {
  const session = requireAdmin(request, response);

  if (!session) {
    return;
  }

  if (request.method === "GET") {
    try {
      const appointments = await supabaseSelect("appointments", {
        select:
          "id,patient_name,patient_phone,patient_email,service,appointment_date,appointment_time,notes,created_at",
        order: "appointment_date.asc,appointment_time.asc",
      });

      return response.status(200).json({
        appointments: appointments || [],
      });
    } catch (error) {
      console.error("admin-appointments GET error", error);
      return response.status(500).json({
        error: "Не успяхме да заредим записванията.",
        code: "APPOINTMENTS_LOAD_ERROR",
      });
    }
  }

  if (request.method === "DELETE") {
    const id = String(request.query?.id || "").trim();

    if (!id) {
      return response.status(400).json({
        error: "Missing appointment id.",
        code: "VALIDATION_ERROR",
      });
    }

    try {
      await supabaseDelete("appointments", { id: `eq.${id}` });
      return response.status(200).json({ success: true });
    } catch (error) {
      console.error("admin-appointments DELETE error", error);
      return response.status(500).json({
        error: "Не успяхме да изтрием записването.",
        code: "APPOINTMENT_DELETE_ERROR",
      });
    }
  }

  response.setHeader("Allow", "GET, DELETE");
  return response.status(405).json({ error: "Method not allowed." });
};
