const { isMissingRelationError, supabaseSelect } = require("../lib/supabase");

module.exports = async (request, response) => {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed." });
  }

  const id = String(request.query?.id || "").trim();

  if (!id) {
    return response.status(400).json({
      error: "Missing blog post id.",
      code: "VALIDATION_ERROR",
    });
  }

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
    if (isMissingRelationError(error)) {
      return response.status(200).json({ post: null });
    }

    console.error("public blog-post error", error);
    return response.status(500).json({
      error: "Не успяхме да заредим статията.",
      code: "BLOG_PUBLIC_SINGLE_ERROR",
    });
  }
};
