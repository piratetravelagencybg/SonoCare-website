const { getSessionFromRequest, isAdminConfigured } = require("./_admin-auth");

module.exports = async (request, response) => {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed." });
  }

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
};
