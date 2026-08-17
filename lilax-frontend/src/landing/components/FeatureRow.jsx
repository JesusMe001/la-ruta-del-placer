import React from 'react';

export default function FeatureRow({ id, reverse, eyebrow, title, desc, ctaLabel, ctaHref, icon }) {
  return (
    <div className={'feature-row' + (reverse ? ' reverse' : '')} id={id}>
      <div className="feature-text">
        <div className="feature-eyebrow">{eyebrow}</div>
        <div className="feature-title serif">{title}</div>
        <div className="feature-desc">{desc}</div>
        <a className="btn btn-primary" href={ctaHref}>{ctaLabel}</a>
      </div>
      <div className="feature-visual">{icon}</div>
    </div>
  );
}
