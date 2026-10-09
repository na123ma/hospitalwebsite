const BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";
export const session = {
  get user() { try { return JSON.parse(localStorage.getItem("user")); } catch { return null; } },
  save(d) { localStorage.setItem("token", d.access); localStorage.setItem("user", JSON.stringify(d.user)); },
  clear() { localStorage.clear(); },
};
export async function api(path, method = "GET", body) {
  const t = localStorage.getItem("token");
  const res = await fetch(BASE + path, { method,
    headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) },
    body: body ? JSON.stringify(body) : undefined });
  if (res.status === 401 && t) { session.clear(); location.reload(); }
  const data = res.status === 204 ? null : await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = typeof data === "object" && data ? Object.entries(data).map(([k, v]) => k === "detail" ? v : `${k}: ${[].concat(v).join(" ")}`).join(" · ") : "Request failed";
    throw new Error(msg);
  }
  return data;
}
