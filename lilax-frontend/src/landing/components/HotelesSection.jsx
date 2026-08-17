import React from 'react';

export default function HotelesSection() {
  return (
    <section className="section" id="hoteles">
      <div className="section-head">
        <div className="section-eyebrow">Nuestros hoteles</div>
        <h2 className="section-title serif">Cada casa, su propio carácter</h2>
        <p className="section-desc">
          Un mismo estándar de privacidad y servicio, con identidad propia en cada uno de los 14 puntos de la ruta.
        </p>
      </div>
      <div className="dest-grid">
        <div className="dest-card flagship">
          <img className="dest-logo" src="/extasis-logo.png" alt="Extasis" />
          <div className="dest-tag">Buque insignia</div>
          <div className="dest-name serif">Extasis</div>
          <div className="dest-desc">El motel más reconocido de la cadena — el punto de partida de La Ruta del Placer.</div>
          <a className="dest-link" href="#trabajo">Cómo llegar →</a>
        </div>
        <div className="dest-card">
          <img className="dest-logo" src="/lilax-logo.png" alt="Lilax" />
          <div className="dest-tag">Ahora disponible</div>
          <div className="dest-name serif">Hotel Lilax</div>
          <div className="dest-desc">Habitaciones renovadas y un sistema de atención más ágil para tu llegada.</div>
          <a className="dest-link" href="https://lilax.larutadelplacer.ec" target="_blank" rel="noopener noreferrer">
            Visitar sitio →
          </a>
        </div>
        <div className="dest-card soon">
          <div className="dest-tag">12 puntos más</div>
          <div className="dest-name serif" style={{ fontSize: 22, color: 'var(--text-dim)' }}>Toda la ruta</div>
        </div>
      </div>
    </section>
  );
}
