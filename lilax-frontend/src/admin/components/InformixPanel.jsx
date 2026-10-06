import React, { useEffect, useState } from 'react';
import { api } from '../../api.js';

export default function InformixPanel({ hotelId, notify }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [lastResult, setLastResult] = useState(null);

  async function loadStatus() {
    setLoading(true);
    try {
      const s = await api(`/hotels/${hotelId}/informix/status`);
      setStatus(s);
    } catch (err) {
      notify('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadStatus(); }, [hotelId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function runAction(key, path, method = 'GET') {
    setBusy(key);
    setLastResult(null);
    try {
      const result = await api(`/hotels/${hotelId}/informix/${path}`, { method });
      setLastResult({ key, ok: true, data: result });
      notify(key + ' — listo');
    } catch (err) {
      setLastResult({ key, ok: false, data: err.message });
      notify('Error en ' + key + ': ' + err.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="panel-card">
      <h2 className="panel-title">Integración Informix</h2>
      <div className="panel-desc">
        Conexión de solo lectura al ERP existente + espejo de pedidos en tiempo real hacia sus
        tablas <span className="mono">lilax_*</span>. Corre las acciones en orden: primero importar
        habitaciones reales, luego subir habitaciones y productos hacia Informix.
      </div>

      {loading ? (
        <div className="empty-note">Cargando...</div>
      ) : status?.configured ? (
        <div className="gw-not-configured" style={{ background: 'rgba(23,163,152,0.10)', borderColor: 'rgba(23,163,152,0.3)' }}>
          <div style={{ fontWeight: 600, color: 'var(--teal)' }}>✓ Configurado — listo para conectar</div>
        </div>
      ) : (
        <div className="gw-not-configured">
          <div style={{ fontWeight: 600, marginBottom: 6 }}>No configurado todavía</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-dim)', marginBottom: 8 }}>Falta:</div>
          <ul style={{ margin: '0 0 4px 18px', fontSize: 12.5, color: 'var(--text-dim)' }}>
            {status?.missing?.map((m) => <li key={m} className="mono">{m}</li>)}
          </ul>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 18 }}>
        <button className="btn-small" onClick={loadStatus}>Refrescar estado</button>
        <button className="btn-small primary" disabled={busy} onClick={() => runAction('test', 'test')}>
          {busy === 'test' ? '...' : 'Probar conexión'}
        </button>
        <button className="btn-small primary" disabled={busy} onClick={() => runAction('rooms', 'rooms?sucursal=924')}>
          {busy === 'rooms' ? '...' : 'Ver habitaciones reales'}
        </button>
        <button className="btn-small primary" disabled={busy} onClick={() => runAction('import-rooms', 'import-rooms?sucursal=924', 'POST')}>
          {busy === 'import-rooms' ? '...' : '1. Importar habitaciones + tarifas'}
        </button>
        <button className="btn-small primary" disabled={busy} onClick={() => runAction('import-products', 'import-products?sucursal=924&bodega=3', 'POST')}>
          {busy === 'import-products' ? '...' : '2. Importar productos reales (menú + precios)'}
        </button>
        <button className="btn-small primary" disabled={busy} onClick={() => runAction('push-rooms', 'push-rooms', 'POST')}>
          {busy === 'push-rooms' ? '...' : '3. Subir habitaciones a Informix'}
        </button>
        <button className="btn-small primary" disabled={busy} onClick={() => runAction('push-products', 'push-products', 'POST')}>
          {busy === 'push-products' ? '...' : '4. Subir productos a Informix'}
        </button>
      </div>

      {lastResult && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: lastResult.ok ? 'var(--teal)' : 'var(--danger)', marginBottom: 8 }}>
            {lastResult.ok ? '✓ Resultado de ' : '✗ Error en '}{lastResult.key}
          </div>
          <pre className="mono" style={{
            background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10,
            padding: 14, fontSize: 11.5, overflowX: 'auto', maxHeight: 320, overflowY: 'auto',
          }}>
            {typeof lastResult.data === 'string' ? lastResult.data : JSON.stringify(lastResult.data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
