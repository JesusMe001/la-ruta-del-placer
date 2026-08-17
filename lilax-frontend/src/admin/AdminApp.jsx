import React, { useState } from 'react';
import { api, setToken } from '../api.js';
import RealtimePanel from './components/RealtimePanel.jsx';
import HistoricPanel from './components/HistoricPanel.jsx';
import UsersPanel from './components/UsersPanel.jsx';
import RoomsPanel from './components/RoomsPanel.jsx';
import QrCodesPanel from './components/QrCodesPanel.jsx';
import LoyaltyPanel from './components/LoyaltyPanel.jsx';
import NetworkPanel from './components/NetworkPanel.jsx';

const HOTEL_SLUG = 'lilax';
const TABS = [
  { key: 'realtime', label: 'Tiempo real' },
  { key: 'historic', label: 'Histórico' },
  { key: 'rooms', label: 'Habitaciones' },
  { key: 'qrcodes', label: 'Códigos QR' },
  { key: 'loyalty', label: 'Fidelización' },
  { key: 'network', label: 'Red' },
  { key: 'users', label: 'Usuarios' },
];

function AdminLogin({ onLoggedIn }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ hotelSlug: HOTEL_SLUG, username, password }),
      });
      if (data.user.role !== 'admin' && data.user.role !== 'supervisor') {
        setError('Esta cuenta no tiene permisos de administración.');
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
        <h1>ADMINISTRACIÓN</h1>
        <div className="subtitle">Hotel Lilax</div>
        {error && <div className="error-msg">{error}</div>}
        <div className="field">
          <label>Usuario</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
        </div>
        <div className="field">
          <label>Contraseña</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </div>
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
}

export default function AdminApp() {
  const [session, setSession] = useState(null);
  const [tab, setTab] = useState('realtime');
  const [toast, setToast] = useState('');

  function notify(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2600);
  }

  if (!session) {
    return <AdminLogin onLoggedIn={(data) => setSession({ hotel: data.hotel, user: data.user })} />;
  }

  return (
    <div>
      <header className="topbar">
        <div className="brand">
          <img src="/logo.png" alt="Lilax" />
          <div className="name">ADMIN <span>LILAX</span></div>
        </div>
        <div className="topbar-right">
          <span className="mono" style={{ fontSize: 13, color: 'var(--text-dim)' }}>
            {session.user.fullName}
          </span>
          <button className="btn btn-secondary btn-auto" onClick={() => setSession(null)}>Salir</button>
        </div>
      </header>

      <div className="admin-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={'admin-tab' + (tab === t.key ? ' active' : '')}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <main className="admin-main">
        {tab === 'realtime' && <RealtimePanel hotelId={session.hotel.id} notify={notify} />}
        {tab === 'historic' && <HistoricPanel hotelId={session.hotel.id} notify={notify} />}
        {tab === 'rooms' && <RoomsPanel hotelId={session.hotel.id} notify={notify} />}
        {tab === 'qrcodes' && <QrCodesPanel hotelId={session.hotel.id} hotelName={session.hotel.name} notify={notify} />}
        {tab === 'loyalty' && <LoyaltyPanel hotelId={session.hotel.id} notify={notify} />}
        {tab === 'network' && <NetworkPanel hotelId={session.hotel.id} notify={notify} />}
        {tab === 'users' && <UsersPanel hotelId={session.hotel.id} notify={notify} />}
      </main>

      <div className={'toast' + (toast ? ' show' : '')}>{toast}</div>
    </div>
  );
}
