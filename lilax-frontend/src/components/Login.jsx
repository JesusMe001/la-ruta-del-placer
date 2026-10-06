import React, { useState } from 'react';
import { api, setToken } from '../api.js';

export default function Login({ hotelSlug, onLoggedIn }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!username || !password) {
      setError('Completa usuario y contraseña.');
      return;
    }
    setLoading(true);
    try {
      const data = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ hotelSlug, username, password }),
      });
      if (data.user.role === 'admin') {
        setError('Esta es una cuenta de administración — usa el panel de admin, no el de cajera.');
        return;
      }
      setToken(data.access_token);
      onLoggedIn(data);
    } catch (err) {
      setError(err.message || 'No se pudo iniciar sesión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="logo-wrap">
          <img src="/logo.png" alt="Lilax" />
        </div>
        <h1>HOTEL LILAX</h1>
        <div className="subtitle">Panel de cajera</div>
        {error && <div className="error-msg">{error}</div>}
        <div className="field">
          <label>Usuario</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="cajera1"
            autoComplete="username"
          />
        </div>
        <div className="field">
          <label>Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••"
            autoComplete="current-password"
          />
        </div>
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
}
