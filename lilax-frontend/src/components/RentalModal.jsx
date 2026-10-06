import React, { useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import PaymentModal from './PaymentModal.jsx';
import { api } from '../api.js';

function money(n) {
  return '$' + Number(n).toFixed(2);
}
function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
}
const STATUS_LABEL = {
  activa: 'Activa',
  tiempo_extra: 'Tiempo extra',
  finalizada: 'Finalizada',
  cancelada: 'Cancelada',
};

export default function RentalModal({ room, rentalId, products, onClose, onChanged, notify }) {
  const [detail, setDetail] = useState(null);
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState(1);
  const [showPayment, setShowPayment] = useState(false);

  async function refresh() {
    const d = await api(`/rentals/${rentalId}`);
    setDetail(d);
  }

  useEffect(() => {
    refresh();
    if (products.length > 0) setProductId(products[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rentalId]);

  async function handleAddProduct() {
    if (!productId) {
      notify('No hay productos cargados para este hotel');
      return;
    }
    try {
      await api(`/rentals/${rentalId}/products`, {
        method: 'POST',
        body: JSON.stringify({ productId, quantity: Number(qty) || 1 }),
      });
      notify('Producto agregado');
      await refresh();
      onChanged();
    } catch (err) {
      notify('Error: ' + err.message);
    }
  }

  async function handleCheckOut() {
    if (!window.confirm('¿Confirmar check-out de esta habitación?')) return;
    try {
      await api(`/rentals/${rentalId}/checkout`, { method: 'POST' });
      notify('Check-out realizado');
      onClose();
      onChanged();
    } catch (err) {
      notify('Error: ' + err.message);
    }
  }

  if (!detail) {
    return (
      <Modal title={'Habitación ' + room.number} onClose={onClose}>
        <div className="empty-state">Cargando...</div>
      </Modal>
    );
  }

  return (
    <>
      <Modal title={'Habitación ' + room.number} subtitle={STATUS_LABEL[detail.status]} onClose={onClose}>
        <div className="stat-line"><span className="label">Check-in</span><span className="value mono">{fmtTime(detail.checkIn)}</span></div>
        <div className="stat-line"><span className="label">Vence</span><span className="value mono">{fmtTime(detail.expectedCheckout)}</span></div>
        <div className="stat-line"><span className="label">Recargos aplicados</span><span className="value">{detail.extensions.length} ({money(detail.extraChargesTotal)})</span></div>

        {Number(detail.courtesyAmount) > 0 && (
          <div className="stat-line" style={{ color: 'var(--teal)' }}>
            <span className="label" style={{ color: 'var(--teal)' }}>🎁 Cortesía ({detail.courtesyNote || 'aplicada'})</span>
            <span className="value">-{money(detail.courtesyAmount)}</span>
          </div>
        )}

        {detail.products.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <label style={{ fontSize: 12, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Consumo
            </label>
            {detail.products.map((rp) => (
              <div className="stat-line" key={rp.id}>
                <span className="label">
                  {rp.quantity}× {rp.product.name}
                  <span className="mono" style={{ color: 'var(--text-dim)', marginLeft: 6 }}>({rp.product.internalCode})</span>
                  {!rp.delivered && <span style={{ color: 'var(--danger)', marginLeft: 6 }}>· pendiente de entrega</span>}
                  {rp.note && (
                    <div style={{ fontSize: 12, color: 'var(--text-dim)', fontStyle: 'italic' }}>"{rp.note}"</div>
                  )}
                </span>
                <span className="value">{money(rp.subtotal)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="stat-line" style={{ fontWeight: 700, marginTop: 6 }}><span className="label">Total</span><span className="value">{money(detail.totalAmount)}</span></div>

        <div style={{ marginTop: 18 }}>
          <label style={{ fontSize: 12, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Agregar consumo
          </label>
          <div className="qty-row">
            <select className="field-input" value={productId} onChange={(e) => setProductId(e.target.value)}>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.internalCode} · {p.name} — {money(p.price)}</option>
              ))}
            </select>
            <input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <button className="btn btn-secondary" style={{ marginTop: 10 }} onClick={handleAddProduct}>
            + Agregar
          </button>
        </div>

        <div className="modal-actions">
          <button className="btn btn-primary" onClick={() => setShowPayment(true)}>Cobrar / Registrar pago</button>
          <button className="btn btn-danger" onClick={handleCheckOut}>Check-out</button>
        </div>
      </Modal>

      {showPayment && (
        <PaymentModal
          rentalId={rentalId}
          totalAmount={detail.totalAmount}
          onClose={() => setShowPayment(false)}
          notify={notify}
        />
      )}
    </>
  );
}
