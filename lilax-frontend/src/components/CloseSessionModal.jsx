import React, { useState } from 'react';
import Modal from './Modal.jsx';
import { api } from '../api.js';

function money(n) {
  return '$' + Number(n).toFixed(2);
}

export default function CloseSessionModal({ hotelId, cashSessionId, onClose, onClosed, notify }) {
  const [closingAmount, setClosingAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  async function handleClose() {
    if (!closingAmount || Number(closingAmount) < 0) {
      notify('Ingresa el monto real contado en caja');
      return;
    }
    setLoading(true);
    try {
      const session = await api(`/hotels/${hotelId}/cash-sessions/${cashSessionId}/close`, {
        method: 'POST',
        body: JSON.stringify({ closingAmount: Number(closingAmount) }),
      });
      setResult(session);
      notify('Turno cerrado');
    } catch (err) {
      notify('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    const diff = Number(result.difference);
    return (
      <Modal title="Turno cerrado" onClose={() => { onClose(); onClosed(); }}>
        <div className="stat-line"><span className="label">Apertura</span><span className="value">{money(result.openingAmount)}</span></div>
        <div className="stat-line"><span className="label">Esperado en caja</span><span className="value">{money(result.expectedAmount)}</span></div>
        <div className="stat-line"><span className="label">Contado real</span><span className="value">{money(result.closingAmount)}</span></div>
        <div className="stat-line" style={{ fontWeight: 700 }}>
          <span className="label">Diferencia</span>
          <span className="value" style={{ color: diff < 0 ? 'var(--danger)' : diff > 0 ? 'var(--teal)' : 'var(--text)' }}>
            {diff > 0 ? '+' : ''}{money(diff)}
          </span>
        </div>
        {diff !== 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 10 }}>
            {diff < 0 ? 'Falta dinero respecto a lo que el sistema esperaba.' : 'Sobra dinero respecto a lo que el sistema esperaba.'}
          </div>
        )}
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={() => { onClose(); onClosed(); }}>Listo</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Cerrar turno de caja" subtitle="Cuenta el efectivo real en caja e ingrésalo aquí." onClose={onClose}>
      <div className="field">
        <label>Monto real contado ($)</label>
        <input
          type="number"
          step="0.01"
          value={closingAmount}
          onChange={(e) => setClosingAmount(e.target.value)}
          placeholder="0.00"
          autoFocus
        />
      </div>
      <div className="modal-actions">
        <button className="btn btn-danger" onClick={handleClose} disabled={loading}>
          {loading ? 'Cerrando...' : 'Cerrar turno'}
        </button>
      </div>
    </Modal>
  );
}
