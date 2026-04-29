const { requireAdmin } = require("../lib/admin-auth");
const { isMissingRelationError, supabaseInsert, supabaseSelect } = require("../lib/supabase");

module.exports = async (request, response) => {
  const session = requireAdmin(request, response);

  if (!session) {
    return;
  }

  if (request.method === "GET") {
    try {
      const posts = await supabaseSelect("blog_posts", {
        select: "id,title,content,image,created_at",
        order: "created_at.desc",
      });

      return response.status(200).json({
        posts: posts || [],
      });
    } catch (error) {
      if (isMissingRelationError(error)) {
        return response.status(200).json({ posts: [] });
      }

      console.error("admin-blog-posts GET error", error);
      return response.status(500).json({
        error: "Не успяхме да заредим статиите.",
        code: "BLOG_LOAD_ERROR",
      });
    }
  }

  if (request.method === "POST") {
    const title = String(request.body?.title || "").trim();
    const content = String(request.body?.content || "").trim();
    const image = String(request.body?.image || "").trim();
    const createdAt = String(request.body?.created_at || "").trim();

    if (!title || !content) {
      return response.status(400).json({
        error: "Заглавието и съдържанието са задължителни.",
        code: "VALIDATION_ERROR",
      });
    }

    try {
      const created = await supabaseInsert("blog_posts", {
        title,
        content,
        image: image || null,
        created_at: createdAt || new Date().toISOString(),
      });

      return response.status(200).json({
        success: true,
        post: created?.[0] || null,
      });
    } catch (error) {
      console.error("admin-blog-posts POST error", error);
      return response.status(500).json({
        error: "Не успяхме да публикуваме статията.",
        code: "BLOG_CREATE_ERROR",
      });
    }
  }

  response.setHeader("Allow", "GET, POST");
  return response.status(405).json({ error: "Method not allowed." });
};
