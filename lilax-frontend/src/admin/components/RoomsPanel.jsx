import React, { useEffect, useState } from 'react';
import { api } from '../../api.js';

const STATUS_LABELS = {
  libre: 'Libre',
  ocupada: 'Ocupada',
  tiempo_extra: 'Tiempo extra',
  limpieza: 'Limpieza',
  fuera_servicio: 'Fuera de servicio',
};
const STATUS_COLORS = {
  libre: 'var(--teal)',
  ocupada: 'var(--gold)',
  tiempo_extra: 'var(--danger)',
  limpieza: 'var(--sleep)',
  fuera_servicio: 'var(--sleep)',
};

export default function RoomsPanel({ hotelId, notify }) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api(`/hotels/${hotelId}/rooms`);
      setRooms(data);
    } catch (err) {
      notify('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [hotelId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function changeStatus(room, status) {
    if (status === room.status) return;
    setUpdatingId(room.id);
    try {
      await api(`/hotels/${hotelId}/rooms/${room.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setRooms((rs) => rs.map((r) => (r.id === room.id ? { ...r, status } : r)));
      notify(`Habitación ${room.number} → ${STATUS_LABELS[status]}`);
    } catch (err) {
      notify('Error: ' + err.message);
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="panel-card">
      <h2 className="panel-title">Habitaciones</h2>
      <div className="panel-desc">
        Cambia el estado manualmente — por ejemplo, para sacar una habitación de operación por mantenimiento
        ("Fuera de servicio") y que no aparezca disponible para check-in hasta que la regreses a "Libre".
      </div>

      {loading ? (
        <div className="empty-note">Cargando...</div>
      ) : rooms.length === 0 ? (
        <div className="empty-note">Aún no hay habitaciones creadas.</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr><th>Habitación</th><th>Categoría</th><th>Estado</th><th>Cambiar a</th></tr>
          </thead>
          <tbody>
            {rooms.map((r) => (
              <tr key={r.id}>
                <td style={{ fontWeight: 700 }}>{r.number}</td>
                <td>{r.category?.name || '-'}</td>
                <td>
                  <span className="status-dot" style={{ background: STATUS_COLORS[r.status] }} />
                  {STATUS_LABELS[r.status] || r.status}
                </td>
                <td>
                  <select
                    className="room-status-select"
                    value={r.status}
                    disabled={updatingId === r.id || r.status === 'ocupada' || r.status === 'tiempo_extra'}
                    onChange={(e) => changeStatus(r, e.target.value)}
                  >
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
