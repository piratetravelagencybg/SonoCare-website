const { buildExcerpt, getBlogPostSelect, normalizePostSlug } = require("../lib/blog");
const { isMissingColumnError, isMissingRelationError, supabaseSelect } = require("../lib/supabase");
const { handleCorsPreflight, setPublicCorsHeaders } = require("../lib/cors");

module.exports = async (request, response) => {
  if (handleCorsPreflight(request, response)) {
    return;
  }

  setPublicCorsHeaders(response);

  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed." });
  }

  response.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=86400");

  const id = getRequestParam(request, "id");
  const slug = getRequestParam(request, "slug");

  if (!id && !slug) {
    return response.status(400).json({
      error: "Missing blog post reference.",
      code: "VALIDATION_ERROR",
    });
  }

  try {
    const posts = await selectPublicPost({ id, slug });

    return response.status(200).json({
      post: posts?.[0]
        ? {
            ...posts[0],
            slug: normalizePostSlug(posts[0]),
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

async function selectPublicPost(reference) {
  if (reference.slug) {
    try {
      const slugPosts = await supabaseSelect("blog_posts", {
        select: getBlogPostSelect(true),
        slug: `eq.${reference.slug}`,
        limit: 1,
      });

      if (slugPosts?.length) {
        return slugPosts;
      }
    } catch (error) {
      if (!isMissingColumnError(error, "slug")) {
        throw error;
      }
    }
  }

  if (!reference.id) {
    return [];
  }

  try {
    return await supabaseSelect("blog_posts", {
      select: getBlogPostSelect(true),
      id: `eq.${reference.id}`,
      limit: 1,
    });
  } catch (error) {
    if (!isMissingColumnError(error, "slug")) {
      throw error;
    }

    return supabaseSelect("blog_posts", {
      select: getBlogPostSelect(false),
      id: `eq.${reference.id}`,
      limit: 1,
    });
  }
}

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
