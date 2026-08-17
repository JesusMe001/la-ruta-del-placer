import React, { useCallback, useEffect, useRef, useState } from 'react';
import Login from './components/Login.jsx';
import RoomCard from './components/RoomCard.jsx';
import CashSessionModal from './components/CashSessionModal.jsx';
import CloseSessionModal from './components/CloseSessionModal.jsx';
import CheckInModal from './components/CheckInModal.jsx';
import RentalModal from './components/RentalModal.jsx';
import { api } from './api.js';

const HOTEL_SLUG = 'lilax';

const PAYMENT_LABELS = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
  mixto: 'Mixto',
};

function Toast({ message }) {
  return <div className={'toast' + (message ? ' show' : '')}>{message}</div>;
}

function Sunburst() {
  const heights = [40, 65, 85, 100, 85, 65, 40, 55, 75, 95, 75, 55];
  return (
    <div className="sunburst-divider">
      {heights.map((h, i) => (
        <i key={i} style={{ height: h + '%' }} />
      ))}
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null); // { hotel, user }
  const [cashSessionId, setCashSessionId] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [products, setProducts] = useState([]);
  const [activeRentals, setActiveRentals] = useState({}); // roomId -> rental
  const [pendingDeliveries, setPendingDeliveries] = useState([]);
  const [checkoutRequests, setCheckoutRequests] = useState([]);
  const [toast, setToast] = useState('');
  const [modal, setModal] = useState(null); // { type: 'session'|'checkin'|'rental', room }
  const toastTimer = useRef(null);

  const notify = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2600);
  }, []);

  const loadRooms = useCallback(async (hotelId) => {
    try {
      const data = await api(`/hotels/${hotelId}/rooms`);
      setRooms(data);
    } catch (err) {
      notify('No se pudieron cargar las habitaciones: ' + err.message);
    }
  }, [notify]);

  const loadProducts = useCallback(async (hotelId) => {
    try {
      const data = await api(`/hotels/${hotelId}/products`);
      setProducts(data);
    } catch (err) {
      /* silencioso: no bloquea el panel */
    }
  }, []);

  const loadActiveRentals = useCallback(async (hotelId) => {
    try {
      const rentals = await api(`/rentals/active/${hotelId}`);
      const map = {};
      rentals.forEach((r) => { map[r.roomId] = r; });
      setActiveRentals(map);
    } catch (err) {
      /* silencioso */
    }
  }, []);

  const loadPendingDeliveries = useCallback(async (hotelId) => {
    try {
      const items = await api(`/rentals/pending-deliveries/${hotelId}`);
      setPendingDeliveries(items);
    } catch (err) {
      /* silencioso */
    }
  }, []);

  const loadCheckoutRequests = useCallback(async (hotelId) => {
    try {
      const items = await api(`/rentals/checkout-requests/${hotelId}`);
      setCheckoutRequests(items);
    } catch (err) {
      /* silencioso */
    }
  }, []);

  const refreshAll = useCallback(async () => {
    if (!session) return;
    await Promise.all([
      loadRooms(session.hotel.id),
      loadProducts(session.hotel.id),
      loadActiveRentals(session.hotel.id),
      loadPendingDeliveries(session.hotel.id),
      loadCheckoutRequests(session.hotel.id),
    ]);
  }, [session, loadRooms, loadProducts, loadActiveRentals, loadPendingDeliveries, loadCheckoutRequests]);

  useEffect(() => {
    if (!session) return;
    refreshAll();
    api(`/hotels/${session.hotel.id}/cash-sessions/current`)
      .then((current) => { if (current) setCashSessionId(current.id); })
      .catch(() => { /* si falla, se deja como cerrado */ });
    const roomsId = setInterval(() => loadActiveRentals(session.hotel.id), 30000);
    const deliveriesId = setInterval(() => {
      loadPendingDeliveries(session.hotel.id);
      loadCheckoutRequests(session.hotel.id);
    }, 12000);
    return () => { clearInterval(roomsId); clearInterval(deliveriesId); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  async function handleMarkDelivered(itemId) {
    try {
      await api(`/rentals/products/${itemId}/delivered`, { method: 'POST' });
      setPendingDeliveries((list) => list.filter((d) => d.id !== itemId));
    } catch (err) {
      notify('Error: ' + err.message);
    }
  }

  function handleAttendCheckoutRequest(req) {
    const room = rooms.find((r) => r.id === req.roomId);
    if (!room) return;
    setModal({ type: 'rental', room, rentalId: req.rentalId });
  }

  function handleLoggedIn(data) {
    setSession({ hotel: data.hotel, user: data.user });
  }

  function handleLogout() {
    setSession(null);
    setCashSessionId(null);
    setRooms([]);
    setActiveRentals({});
  }

  function handleRoomClick(room) {
    const rental = activeRentals[room.id];
    if (rental) {
      setModal({ type: 'rental', room, rentalId: rental.id });
    } else if (room.status === 'libre') {
      setModal({ type: 'checkin', room });
    } else if (room.status === 'limpieza') {
      handleMarkClean(room);
    } else {
      notify('Esta habitación no está disponible ahora mismo');
    }
  }

  async function handleMarkClean(room) {
    if (!window.confirm(`¿Marcar la habitación ${room.number} como LIBRE (limpieza terminada)?`)) return;
    try {
      await api(`/hotels/${session.hotel.id}/rooms/${room.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'libre' }),
      });
      notify('Habitación ' + room.number + ' lista');
      loadRooms(session.hotel.id);
    } catch (err) {
      notify('Error: ' + err.message);
    }
  }

  if (!session) {
    return <Login hotelSlug={HOTEL_SLUG} onLoggedIn={handleLoggedIn} />;
  }

  return (
    <div>
      <header className="topbar">
        <div className="brand">
          <img src="/logo.png" alt="Lilax" />
          <div className="name">HOTEL <span>LILAX</span></div>
        </div>
        <div className="topbar-right">
          <span className="mono" style={{ fontSize: 13, color: 'var(--text-dim)' }}>
            {session.user.fullName} · {session.user.role}
          </span>
          <div
            className={'pill ' + (cashSessionId ? 'pill-open pill-clickable' : 'pill-closed')}
            onClick={() => { if (cashSessionId) setModal({ type: 'closeSession' }); }}
            title={cashSessionId ? 'Clic para cerrar el turno' : ''}
          >
            <span className="dot" />
            <span>{cashSessionId ? 'Turno abierto' : 'Caja cerrada'}</span>
          </div>
          <button className="btn btn-secondary btn-auto" onClick={handleLogout}>Salir</button>
        </div>
      </header>

      {pendingDeliveries.length > 0 && (
        <div className="delivery-alerts">
          {pendingDeliveries.map((d) => (
            <div className="delivery-alert" key={d.id}>
              <div className="delivery-alert-icon">🛎️</div>
              <div className="delivery-alert-text">
                Llevar a <strong>Habitación {d.roomNumber}</strong>: {d.quantity}× {d.productName}
                <span className="mono" style={{ opacity: 0.7, marginLeft: 6 }}>({d.productCode})</span>
                {d.note && <div className="delivery-note">"{d.note}"</div>}
              </div>
              <button className="btn btn-teal btn-auto" onClick={() => handleMarkDelivered(d.id)}>
                Marcar entregado
              </button>
            </div>
          ))}
        </div>
      )}

      {checkoutRequests.length > 0 && (
        <div className="delivery-alerts">
          {checkoutRequests.map((r) => (
            <div className="checkout-alert" key={r.rentalId}>
              <div className="delivery-alert-icon">💳</div>
              <div className="delivery-alert-text">
                <strong>Habitación {r.roomNumber}</strong> pide la cuenta — método: {PAYMENT_LABELS[r.method] || r.method}
              </div>
              <button className="btn btn-primary btn-auto" onClick={() => handleAttendCheckoutRequest(r)}>
                Atender
              </button>
            </div>
          ))}
        </div>
      )}

      <main>
        <div className="row-between" style={{ marginBottom: 6 }}>
          <div className="section-title">Mapa de habitaciones</div>
          {!cashSessionId && (
            <button className="btn btn-teal btn-auto" onClick={() => setModal({ type: 'session' })}>
              Abrir turno de caja
            </button>
          )}
        </div>
        <Sunburst />

        <div className="legend">
          <div className="legend-item"><span className="legend-dot" style={{ background: 'var(--teal)' }} />Libre</div>
          <div className="legend-item"><span className="legend-dot" style={{ background: 'var(--gold)' }} />Ocupada</div>
          <div className="legend-item"><span className="legend-dot" style={{ background: 'var(--danger)' }} />Tiempo extra</div>
          <div className="legend-item"><span className="legend-dot" style={{ background: 'var(--sleep)' }} />Limpieza</div>
        </div>

        {rooms.length === 0 ? (
          <div className="empty-state">
            Aún no hay habitaciones cargadas para este hotel.<br />
            Créalas desde <span className="mono">POST /hotels/:hotelId/rooms</span> o Prisma Studio.
          </div>
        ) : (
          <div className="room-grid">
            {rooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                rental={activeRentals[room.id]}
                onClick={() => handleRoomClick(room)}
              />
            ))}
          </div>
        )}
      </main>

      {modal?.type === 'session' && (
        <CashSessionModal
          hotelId={session.hotel.id}
          onClose={() => setModal(null)}
          onOpened={(s) => { setCashSessionId(s.id); setModal(null); }}
          notify={notify}
        />
      )}

      {modal?.type === 'closeSession' && (
        <CloseSessionModal
          hotelId={session.hotel.id}
          cashSessionId={cashSessionId}
          onClose={() => setModal(null)}
          onClosed={() => { setCashSessionId(null); setModal(null); }}
          notify={notify}
        />
      )}

      {modal?.type === 'checkin' && (
        <CheckInModal
          room={modal.room}
          cashSessionId={cashSessionId}
          onClose={() => setModal(null)}
          onDone={() => { setModal(null); refreshAll(); }}
          notify={notify}
        />
      )}

      {modal?.type === 'rental' && (
        <RentalModal
          room={modal.room}
          rentalId={modal.rentalId}
          products={products}
          onClose={() => setModal(null)}
          onChanged={refreshAll}
          notify={notify}
        />
      )}

      <Toast message={toast} />
    </div>
  );
}
