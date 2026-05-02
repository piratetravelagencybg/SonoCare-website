const { isMissingRelationError, supabaseSelect } = require("../lib/supabase");
const { buildExcerpt, slugify } = require("../lib/blog");

module.exports = async (request, response) => {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed." });
  }

  response.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=86400");

  const id = getRequestParam(request, "id");

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
      post: posts?.[0]
        ? {
            ...posts[0],
            slug: slugify(posts[0].title || ""),
            excerpt: buildExcerpt(posts[0].content || "", 180),
          }
        : null,
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

function getRequestParam(request, key) {
  const directValue = String(request.query?.[key] || "").trim();
  if (directValue) return directValue;

  try {
    const host = request.headers?.host || "localhost";
    const value = new URL(request.url || "", `https://${host}`).searchParams.get(key);
    return String(value || "").trim();
  } catch {
    return "";
  }
}
