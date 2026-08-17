import React, { useEffect, useState } from 'react';
import { api } from '../../api.js';

export default function NetworkPanel({ hotelId, notify }) {
  const [networks, setNetworks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cidr, setCidr] = useState('');
  const [label, setLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [detecting, setDetecting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await api(`/hotels/${hotelId}/allowed-networks`);
      setNetworks(data);
    } catch (err) {
      notify('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [hotelId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAdd(e) {
    e.preventDefault();
    if (!cidr.trim()) return;
    setSubmitting(true);
    try {
      await api(`/hotels/${hotelId}/allowed-networks`, {
        method: 'POST',
        body: JSON.stringify({ cidr: cidr.trim(), label: label.trim() || undefined }),
      });
      setCidr('');
      setLabel('');
      notify('Red agregada');
      load();
    } catch (err) {
      notify('Error: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(id) {
    try {
      await api(`/hotels/${hotelId}/allowed-networks/${id}`, { method: 'DELETE' });
      setNetworks((ns) => ns.filter((n) => n.id !== id));
      notify('Red eliminada');
    } catch (err) {
      notify('Error: ' + err.message);
    }
  }

  async function detectMyIp() {
    setDetecting(true);
    try {
      const res = await fetch('https://api.ipify.org?format=json');
      const data = await res.json();
      setCidr(`${data.ip}/32`);
    } catch (err) {
      notify('No se pudo detectar tu IP automáticamente');
    } finally {
      setDetecting(false);
    }
  }

  return (
    <div className="panel-card">
      <h2 className="panel-title">Red del hotel</h2>
      <div className="panel-desc">
        Solo los celulares/dispositivos conectados a estas redes podrán abrir el menú del huésped y hacer
        pedidos desde su cuarto. Mientras no agregues ninguna, se usa por defecto cualquier red wifi privada
        normal (192.168.x.x, 10.x.x.x, etc.) — si el wifi real del hotel usa un rango distinto, agrégalo aquí.
      </div>

      <form className="user-form" onSubmit={handleAdd}>
        <div className="form-row">
          <input
            placeholder="IP o rango CIDR, ej. 192.168.1.0/24"
            value={cidr}
            onChange={(e) => setCidr(e.target.value)}
            required
          />
          <input
            placeholder="Etiqueta (opcional), ej. Wifi recepción"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-small primary" type="submit" disabled={submitting}>
            {submitting ? 'Agregando...' : '+ Agregar red'}
          </button>
          <button className="btn-small" type="button" onClick={detectMyIp} disabled={detecting}>
            {detecting ? 'Detectando...' : 'Usar mi IP actual'}
          </button>
        </div>
      </form>

      {loading ? (
        <div className="empty-note">Cargando...</div>
      ) : networks.length === 0 ? (
        <div className="empty-note">Sin redes personalizadas — usando el rango por defecto.</div>
      ) : (
        <table className="data-table">
          <thead><tr><th>Red</th><th>Etiqueta</th><th></th></tr></thead>
          <tbody>
            {networks.map((n) => (
              <tr key={n.id}>
                <td className="mono">{n.cidr}</td>
                <td>{n.label || '-'}</td>
                <td>
                  <button className="btn-tiny" onClick={() => handleRemove(n.id)}>Quitar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
