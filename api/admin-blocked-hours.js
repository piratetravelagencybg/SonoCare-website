const { requireAdmin } = require("../lib/admin-auth");
const {
  isMissingRelationError,
  supabaseDelete,
  supabaseInsert,
  supabaseSelect,
} = require("../lib/supabase");

module.exports = async (request, response) => {
  const session = requireAdmin(request, response);

  if (!session) {
    return;
  }

  if (request.method === "GET") {
    try {
      const blockedHours = await supabaseSelect("blocked_hours", {
        select: "id,date,time,created_at",
        order: "date.asc,time.asc",
      });

      return response.status(200).json({
        blockedHours: blockedHours || [],
      });
    } catch (error) {
      if (isMissingRelationError(error)) {
        return response.status(200).json({ blockedHours: [] });
      }

      console.error("admin-blocked-hours GET error", error);
      return response.status(500).json({
        error: "Не успяхме да заредим блокираните часове.",
        code: "BLOCKED_HOURS_LOAD_ERROR",
      });
    }
  }

  if (request.method === "POST") {
    const date = String(request.body?.date || "").trim();
    const time = String(request.body?.time || "").trim();

    if (!date || !time) {
      return response.status(400).json({
        error: "Моля, изберете дата и час.",
        code: "VALIDATION_ERROR",
      });
    }

    try {
      const created = await supabaseInsert("blocked_hours", { date, time });
      return response.status(200).json({
        success: true,
        blockedHour: created?.[0] || null,
      });
    } catch (error) {
      console.error("admin-blocked-hours POST error", error);
      if (error?.code === "23505") {
        return response.status(409).json({
          error: "Този час вече е блокиран.",
          code: "HOUR_ALREADY_BLOCKED",
        });
      }
      return response.status(500).json({
        error: "Не успяхме да блокираме часа.",
        code: "BLOCK_HOUR_ERROR",
      });
    }
  }

  if (request.method === "DELETE") {
    const id = String(request.query?.id || "").trim();

    if (!id) {
      return response.status(400).json({
        error: "Missing blocked hour id.",
        code: "VALIDATION_ERROR",
      });
    }

    try {
      await supabaseDelete("blocked_hours", { id: `eq.${id}` });
      return response.status(200).json({ success: true });
    } catch (error) {
      console.error("admin-blocked-hours DELETE error", error);
      return response.status(500).json({
        error: "Не успяхме да премахнем блокирания час.",
        code: "UNBLOCK_HOUR_ERROR",
      });
    }
  }

  response.setHeader("Allow", "GET, POST, DELETE");
  return response.status(405).json({ error: "Method not allowed." });
};
