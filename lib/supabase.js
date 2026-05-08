const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function assertSupabaseConfig() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    const error = new Error("Supabase configuration is incomplete.");
    error.code = "SUPABASE_CONFIG_ERROR";
    throw error;
  }
}

function getSupabaseHeaders(extraHeaders = {}) {
  assertSupabaseConfig();

  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    ...extraHeaders,
  };
}

function buildUrl(path, searchParams) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${path}`);

  Object.entries(searchParams || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    url.searchParams.set(key, String(value));
  });

  return url;
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function handleResponse(response, fallbackMessage) {
  if (response.ok) {
    if (response.status === 204) {
      return null;
    }

    return safeJson(response);
  }

  const errorData = await safeJson(response);
  const error = new Error(errorData?.message || fallbackMessage || "Supabase request failed.");
  error.code = errorData?.code;
  error.status = response.status;
  error.details = errorData;
  throw error;
}

async function supabaseSelect(path, searchParams = {}) {
  const response = await fetch(buildUrl(path, searchParams), {
    headers: getSupabaseHeaders(),
  });

  return handleResponse(response, `Failed to load ${path}.`);
}

async function supabaseInsert(path, rows) {
  const response = await fetch(buildUrl(path), {
    method: "POST",
    headers: getSupabaseHeaders({
      "Content-Type": "application/json",
      Prefer: "return=representation",
    }),
    body: JSON.stringify(Array.isArray(rows) ? rows : [rows]),
  });

  return handleResponse(response, `Failed to create ${path}.`);
}

async function supabaseUpdate(path, searchParams, values) {
  const response = await fetch(buildUrl(path, searchParams), {
    method: "PATCH",
    headers: getSupabaseHeaders({
      "Content-Type": "application/json",
      Prefer: "return=representation",
    }),
    body: JSON.stringify(values),
  });

  return handleResponse(response, `Failed to update ${path}.`);
}

async function supabaseDelete(path, searchParams) {
  const response = await fetch(buildUrl(path, searchParams), {
    method: "DELETE",
    headers: getSupabaseHeaders({
      Prefer: "return=representation",
    }),
  });

  return handleResponse(response, `Failed to delete from ${path}.`);
}

async function supabaseCount(path, searchParams = {}) {
  const response = await fetch(buildUrl(path, { ...searchParams, select: "id" }), {
    headers: getSupabaseHeaders({
      Prefer: "count=exact",
      Range: "0-0",
    }),
  });

  if (!response.ok) {
    return handleResponse(response, `Failed to count ${path}.`);
  }

  const contentRange = response.headers.get("content-range");
  if (!contentRange) {
    const data = await safeJson(response);
    return Array.isArray(data) ? data.length : 0;
  }

  const total = contentRange.split("/")[1];
  return Number(total || 0);
}

function isMissingRelationError(error) {
  const code = String(error?.code || "");
  const message = String(error?.message || "");
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    message.toLowerCase().includes("could not find the table") ||
    (message.toLowerCase().includes("relation") && message.toLowerCase().includes("does not exist"))
  );
}

function isMissingColumnError(error, columnName = "") {
  const code = String(error?.code || "");
  const message = String(error?.message || "").toLowerCase();
  const details = String(error?.details || "").toLowerCase();
  const target = String(columnName || "").toLowerCase();
  const mentionsColumn = target ? message.includes(target) || details.includes(target) : true;

  return (
    code === "42703" ||
    (mentionsColumn &&
      ((message.includes("column") && message.includes("does not exist")) ||
        message.includes("could not find the") ||
        details.includes("column")))
  );
}

module.exports = {
  assertSupabaseConfig,
  getSupabaseHeaders,
  isMissingColumnError,
  isMissingRelationError,
  supabaseCount,
  supabaseDelete,
  supabaseInsert,
  supabaseSelect,
  supabaseUpdate,
};
