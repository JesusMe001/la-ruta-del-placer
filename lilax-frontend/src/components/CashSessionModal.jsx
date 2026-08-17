import React, { useState } from 'react';
import Modal from './Modal.jsx';
import { api } from '../api.js';

export default function CashSessionModal({ hotelId, onClose, onOpened, notify }) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleOpen() {
    setLoading(true);
    try {
      const session = await api(`/hotels/${hotelId}/cash-sessions/open`, {
        method: 'POST',
        body: JSON.stringify({ openingAmount: Number(amount) || 0 }),
      });
      notify('Turno de caja abierto');
      onOpened(session);
    } catch (err) {
      notify('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Abrir turno de caja" subtitle="Registra el monto inicial en efectivo antes de empezar a cobrar." onClose={onClose}>
      <div className="field">
        <label>Monto de apertura ($)</label>
        <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
      </div>
      <div className="modal-actions">
        <button className="btn btn-teal" onClick={handleOpen} disabled={loading}>
          {loading ? 'Abriendo...' : 'Abrir turno'}
        </button>
      </div>
    </Modal>
  );
}
