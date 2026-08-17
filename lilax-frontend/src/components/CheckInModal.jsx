import React, { useState } from 'react';
import Modal from './Modal.jsx';
import { api } from '../api.js';

function money(n) {
  return '$' + Number(n).toFixed(2);
}

export default function CheckInModal({ room, cashSessionId, onClose, onDone, notify }) {
  const [loading, setLoading] = useState(false);

  async function handleCheckIn() {
    if (!cashSessionId) {
      notify('Primero abre el turno de caja');
      onClose();
      return;
    }
    setLoading(true);
    try {
      await api('/rentals/check-in', {
        method: 'POST',
        body: JSON.stringify({ roomId: room.id, cashSessionId }),
      });
      notify('Check-in realizado — habitación ' + room.number);
      onDone();
    } catch (err) {
      notify('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title={'Habitación ' + room.number}
      subtitle={(room.category ? room.category.name : '') + ' — check-in por 5 horas'}
      onClose={onClose}
    >
      <div className="stat-line">
        <span className="label">Precio base (5h)</span>
        <span className="value">{room.category ? money(room.category.basePrice4h) : '-'}</span>
      </div>
      <div className="stat-line">
        <span className="label">Recargo por 4h extra</span>
        <span className="value">{room.category ? money(room.category.extraBlockPrice) + ' / 4h' : '-'}</span>
      </div>
      <div className="modal-actions">
        <button className="btn btn-primary" onClick={handleCheckIn} disabled={loading}>
          {loading ? 'Procesando...' : 'Confirmar check-in'}
        </button>
      </div>
    </Modal>
  );
}
