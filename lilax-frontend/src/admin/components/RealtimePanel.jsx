import React, { useEffect, useState } from 'react';
import { api } from '../../api.js';

function money(n) {
  return '$' + Number(n).toFixed(2);
}

const STATUS_LABELS = { libre: 'Libres', ocupada: 'Ocupadas', tiempo_extra: 'Tiempo extra', pendiente_limpieza: 'Por limpiar', limpieza: 'En limpieza', fuera_servicio: 'Fuera de servicio' };
const STATUS_COLORS = { libre: 'var(--teal)', ocupada: 'var(--gold)', tiempo_extra: 'var(--danger)', pendiente_limpieza: '#8A7FBF', limpieza: 'var(--sleep)', fuera_servicio: 'var(--sleep)' };

export default function RealtimePanel({ hotelId, notify }) {
  const [data, setData] = useState(null);

  async function load() {
    try {
      const res = await api(`/hotels/${hotelId}/dashboard/realtime`);
      setData(res);
    } catch (err) {
      notify('Error: ' + err.message);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelId]);

  if (!data) return <div className="panel-card"><div className="empty-note">Cargando...</div></div>;

  return (
    <>
      <div className="stat-grid">
        <div className="stat-box">
          <div className="stat-value">{data.activeRentalsCount}</div>
          <div className="stat-label">Habitaciones activas</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">{money(data.activeValue)}</div>
          <div className="stat-label">Valor en cuentas abiertas</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">{data.pendingDeliveries}</div>
          <div className="stat-label">Entregas pendientes</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">{data.checkoutRequests}</div>
          <div className="stat-label">Piden la cuenta</div>
        </div>
      </div>

      <div className="panel-card">
        <h2 className="panel-title">Estado de habitaciones</h2>
        <div className="room-status-bars">
          {Object.entries(STATUS_LABELS).map(([key, label]) => {
            const count = data.roomsByStatus[key] || 0;
            return (
              <div className="room-status-row" key={key}>
                <span className="room-status-label">{label}</span>
                <div className="room-status-bar-track">
                  <div
                    className="room-status-bar-fill"
                    style={{ width: Math.min(100, count * 20) + '%', background: STATUS_COLORS[key] }}
                  />
                </div>
                <span className="room-status-count">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="panel-card">
        <h2 className="panel-title">Turnos de caja abiertos</h2>
        {data.openSessions.length === 0 ? (
          <div className="empty-note">No hay turnos abiertos ahora mismo.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Cajera</th><th>Apertura</th><th>Cobrado</th><th>Esperado en caja</th></tr>
            </thead>
            <tbody>
              {data.openSessions.map((s, i) => (
                <tr key={i}>
                  <td>{s.cashierName}</td>
                  <td>{money(s.openingAmount)}</td>
                  <td>{money(s.collected)}</td>
                  <td className="mono">{money(s.expected)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
