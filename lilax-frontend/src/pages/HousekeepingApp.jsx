import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

const HOTEL_SLUG = 'lilax';

function getCodeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('code') || '';
}

export default function HousekeepingApp() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [actionModal, setActionModal] = useState(null); // { type: 'claim'|'finish', room }
  const [codeInput, setCodeInput] = useState(getCodeFromUrl());
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2400);
  }

  async function loadRooms() {
    try {
      const data = await api(`/housekeeping/${HOTEL_SLUG}/rooms`);
      setRooms(data);
    } catch (err) {
      /* silencioso, reintenta en el siguiente ciclo */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRooms();
    const id = setInterval(loadRooms, 15000);
    return () => clearInterval(id);
  }, []);

  function openAction(type, room) {
    setModalError('');
    setActionModal({ type, room });
  }

  async function confirmAction() {
    if (!codeInput.trim()) {
      setModalError('Ingresa tu código de credencial.');
      return;
    }
    setSubmitting(true);
    setModalError('');
    try {
      const path = actionModal.type === 'claim' ? 'claim' : 'finish';
      const updated = await api(`/housekeeping/${HOTEL_SLUG}/${path}`, {
        method: 'POST',
        body: JSON.stringify({ roomId: actionModal.room.id, code: codeInput.trim() }),
      });
      setRooms(updated);
      showToast(
        actionModal.type === 'claim'
          ? `Tomaste la habitación ${actionModal.room.number}`
          : `Habitación ${actionModal.room.number} lista`,
      );
      setActionModal(null);
    } catch (err) {
      setModalError(err.message || 'No se pudo completar la acción');
    } finally {
      setSubmitting(false);
    }
  }

  const pending = rooms.filter((r) => r.status === 'pendiente_limpieza');
  const inProgress = rooms.filter((r) => r.status === 'limpieza');

  return (
    <div className="hk-wrap">
      <div className="hk-header">
        <div>
          <div className="hk-greeting">Limpieza</div>
          <div className="hk-subtitle">Hotel Lilax</div>
        </div>
      </div>

      <div className="hk-section">
        <div className="hk-section-title">Por limpiar</div>
        {loading && <div className="hk-empty">Cargando...</div>}
        {!loading && pending.length === 0 && (
          <div className="hk-empty">No hay habitaciones pendientes ahora mismo.</div>
        )}
        {pending.map((r) => (
          <div className="hk-room-card" key={r.id}>
            <div>
              <div className="hk-room-number">Habitación {r.number}</div>
              <div className="hk-room-category">{r.category}</div>
            </div>
            <button className="hk-btn-claim" onClick={() => openAction('claim', r)}>
              Tomar habitación
            </button>
          </div>
        ))}
      </div>

      {inProgress.length > 0 && (
        <div className="hk-section">
          <div className="hk-section-title">En limpieza ahora</div>
          {inProgress.map((r) => (
            <div className="hk-room-card mine" key={r.id}>
              <div>
                <div className="hk-room-number">Habitación {r.number}</div>
                <div className="hk-room-category">{r.category} · {r.cleaningStaffName}</div>
              </div>
              <button className="hk-btn-finish" onClick={() => openAction('finish', r)}>
                Terminé de limpiar
              </button>
            </div>
          ))}
        </div>
      )}

      {actionModal && (
        <div className="hk-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setActionModal(null); }}>
          <div className="hk-modal">
            <div className="hk-modal-title">
              {actionModal.type === 'claim' ? 'Tomar habitación' : 'Terminar limpieza'} {actionModal.room.number}
            </div>
            <div className="hk-modal-sub">Escanea tu credencial o escribe tu código para confirmar.</div>
            {modalError && <div className="hk-error">{modalError}</div>}
            <input
              className="hk-code-input"
              placeholder="Código de tu credencial"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') confirmAction(); }}
            />
            <div className="hk-modal-actions">
              <button className="hk-btn-cancel" onClick={() => setActionModal(null)}>Cancelar</button>
              <button className="hk-btn-primary" disabled={submitting} onClick={confirmAction}>
                {submitting ? 'Confirmando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={'hk-toast' + (toast ? ' show' : '')}>{toast}</div>
    </div>
  );
}
