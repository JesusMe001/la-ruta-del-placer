import React from 'react';

export function ContactCta() {
  return (
    <div className="contact-cta" id="trabajo">
      <div className="contact-title serif">¿Tienes algo que decirnos?</div>
      <a className="btn btn-primary" href="mailto:contacto@larutadelplacer.ec">Contáctanos</a>
    </div>
  );
}

export function Footer() {
  return (
    <footer>
      <div className="foot-brand serif">La Ruta del Placer</div>
      <div className="social-row">
        <a href="https://www.facebook.com/motelesextasis" target="_blank" rel="noopener noreferrer" aria-label="Facebook">FB</a>
        <a href="https://www.instagram.com/motelesextasis" target="_blank" rel="noopener noreferrer" aria-label="Instagram">IG</a>
        <a href="https://www.twitter.com/motelesextasis" target="_blank" rel="noopener noreferrer" aria-label="Twitter">TW</a>
      </div>
      <div className="foot-note">© 2026 La Ruta del Placer — Moteles Extasis, Ecuador. Todos los derechos reservados.</div>
    </footer>
  );
}
