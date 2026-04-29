const { clearSessionCookie } = require("./_admin-auth");

module.exports = async (request, response) => {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  clearSessionCookie(response);
  return response.status(200).json({ success: true });
};
