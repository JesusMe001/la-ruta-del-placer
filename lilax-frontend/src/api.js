const API = import.meta.env.VITE_API_URL || 'http://localhost:3000';

let token = null;
export function setToken(t) { token = t; }

export async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(API + path, { ...opts, headers: { ...headers, ...(opts.headers || {}) } });
  if (!res.ok) {
    let msg = 'Error ' + res.status;
    try {
      const j = await res.json();
      msg = j.message || msg;
    } catch (e) {
      /* respuesta sin cuerpo JSON */
    }
    throw new Error(Array.isArray(msg) ? msg.join(', ') : msg);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}
