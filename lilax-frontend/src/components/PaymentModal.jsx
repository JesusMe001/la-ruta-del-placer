import React, { useState } from 'react';
import Modal from './Modal.jsx';
import { api } from '../api.js';

export default function PaymentModal({ rentalId, totalAmount, onClose, notify }) {
  const [amount, setAmount] = useState(totalAmount != null ? String(Number(totalAmount).toFixed(2)) : '');
  const [method, setMethod] = useState('efectivo');
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    if (!amount || Number(amount) <= 0) {
      notify('Ingresa un monto válido');
      return;
    }
    setLoading(true);
    try {
      await api(`/rentals/${rentalId}/payments`, {
        method: 'POST',
        body: JSON.stringify({ amount, method }),
      });
      notify('Pago registrado');
      onClose();
    } catch (err) {
      notify('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Registrar pago" onClose={onClose}>
      <div className="field">
        <label>Monto ($)</label>
        <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        {totalAmount != null && (
          <div className="field-hint">
            Total de la cuenta: {'$' + Number(totalAmount).toFixed(2)}
            {amount !== String(Number(totalAmount).toFixed(2)) && (
              <button
                type="button"
                className="field-hint-link"
                onClick={() => setAmount(String(Number(totalAmount).toFixed(2)))}
              >
                Usar total
              </button>
            )}
          </div>
        )}
      </div>
      <div className="field">
        <label>Método</label>
        <select className="field-input" value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="efectivo">Efectivo</option>
          <option value="tarjeta">Tarjeta</option>
          <option value="transferencia">Transferencia</option>
          <option value="mixto">Mixto</option>
        </select>
      </div>
      <div className="modal-actions">
        <button className="btn btn-primary" onClick={handleConfirm} disabled={loading}>
          {loading ? 'Procesando...' : 'Confirmar pago'}
        </button>
      </div>
    </Modal>
  );
}
