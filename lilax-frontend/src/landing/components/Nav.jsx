import React from 'react';

const LINKS = [
  { href: '#inicio', label: 'Inicio' },
  { href: '#hoteles', label: 'Hoteles' },
  { href: '#habitaciones', label: 'Habitaciones' },
  { href: '#menu', label: 'Menú' },
  { href: '#juguetes', label: 'Juguetes' },
  { href: '#trabajo', label: 'Trabajo' },
];

export default function Nav() {
  return (
    <nav>
      <div className="nav-brand">
        <img src="/extasis-logo.png" alt="La Ruta del Placer" />
        LA RUTA DEL PLACER
      </div>
      <div className="nav-links">
        {LINKS.map((l) => (
          <a key={l.href} href={l.href}>{l.label}</a>
        ))}
      </div>
    </nav>
  );
}
