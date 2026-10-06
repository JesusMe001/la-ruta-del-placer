import React, { useEffect, useState } from 'react';
import { api } from '../../api.js';

function money(n) {
  return '$' + Number(n).toFixed(2);
}

const TYPE_OPTIONS = [
  { value: 'product', label: 'Producto de cortesía (gratis)' },
  { value: 'fixed', label: 'Monto fijo de descuento' },
  { value: 'percent_total', label: 'Porcentaje sobre toda la cuenta' },
  { value: 'percent_room', label: 'Porcentaje solo sobre la habitación' },
];

export default function CourtesyPanel({ hotelId, notify }) {
  const [rentals, setRentals] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRentalId, setSelectedRentalId] = useState(null);

  const [type, setType] = useState('product');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [amount, setAmount] = useState('');
  const [percent, setPercent] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [r, p] = await Promise.all([
        api(`/rentals/active/${hotelId}`),
        api(`/hotels/${hotelId}/products`),
      ]);
      setRentals(r);
      setProducts(p);
      if (p.length > 0) setProductId(p[0].id);
    } catch (err) {
      notify('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [hotelId]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedRental = rentals.find((r) => r.id === selectedRentalId);

  function resetForm() {
    setType('product');
    setQuantity(1);
    setAmount('');
    setPercent('');
    setNote('');
  }

  function openFor(rental) {
    setSelectedRentalId(rental.id);
    resetForm();
  }

  async function handleApply(e) {
    e.preventDefault();
    if (!selectedRentalId) return;

    const body = { type, note: note.trim() || undefined };
    if (type === 'product') {
      if (!productId) { notify('Elige un producto'); return; }
      body.productId = productId;
      body.quantity = Number(quantity) || 1;
    } else if (type === 'fixed') {
      if (!amount || Number(amount) <= 0) { notify('Ingresa un monto válido'); return; }
      body.amount = Number(amount);
    } else {
      if (!percent || Number(percent) <= 0) { notify('Ingresa un porcentaje válido'); return; }
      body.percent = Number(percent);
    }

    setSubmitting(true);
    try {
      await api(`/rentals/${selectedRentalId}/courtesy`, { method: 'POST', body: JSON.stringify(body) });
      notify('Cortesía aplicada');
      setSelectedRentalId(null);
      load();
    } catch (err) {
      notify('Error: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="panel-card">
      <h2 className="panel-title">Cortesías</h2>
      <div className="panel-desc">
        Para huéspedes frecuentes o conocidos — decisión de los dueños. Elige la habitación y qué tipo
        de cortesía dar: un producto gratis, un monto fijo de descuento, o un porcentaje (sobre toda la
        cuenta o solo sobre la habitación).
      </div>

      {loading ? (
        <div className="empty-note">Cargando...</div>
      ) : rentals.length === 0 ? (
        <div className="empty-note">No hay habitaciones ocupadas ahora mismo.</div>
      ) : (
        <table className="data-table">
          <thead><tr><th>Habitación</th><th>Total actual</th><th>Cortesía aplicada</th><th></th></tr></thead>
          <tbody>
            {rentals.map((r) => (
              <tr key={r.id}>
                <td style={{ fontWeight: 700 }}>{r.room?.number}</td>
                <td>{money(r.totalAmount)}</td>
                <td>{Number(r.courtesyAmount) > 0 ? money(r.courtesyAmount) : '-'}</td>
                <td>
                  <button className="btn-tiny" onClick={() => openFor(r)}>Dar cortesía</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selectedRental && (
        <div className="badge-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelectedRentalId(null); }}>
          <div className="badge-modal" style={{ maxWidth: 380, textAlign: 'left' }}>
            <div className="badge-name" style={{ marginBottom: 4 }}>Cortesía — Habitación {selectedRental.room?.number}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-dim)', marginBottom: 18 }}>
              Total actual: {money(selectedRental.totalAmount)}
            </div>

            <form onSubmit={handleApply} className="loyalty-form">
              <div className="field">
                <label>Tipo de cortesía</label>
                <select className="room-status-select" style={{ width: '100%' }} value={type} onChange={(e) => setType(e.target.value)}>
                  {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              {type === 'product' && (
                <>
                  <div className="field">
                    <label>Producto</label>
                    <select className="room-status-select" style={{ width: '100%' }} value={productId} onChange={(e) => setProductId(e.target.value)}>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.internalCode} · {p.name} — {money(p.price)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Cantidad</label>
                    <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
                  </div>
                </>
              )}

              {type === 'fixed' && (
                <div className="field">
                  <label>Monto de descuento ($)</label>
                  <input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="ej. 5.00" />
                </div>
              )}

              {(type === 'percent_total' || type === 'percent_room') && (
                <div className="field">
                  <label>Porcentaje (%)</label>
                  <input type="number" step="1" min="1" max="100" value={percent} onChange={(e) => setPercent(e.target.value)} placeholder="ej. 15" />
                </div>
              )}

              <div className="field">
                <label>Nota (opcional)</label>
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ej. Cliente frecuente" maxLength={200} />
              </div>

              <div className="badge-actions">
                <button type="button" className="btn-small" onClick={() => setSelectedRentalId(null)}>Cancelar</button>
                <button type="submit" className="btn-small primary" disabled={submitting}>
                  {submitting ? 'Aplicando...' : 'Aplicar cortesía'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
