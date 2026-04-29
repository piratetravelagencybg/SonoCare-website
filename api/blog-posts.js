const { isMissingRelationError, supabaseSelect } = require("../lib/supabase");

module.exports = async (request, response) => {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed." });
  }

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

    console.error("public blog-posts error", error);
    return response.status(500).json({
      error: "Не успяхме да заредим статиите.",
      code: "BLOG_PUBLIC_LOAD_ERROR",
    });
  }
};
