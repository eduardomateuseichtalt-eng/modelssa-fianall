const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = localStorage.getItem("accessToken");

  const isPublic =
    path.startsWith("/api/auth/login") ||
    path.startsWith("/api/auth/register") ||
    path.startsWith("/api/auth/refresh");

  if (!isPublic && token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  let data = null;
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    data = await response.json().catch(() => null);
  } else {
    const text = await response.text();
    data = text ? { error: text } : {};
  }

  if (!response.ok) {
    const message =
      (data && data.error) ||
      (data && data.message) ||
      `Erro HTTP ${response.status}`;
    const isAgeGate =
      typeof message === "string" && message.toLowerCase().includes("verificacao de idade");

    const isModelTrialExpired =
      response.status === 402 &&
      data &&
      data.code === "MODEL_TRIAL_EXPIRED" &&
      data.paymentRequired === true;

    if ((response.status === 401 || response.status === 403 || isModelTrialExpired) && !isAgeGate) {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
    }
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export { API_URL };
