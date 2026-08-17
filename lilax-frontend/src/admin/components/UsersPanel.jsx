import React, { useState } from 'react';
import { api } from '../../api.js';

const ROLE_LABELS = { cajera: 'Cajera', supervisor: 'Supervisor', admin: 'Admin' };

export default function UsersPanel({ hotelId, notify }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', fullName: '', role: 'cajera' });
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await api(`/hotels/${hotelId}/users`);
      setUsers(data);
    } catch (err) {
      notify('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => { load(); }, [hotelId]);

  async function handleCreate(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api(`/hotels/${hotelId}/users`, { method: 'POST', body: JSON.stringify(form) });
      notify('Usuario creado');
      setForm({ username: '', password: '', fullName: '', role: 'cajera' });
      setShowForm(false);
      load();
    } catch (err) {
      notify('Error: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(user) {
    try {
      await api(`/hotels/${hotelId}/users/${user.id}/active`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !user.active }),
      });
      load();
    } catch (err) {
      notify('Error: ' + err.message);
    }
  }

  return (
    <div className="panel-card">
      <div className="row-between">
        <h2 className="panel-title">Usuarios</h2>
        <button className="btn-small" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancelar' : '+ Nuevo usuario'}
        </button>
      </div>

      {showForm && (
        <form className="user-form" onSubmit={handleCreate}>
          <div className="form-row">
            <input
              placeholder="Nombre completo"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              required
            />
            <input
              placeholder="Usuario"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
            />
          </div>
          <div className="form-row">
            <input
              type="password"
              placeholder="Contraseña (mín. 4 caracteres)"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              minLength={4}
              required
            />
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="cajera">Cajera</option>
              <option value="supervisor">Supervisor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button className="btn-small primary" type="submit" disabled={submitting}>
            {submitting ? 'Creando...' : 'Crear usuario'}
          </button>
        </form>
      )}

      {loading ? (
        <div className="empty-note">Cargando...</div>
      ) : users.length === 0 ? (
        <div className="empty-note">Aún no hay usuarios.</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Usuario</th>
              <th>Rol</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.fullName}</td>
                <td className="mono">{u.username}</td>
                <td>{ROLE_LABELS[u.role] || u.role}</td>
                <td>
                  <span className={'status-tag ' + (u.active ? 'ok' : 'off')}>
                    {u.active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td>
                  <button className="btn-tiny" onClick={() => toggleActive(u)}>
                    {u.active ? 'Desactivar' : 'Activar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
