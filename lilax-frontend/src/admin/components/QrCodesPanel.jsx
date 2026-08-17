import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import { api } from '../../api.js';

export default function QrCodesPanel({ hotelId, hotelName, notify }) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [baseUrl, setBaseUrl] = useState(window.location.origin);
  const [qrImages, setQrImages] = useState({}); // roomId -> dataURL
  const [generating, setGenerating] = useState(false);
  const [buildingPdf, setBuildingPdf] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await api(`/hotels/${hotelId}/rooms`);
      setRooms(data);
    } catch (err) {
      notify('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [hotelId]); // eslint-disable-line react-hooks/exhaustive-deps

  function targetUrl(room) {
    return `${baseUrl.replace(/\/$/, '')}/menu.html?code=${room.qrCode}`;
  }

  async function generateAll() {
    if (rooms.length === 0) return;
    setGenerating(true);
    try {
      const entries = await Promise.all(
        rooms.map(async (room) => {
          const dataUrl = await QRCode.toDataURL(targetUrl(room), {
            width: 400,
            margin: 1,
            color: { dark: '#1B1025', light: '#FFFFFF' },
          });
          return [room.id, dataUrl];
        }),
      );
      setQrImages(Object.fromEntries(entries));
    } catch (err) {
      notify('No se pudieron generar los códigos QR');
    } finally {
      setGenerating(false);
    }
  }

  useEffect(() => {
    if (rooms.length > 0) generateAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rooms, baseUrl]);

  function downloadPng(room) {
    const dataUrl = qrImages[room.id];
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `qr-lilax-habitacion-${room.number}.png`;
    a.click();
  }

  async function downloadAllPdf() {
    if (Object.keys(qrImages).length === 0) return;
    setBuildingPdf(true);
    try {
      const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
      const cols = 2;
      const cellW = 95;
      const cellH = 110;
      const marginX = 10;
      const marginY = 12;
      const qrSize = 70;

      rooms.forEach((room, i) => {
        const perPage = 4; // 2x2 por hoja
        const posInPage = i % perPage;
        if (i > 0 && posInPage === 0) pdf.addPage();

        const col = posInPage % cols;
        const row = Math.floor(posInPage / cols);
        const x = marginX + col * cellW;
        const y = marginY + row * cellH;

        pdf.setDrawColor(200);
        pdf.roundedRect(x, y, cellW - 10, cellH - 10, 3, 3);

        const img = qrImages[room.id];
        if (img) {
          const qrX = x + (cellW - 10 - qrSize) / 2;
          pdf.addImage(img, 'PNG', qrX, y + 8, qrSize, qrSize);
        }

        pdf.setFontSize(16);
        pdf.setTextColor(20);
        pdf.text(`Habitación ${room.number}`, x + (cellW - 10) / 2, y + qrSize + 20, { align: 'center' });

        pdf.setFontSize(9);
        pdf.setTextColor(120);
        pdf.text('Escanea para ver el menú', x + (cellW - 10) / 2, y + qrSize + 27, { align: 'center' });
      });

      pdf.save(`codigos-qr-${hotelName || 'hotel'}.pdf`);
    } catch (err) {
      notify('No se pudo generar el PDF');
    } finally {
      setBuildingPdf(false);
    }
  }

  return (
    <div className="panel-card">
      <h2 className="panel-title">Códigos QR de habitaciones</h2>
      <div className="panel-desc">
        Cada código apunta a la página del menú del huésped para esa habitación específica.
        Verifica que la URL base sea la correcta antes de imprimir (en producción debería ser tu dominio real,
        ej. <span className="mono">https://lilax.larutadelplacer.ec</span>).
      </div>

      <div className="field" style={{ maxWidth: 420 }}>
        <label>URL base</label>
        <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
      </div>

      <div className="row-between" style={{ margin: '16px 0' }}>
        <span className="mono" style={{ fontSize: 12, color: 'var(--text-dim)' }}>
          {generating ? 'Generando códigos...' : `${rooms.length} habitación(es)`}
        </span>
        <button
          className="btn-small primary"
          onClick={downloadAllPdf}
          disabled={buildingPdf || generating || rooms.length === 0}
        >
          {buildingPdf ? 'Generando PDF...' : '⬇ Descargar todos (PDF)'}
        </button>
      </div>

      {loading ? (
        <div className="empty-note">Cargando...</div>
      ) : rooms.length === 0 ? (
        <div className="empty-note">Aún no hay habitaciones creadas.</div>
      ) : (
        <div className="qr-grid">
          {rooms.map((room) => (
            <div className="qr-card" key={room.id}>
              <div className="qr-room-number">Habitación {room.number}</div>
              <div className="qr-room-category">{room.category?.name || ''}</div>
              {qrImages[room.id] ? (
                <img src={qrImages[room.id]} alt={`QR habitación ${room.number}`} className="qr-image" />
              ) : (
                <div className="qr-placeholder">Generando...</div>
              )}
              <button className="btn-tiny" onClick={() => downloadPng(room)} disabled={!qrImages[room.id]}>
                Descargar PNG
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
