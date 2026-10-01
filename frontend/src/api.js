const BASE = import.meta.env.VITE_API_URL || '/api';
const KEY = 'daftari.tokens';

export class ApiError extends Error {
  constructor(status, data) {
    super(data?.detail || `Request failed (${status})`);
    this.status = status;
    this.code = data?.code;
    this.data = data || {};
  }
}

const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; } };
export const tokens = {
  get: read,
  set: (t) => localStorage.setItem(KEY, JSON.stringify(t)),
  clear: () => localStorage.removeItem(KEY),
};

let refreshing = null;
function refresh() {
  const t = read();
  if (!t?.refresh) return Promise.reject(new ApiError(401, {}));
  refreshing ??= fetch(`${BASE}/auth/refresh/`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh: t.refresh }),
  }).then(async (r) => {
    if (!r.ok) throw new ApiError(401, {});
    const j = await r.json();
    tokens.set({ access: j.access, refresh: j.refresh || t.refresh });
  }).finally(() => { refreshing = null; });
  return refreshing;
}

async function raw(path, { method = 'GET', body, retry = true } = {}) {
  const t = read();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(t ? { Authorization: `Bearer ${t.access}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && retry && t) {
    try { await refresh(); } catch {
      tokens.clear();
      window.dispatchEvent(new Event('daftari:logout'));
      throw new ApiError(401, {});
    }
    return raw(path, { method, body, retry: false });
  }
  return res;
}

async function json(path, opts) {
  const res = await raw(path, opts);
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

export const api = {
  get: (p) => json(p),
  post: (p, body = {}) => json(p, { method: 'POST', body }),
  put: (p, body) => json(p, { method: 'PUT', body }),
  patch: (p, body) => json(p, { method: 'PATCH', body }),
  del: (p) => json(p, { method: 'DELETE' }),
  async login(username, password) {
    const res = await fetch(`${BASE}/auth/login/`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, data);
    tokens.set(data);
  },
  async download(path, fallback) {
    const res = await raw(path);
    if (!res.ok) throw new ApiError(res.status, {});
    const blob = await res.blob();
    const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') || '')?.[1] || fallback;
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    return name;
  },
};
