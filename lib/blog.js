function slugify(value) {
  const transliterationMap = {
    "\u0430": "a",
    "\u0431": "b",
    "\u0432": "v",
    "\u0433": "g",
    "\u0434": "d",
    "\u0435": "e",
    "\u0436": "zh",
    "\u0437": "z",
    "\u0438": "i",
    "\u0439": "y",
    "\u043a": "k",
    "\u043b": "l",
    "\u043c": "m",
    "\u043d": "n",
    "\u043e": "o",
    "\u043f": "p",
    "\u0440": "r",
    "\u0441": "s",
    "\u0442": "t",
    "\u0443": "u",
    "\u0444": "f",
    "\u0445": "h",
    "\u0446": "ts",
    "\u0447": "ch",
    "\u0448": "sh",
    "\u0449": "sht",
    "\u044a": "a",
    "\u044c": "",
    "\u044e": "yu",
    "\u044f": "ya",
  };

  return String(value || "")
    .trim()
    .toLowerCase()
    .split("")
    .map((character) => transliterationMap[character] ?? character)
    .join("")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 80);
}

function normalizePostSlug(post) {
  const manualSlug = String(post?.slug || "").trim();
  return manualSlug || slugify(post?.title || "");
}

function buildExcerpt(value, limit = 180) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, limit).trim()}...` : text;
}

function getBlogPostSelect(includeSlug = true) {
  return includeSlug ? "id,title,content,image,created_at,slug" : "id,title,content,image,created_at";
}

function mapPublicPost(post) {
  return {
    id: post?.id || "",
    title: post?.title || "",
    image: post?.image || "",
    created_at: post?.created_at || "",
    slug: normalizePostSlug(post),
    excerpt: buildExcerpt(post?.content || "", 180),
  };
}

function mapAdminPost(post) {
  return {
    ...post,
    slug: normalizePostSlug(post),
  };
}

module.exports = {
  buildExcerpt,
  getBlogPostSelect,
  mapAdminPost,
  mapPublicPost,
  normalizePostSlug,
  slugify,
};
