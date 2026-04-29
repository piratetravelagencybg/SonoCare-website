const { requireAdmin } = require("./_admin-auth");
const { isMissingRelationError, supabaseCount, supabaseSelect } = require("./_supabase");

module.exports = async (request, response) => {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed." });
  }

  if (!requireAdmin(request, response)) {
    return;
  }

  try {
    const [appointmentsCount, blogPostsCount, latestAppointments, latestPosts] = await Promise.all([
      supabaseCount("appointments"),
      supabaseCount("blog_posts"),
      supabaseSelect("appointments", {
        select: "id,patient_name,patient_phone,service,appointment_date,appointment_time,created_at",
        order: "created_at.desc",
        limit: 5,
      }),
      supabaseSelect("blog_posts", {
        select: "id,title,created_at",
        order: "created_at.desc",
        limit: 5,
      }),
    ]);

    return response.status(200).json({
      appointmentsCount,
      blogPostsCount,
      latestAppointments: latestAppointments || [],
      latestPosts: latestPosts || [],
    });
  } catch (error) {
    if (isMissingRelationError(error)) {
      return response.status(200).json({
        appointmentsCount: 0,
        blogPostsCount: 0,
        latestAppointments: [],
        latestPosts: [],
      });
    }

    console.error("admin-overview error", error);
    return response.status(500).json({
      error: "Не успяхме да заредим обобщението.",
      code: "OVERVIEW_ERROR",
    });
  }
};
