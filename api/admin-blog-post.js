const { requireAdmin } = require("./_admin-auth");
const { supabaseDelete, supabaseSelect, supabaseUpdate } = require("./_supabase");

module.exports = async (request, response) => {
  const session = requireAdmin(request, response);

  if (!session) {
    return;
  }

  const id = String(request.query?.id || "").trim();

  if (!id) {
    return response.status(400).json({
      error: "Missing blog post id.",
      code: "VALIDATION_ERROR",
    });
  }

  if (request.method === "GET") {
    try {
      const posts = await supabaseSelect("blog_posts", {
        select: "id,title,content,image,created_at",
        id: `eq.${id}`,
        limit: 1,
      });

      return response.status(200).json({
        post: posts?.[0] || null,
      });
    } catch (error) {
      console.error("admin-blog-post GET error", error);
      return response.status(500).json({
        error: "Не успяхме да заредим статията.",
        code: "BLOG_SINGLE_LOAD_ERROR",
      });
    }
  }

  if (request.method === "PUT") {
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
      const updated = await supabaseUpdate(
        "blog_posts",
        { id: `eq.${id}` },
        {
          title,
          content,
          image: image || null,
          created_at: createdAt || new Date().toISOString(),
        }
      );

      return response.status(200).json({
        success: true,
        post: updated?.[0] || null,
      });
    } catch (error) {
      console.error("admin-blog-post PUT error", error);
      return response.status(500).json({
        error: "Не успяхме да обновим статията.",
        code: "BLOG_UPDATE_ERROR",
      });
    }
  }

  if (request.method === "DELETE") {
    try {
      await supabaseDelete("blog_posts", { id: `eq.${id}` });
      return response.status(200).json({ success: true });
    } catch (error) {
      console.error("admin-blog-post DELETE error", error);
      return response.status(500).json({
        error: "Не успяхме да изтрием статията.",
        code: "BLOG_DELETE_ERROR",
      });
    }
  }

  response.setHeader("Allow", "GET, PUT, DELETE");
  return response.status(405).json({ error: "Method not allowed." });
};
