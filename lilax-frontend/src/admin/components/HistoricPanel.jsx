import React, { useEffect, useState } from 'react';
import { api } from '../../api.js';

function money(n) {
  return '$' + Number(n).toFixed(2);
}

function RevenueChart({ data }) {
  if (!data || data.length === 0) return <div className="empty-note">Sin datos en este período.</div>;
  const max = Math.max(...data.map((d) => d.total), 1);
  const width = 700;
  const height = 160;
  const barWidth = width / data.length;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="revenue-chart" preserveAspectRatio="none">
      {data.map((d, i) => {
        const barHeight = (d.total / max) * (height - 24);
        return (
          <g key={d.date}>
            <rect
              x={i * barWidth + barWidth * 0.15}
              y={height - barHeight - 18}
              width={barWidth * 0.7}
              height={barHeight}
              rx="3"
              fill="url(#barGradient)"
            />
            <text
              x={i * barWidth + barWidth / 2}
              y={height - 4}
              textAnchor="middle"
              fontSize="9"
              fill="var(--text-dim)"
            >
              {d.date.slice(5)}
            </text>
          </g>
        );
      })}
      <defs>
        <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--gold)" />
          <stop offset="100%" stopColor="var(--primary)" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function HistoricPanel({ hotelId, notify }) {
  const [days, setDays] = useState(30);
  const [historic, setHistoric] = useState(null);
  const [topProducts, setTopProducts] = useState([]);
  const [cashSessions, setCashSessions] = useState([]);

  async function load() {
    try {
      const [h, tp, cs] = await Promise.all([
        api(`/hotels/${hotelId}/dashboard/historic?days=${days}`),
        api(`/hotels/${hotelId}/dashboard/top-products?days=${days}`),
        api(`/hotels/${hotelId}/dashboard/cash-sessions`),
      ]);
      setHistoric(h);
      setTopProducts(tp);
      setCashSessions(cs);
    } catch (err) {
      notify('Error: ' + err.message);
    }
  }

  useEffect(() => { load(); }, [hotelId, days]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div className="row-between" style={{ marginBottom: 14 }}>
        <div className="period-select">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              className={'chip-btn' + (days === d ? ' active' : '')}
              onClick={() => setDays(d)}
            >
              {d} días
            </button>
          ))}
        </div>
      </div>

      {historic && (
        <div className="stat-grid">
          <div className="stat-box">
            <div className="stat-value">{money(historic.totalRevenue)}</div>
            <div className="stat-label">Ingresos totales</div>
          </div>
          <div className="stat-box">
            <div className="stat-value">{historic.rentalsCount}</div>
            <div className="stat-label">Alquileres cerrados</div>
          </div>
          <div className="stat-box">
            <div className="stat-value">{money(historic.averageTicket)}</div>
            <div className="stat-label">Ticket promedio</div>
          </div>
          <div className="stat-box">
            <div className="stat-value">{money(historic.productRevenue)}</div>
            <div className="stat-label">Ingresos por consumo</div>
          </div>
        </div>
      )}

      <div className="panel-card">
        <h2 className="panel-title">Ingresos por día</h2>
        {historic && <RevenueChart data={historic.revenueByDay} />}
      </div>

      <div className="panel-card">
        <h2 className="panel-title">Productos más vendidos</h2>
        {topProducts.length === 0 ? (
          <div className="empty-note">Sin consumo registrado en este período.</div>
        ) : (
          <table className="data-table">
            <thead><tr><th>Código</th><th>Producto</th><th>Cantidad</th><th>Ingresos</th></tr></thead>
            <tbody>
              {topProducts.map((p) => (
                <tr key={p.code}>
                  <td className="mono">{p.code}</td>
                  <td>{p.name}</td>
                  <td>{p.quantity}</td>
                  <td>{money(p.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="panel-card">
        <h2 className="panel-title">Historial de cierres de caja</h2>
        {cashSessions.length === 0 ? (
          <div className="empty-note">Aún no hay turnos cerrados.</div>
        ) : (
          <table className="data-table">
            <thead><tr><th>Cajera</th><th>Cierre</th><th>Esperado</th><th>Real</th><th>Diferencia</th></tr></thead>
            <tbody>
              {cashSessions.map((s, i) => (
                <tr key={i}>
                  <td>{s.cashierName}</td>
                  <td className="mono">{new Date(s.closedAt).toLocaleString('es-EC')}</td>
                  <td>{money(s.expectedAmount)}</td>
                  <td>{money(s.closingAmount)}</td>
                  <td className={Number(s.difference) < 0 ? 'diff-negative' : Number(s.difference) > 0 ? 'diff-positive' : ''}>
                    {money(s.difference)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
