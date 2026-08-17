import React, { useEffect, useState } from 'react';
import { api } from '../../api.js';

export default function LoyaltyPanel({ hotelId, notify }) {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [gwStatus, setGwStatus] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [cfg, status] = await Promise.all([
        api(`/hotels/${hotelId}/loyalty/config`),
        api(`/hotels/${hotelId}/loyalty/google-wallet-status`),
      ]);
      setConfig(cfg);
      setGwStatus(status);
    } catch (err) {
      notify('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [hotelId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await api(`/hotels/${hotelId}/loyalty/config`, {
        method: 'PUT',
        body: JSON.stringify({
          programName: config.programName,
          discountLabel: config.discountLabel,
          highlightProductType: config.highlightProductType || null,
          backgroundColor: config.backgroundColor,
          active: config.active,
        }),
      });
      setConfig(updated);
      setPreviewUrl(null);
      notify('Tarjeta actualizada');
    } catch (err) {
      notify('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handlePreview() {
    setPreviewLoading(true);
    setPreviewUrl(null);
    try {
      const res = await api(`/hotels/${hotelId}/loyalty/preview`, { method: 'POST' });
      if (res.configured) {
        setPreviewUrl(res.saveUrl);
      } else {
        notify('Google Wallet no está configurado todavía en el servidor');
      }
    } catch (err) {
      notify('Error: ' + err.message);
    } finally {
      setPreviewLoading(false);
    }
  }

  if (loading || !config) return <div className="panel-card"><div className="empty-note">Cargando...</div></div>;

  return (
    <>
      <div className="panel-card">
        <h2 className="panel-title">Tarjeta de fidelización</h2>
        <div className="panel-desc">
          Configura el contenido de la tarjeta que los clientes podrán guardar en Google Wallet.
          Por ahora solo se parametriza el contenido — el envío/inscripción de clientes se agrega después.
        </div>

        <form className="loyalty-form" onSubmit={handleSave}>
          <div className="field">
            <label>Nombre del programa</label>
            <input
              value={config.programName}
              onChange={(e) => setConfig({ ...config, programName: e.target.value })}
              maxLength={80}
              required
            />
          </div>
          <div className="field">
            <label>Beneficio / descuento</label>
            <input
              value={config.discountLabel}
              onChange={(e) => setConfig({ ...config, discountLabel: e.target.value })}
              placeholder="ej. 10% de descuento en tu próxima estadía"
              maxLength={120}
              required
            />
          </div>
          <div className="field">
            <label>Tipo de producto que destaca (opcional)</label>
            <input
              value={config.highlightProductType || ''}
              onChange={(e) => setConfig({ ...config, highlightProductType: e.target.value })}
              placeholder="ej. Bebidas, Juguetes, Toda la cuenta"
              maxLength={80}
            />
          </div>
          <div className="field">
            <label>Color de fondo de la tarjeta</label>
            <div className="color-row">
              <input
                type="color"
                value={config.backgroundColor}
                onChange={(e) => setConfig({ ...config, backgroundColor: e.target.value })}
              />
              <span className="mono">{config.backgroundColor}</span>
            </div>
          </div>
          <label className="active-toggle">
            <input
              type="checkbox"
              checked={config.active}
              onChange={(e) => setConfig({ ...config, active: e.target.checked })}
            />
            Programa activo
          </label>

          <button className="btn-small primary" type="submit" disabled={saving} style={{ marginTop: 6 }}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </form>
      </div>

      <div className="panel-card">
        <h2 className="panel-title">Vista previa</h2>

        {gwStatus && !gwStatus.configured && (
          <div className="gw-not-configured">
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Google Wallet aún no está configurado</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-dim)', marginBottom: 8 }}>
              Falta completar en el servidor:
            </div>
            <ul style={{ margin: '0 0 10px 18px', fontSize: 12.5, color: 'var(--text-dim)' }}>
              {gwStatus.missing.map((m) => <li key={m} className="mono">{m}</li>)}
            </ul>
            <div style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>
              El contenido de la tarjeta ya se puede parametrizar y se guarda normal — esto solo bloquea
              el botón real de "Agregar a Google Wallet" hasta que se complete la configuración del emisor.
            </div>
          </div>
        )}

        {gwStatus && gwStatus.configured && (
          <>
            <button className="btn-small primary" onClick={handlePreview} disabled={previewLoading}>
              {previewLoading ? 'Generando...' : 'Generar vista previa'}
            </button>
            {previewUrl && (
              <div style={{ marginTop: 14 }}>
                <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="google-wallet-btn">
                  Agregar a Google Wallet
                </a>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
