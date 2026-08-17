import React from 'react';

const VALUES = [
  {
    title: 'Hospedaje impecable',
    color: '#4C7A57',
    icon: <path d="M24 8c8 6 14 12 14 20a14 14 0 1 1-28 0c0-8 6-14 14-20z" stroke="#4C7A57" strokeWidth="1.5" />,
  },
  {
    title: '100% privacidad',
    color: '#B23A3A',
    icon: (
      <>
        <rect x="10" y="14" width="28" height="20" rx="2" stroke="#B23A3A" strokeWidth="1.5" />
        <path d="M10 20h28" stroke="#B23A3A" strokeWidth="1.5" />
      </>
    ),
  },
  {
    title: 'Seguridad 24/7',
    color: '#CBA135',
    icon: (
      <>
        <circle cx="24" cy="24" r="20" stroke="#CBA135" strokeWidth="1.5" />
        <path d="M24 14v10l7 5" stroke="#CBA135" strokeWidth="1.5" strokeLinecap="round" />
      </>
    ),
  },
  {
    title: 'Servicio de alimentación',
    color: '#D5654F',
    icon: <path d="M14 6v14a6 6 0 0 0 12 0V6M20 6v14" stroke="#D5654F" strokeWidth="1.5" strokeLinecap="round" />,
  },
];

export default function ValueSection() {
  return (
    <section className="section">
      <div className="section-head">
        <div className="section-eyebrow">Oferta de valor</div>
        <h2 className="section-title serif">En Extasis nos esforzamos cada día</h2>
        <p className="section-desc">Para que tu experiencia sea inmejorable.</p>
      </div>
      <div className="value-grid">
        {VALUES.map((v) => (
          <div className="value-item" key={v.title}>
            <svg className="value-icon" viewBox="0 0 48 48" fill="none">{v.icon}</svg>
            <div className="value-title serif">{v.title}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
