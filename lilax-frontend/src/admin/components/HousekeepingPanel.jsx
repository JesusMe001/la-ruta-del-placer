import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { api } from '../../api.js';

export default function HousekeepingPanel({ hotelId, notify }) {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [badgeStaff, setBadgeStaff] = useState(null);
  const [badgeImg, setBadgeImg] = useState(null);
  const [baseUrl] = useState(window.location.origin);

  async function load() {
    setLoading(true);
    try {
      const data = await api(`/hotels/${hotelId}/housekeeping-staff`);
      setStaff(data);
    } catch (err) {
      notify('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [hotelId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await api(`/hotels/${hotelId}/housekeeping-staff`, {
        method: 'POST',
        body: JSON.stringify({ name: name.trim() }),
      });
      setName('');
      notify('Personal agregado');
      load();
    } catch (err) {
      notify('Error: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(person) {
    try {
      await api(`/hotels/${hotelId}/housekeeping-staff/${person.id}/active`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !person.active }),
      });
      load();
    } catch (err) {
      notify('Error: ' + err.message);
    }
  }

  async function showBadge(person) {
    setBadgeStaff(person);
    const url = `${baseUrl.replace(/\/$/, '')}/housekeeping.html?code=${person.code}`;
    const dataUrl = await QRCode.toDataURL(url, {
      width: 320,
      margin: 1,
      color: { dark: '#1B1025', light: '#FFFFFF' },
    });
    setBadgeImg(dataUrl);
  }

  function downloadBadge() {
    if (!badgeImg || !badgeStaff) return;
    const a = document.createElement('a');
    a.href = badgeImg;
    a.download = `credencial-limpieza-${badgeStaff.name.replace(/\s+/g, '-')}.png`;
    a.click();
  }

  return (
    <div className="panel-card">
      <h2 className="panel-title">Personal de limpieza</h2>
      <div className="panel-desc">
        Cada persona tiene una credencial personal (código único). Genera su QR, imprímelo o pásaselo
        digital — al escanearlo entra directo a la página de limpieza identificado con su nombre.
      </div>

      <form className="user-form" onSubmit={handleCreate}>
        <div className="form-row">
          <input
            placeholder="Nombre completo"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <button className="btn-small primary" type="submit" disabled={submitting}>
            {submitting ? 'Agregando...' : '+ Agregar'}
          </button>
        </div>
      </form>

      {loading ? (
        <div className="empty-note">Cargando...</div>
      ) : staff.length === 0 ? (
        <div className="empty-note">Aún no hay personal de limpieza registrado.</div>
      ) : (
        <table className="data-table">
          <thead><tr><th>Nombre</th><th>Código</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {staff.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td className="mono">{p.code}</td>
                <td>
                  <span className={'status-tag ' + (p.active ? 'ok' : 'off')}>
                    {p.active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td style={{ display: 'flex', gap: 6 }}>
                  <button className="btn-tiny" onClick={() => showBadge(p)}>Ver credencial</button>
                  <button className="btn-tiny" onClick={() => toggleActive(p)}>
                    {p.active ? 'Desactivar' : 'Activar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {badgeStaff && (
        <div className="badge-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setBadgeStaff(null); }}>
          <div className="badge-modal">
            <div className="badge-name">{badgeStaff.name}</div>
            <div className="badge-code mono">{badgeStaff.code}</div>
            {badgeImg && <img src={badgeImg} alt="Credencial" className="badge-qr-img" />}
            <div className="badge-actions">
              <button className="btn-small" onClick={() => setBadgeStaff(null)}>Cerrar</button>
              <button className="btn-small primary" onClick={downloadBadge}>Descargar PNG</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
