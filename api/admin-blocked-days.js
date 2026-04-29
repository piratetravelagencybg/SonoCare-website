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
      const blockedDays = await supabaseSelect("blocked_days", {
        select: "id,date,created_at",
        order: "date.asc",
      });

      return response.status(200).json({
        blockedDays: blockedDays || [],
      });
    } catch (error) {
      if (isMissingRelationError(error)) {
        return response.status(200).json({ blockedDays: [] });
      }

      console.error("admin-blocked-days GET error", error);
      return response.status(500).json({
        error: "Не успяхме да заредим блокираните дни.",
        code: "BLOCKED_DAYS_LOAD_ERROR",
      });
    }
  }

  if (request.method === "POST") {
    const date = String(request.body?.date || "").trim();

    if (!date) {
      return response.status(400).json({
        error: "Моля, изберете дата.",
        code: "VALIDATION_ERROR",
      });
    }

    try {
      const created = await supabaseInsert("blocked_days", { date });
      return response.status(200).json({
        success: true,
        blockedDay: created?.[0] || null,
      });
    } catch (error) {
      console.error("admin-blocked-days POST error", error);
      if (error?.code === "23505") {
        return response.status(409).json({
          error: "Този ден вече е блокиран.",
          code: "DAY_ALREADY_BLOCKED",
        });
      }
      return response.status(500).json({
        error: "Не успяхме да блокираме деня.",
        code: "BLOCK_DAY_ERROR",
      });
    }
  }

  if (request.method === "DELETE") {
    const id = String(request.query?.id || "").trim();

    if (!id) {
      return response.status(400).json({
        error: "Missing blocked day id.",
        code: "VALIDATION_ERROR",
      });
    }

    try {
      await supabaseDelete("blocked_days", { id: `eq.${id}` });
      return response.status(200).json({ success: true });
    } catch (error) {
      console.error("admin-blocked-days DELETE error", error);
      return response.status(500).json({
        error: "Не успяхме да премахнем блокирания ден.",
        code: "UNBLOCK_DAY_ERROR",
      });
    }
  }

  response.setHeader("Allow", "GET, POST, DELETE");
  return response.status(405).json({ error: "Method not allowed." });
};
