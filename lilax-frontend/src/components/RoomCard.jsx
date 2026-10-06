import React, { useEffect, useState } from 'react';

const STATUS_COLOR = {
  libre: 'var(--teal)',
  ocupada: 'var(--gold)',
  tiempo_extra: 'var(--danger)',
  pendiente_limpieza: '#8A7FBF',
  limpieza: 'var(--sleep)',
  fuera_servicio: 'var(--sleep)',
};
const STATUS_LABEL = {
  libre: 'Libre',
  ocupada: 'Ocupada',
  tiempo_extra: 'Tiempo extra',
  pendiente_limpieza: 'Por limpiar',
  limpieza: 'En limpieza',
  fuera_servicio: 'Fuera de servicio',
};

function useCountdown(expectedIso) {
  const [text, setText] = useState('--:--');
  useEffect(() => {
    if (!expectedIso) return;
    function tick() {
      const diff = new Date(expectedIso).getTime() - Date.now();
      const abs = Math.abs(diff);
      const h = Math.floor(abs / 3600000);
      const m = Math.floor((abs % 3600000) / 60000);
      setText((diff < 0 ? '+' : '') + String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0'));
    }
    tick();
    const id = setInterval(tick, 15000);
    return () => clearInterval(id);
  }, [expectedIso]);
  return text;
}

export default function RoomCard({ room, rental, onClick }) {
  const status = rental ? rental.status : room.status;
  const color = STATUS_COLOR[status] || 'var(--border)';
  const countdown = useCountdown(rental?.expectedCheckout);

  return (
    <div className="keytag" style={{ '--st-color': color }} onClick={onClick}>
      <div className="hole" />
      <div className="num">{room.number}</div>
      <div className="cat">{room.category ? room.category.name : ''}</div>
      <div className="status-label">{STATUS_LABEL[status] || status}</div>
      {rental && <div className="timer">{countdown}</div>}
    </div>
  );
}
