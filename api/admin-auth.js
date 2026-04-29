const {
  clearSessionCookie,
  getSessionFromRequest,
  isAdminConfigured,
  setSessionCookie,
  validateAdminCredentials,
} = require("../lib/admin-auth");

module.exports = async (request, response) => {
  if (request.method === "GET") {
    if (!isAdminConfigured()) {
      return response.status(500).json({
        error: "Admin credentials are not configured.",
        code: "ADMIN_CONFIG_ERROR",
      });
    }

    const session = getSessionFromRequest(request);

    if (!session) {
      return response.status(401).json({
        authenticated: false,
        code: "AUTH_REQUIRED",
      });
    }

    return response.status(200).json({
      authenticated: true,
      user: {
        email: session.email,
      },
    });
  }

  if (request.method === "POST") {
    if (!isAdminConfigured()) {
      return response.status(500).json({
        error: "Admin credentials are not configured.",
        code: "ADMIN_CONFIG_ERROR",
      });
    }

    const email = String(request.body?.email || "").trim();
    const password = String(request.body?.password || "");

    if (!email || !password) {
      return response.status(400).json({
        error: "Моля, въведете имейл и парола.",
        code: "VALIDATION_ERROR",
      });
    }

    if (!validateAdminCredentials(email, password)) {
      return response.status(401).json({
        error: "Невалиден имейл или парола.",
        code: "INVALID_CREDENTIALS",
      });
    }

    setSessionCookie(response, email);

    return response.status(200).json({
      success: true,
      redirectTo: "/admin/dashboard.html",
    });
  }

  if (request.method === "DELETE") {
    clearSessionCookie(response);
    return response.status(200).json({ success: true });
  }

  response.setHeader("Allow", "GET, POST, DELETE");
  return response.status(405).json({ error: "Method not allowed." });
};
