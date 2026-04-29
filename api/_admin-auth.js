const crypto = require("crypto");

const COOKIE_NAME = "sonocare_admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;

function getAdminConfig() {
  return {
    email: String(process.env.ADMIN_EMAIL || "").trim().toLowerCase(),
    password: String(process.env.ADMIN_PASSWORD || ""),
    secret: String(process.env.ADMIN_SESSION_SECRET || ""),
  };
}

function isAdminConfigured() {
  const config = getAdminConfig();
  return Boolean(config.email && config.password && config.secret);
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function safePasswordMatch(input, expected) {
  const inputBuffer = Buffer.from(String(input || ""));
  const expectedBuffer = Buffer.from(String(expected || ""));

  if (inputBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(inputBuffer, expectedBuffer);
}

function createSessionToken(email) {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = Buffer.from(JSON.stringify({ email, exp: expiresAt })).toString("base64url");
  const signature = signPayload(payload);
  return `${payload}.${signature}`;
}

function signPayload(payload) {
  const { secret } = getAdminConfig();
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

function parseCookies(cookieHeader) {
  const cookies = {};

  String(cookieHeader || "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((part) => {
      const separatorIndex = part.indexOf("=");
      if (separatorIndex === -1) {
        return;
      }

      const key = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();
      cookies[key] = decodeURIComponent(value);
    });

  return cookies;
}

function verifySessionToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) {
    return null;
  }

  const [payload, signature] = token.split(".");

  if (!payload || !signature) {
    return null;
  }

  const expectedSignature = signPayload(payload);

  if (signature !== expectedSignature) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const expiresAt = Number(parsed?.exp || 0);

    if (!parsed?.email || !expiresAt || expiresAt < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return { email: normalizeEmail(parsed.email) };
  } catch {
    return null;
  }
}

function getSessionFromRequest(request) {
  const cookies = parseCookies(request.headers?.cookie);
  return verifySessionToken(cookies[COOKIE_NAME]);
}

function setSessionCookie(response, email) {
  const token = createSessionToken(email);
  response.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${SESSION_TTL_SECONDS}; SameSite=Lax; Secure`
  );
}

function clearSessionCookie(response) {
  response.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax; Secure`
  );
}

function requireAdmin(request, response) {
  if (!isAdminConfigured()) {
    response.status(500).json({
      error: "Admin configuration is missing.",
      code: "ADMIN_CONFIG_ERROR",
    });
    return null;
  }

  const session = getSessionFromRequest(request);

  if (!session) {
    response.status(401).json({
      error: "Authentication required.",
      code: "AUTH_REQUIRED",
    });
    return null;
  }

  return session;
}

function validateAdminCredentials(email, password) {
  const config = getAdminConfig();
  return normalizeEmail(email) === config.email && safePasswordMatch(password, config.password);
}

module.exports = {
  clearSessionCookie,
  getAdminConfig,
  getSessionFromRequest,
  isAdminConfigured,
  requireAdmin,
  setSessionCookie,
  validateAdminCredentials,
};
