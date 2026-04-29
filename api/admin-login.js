const {
  isAdminConfigured,
  setSessionCookie,
  validateAdminCredentials,
} = require("./_admin-auth");

module.exports = async (request, response) => {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

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
};
