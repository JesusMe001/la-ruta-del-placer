import React from 'react';

export default function AppleDivider({ color = '#CBA135', curveUp = true }) {
  const path = curveUp
    ? 'M0,35 C 200,70 300,0 550,35 C 800,70 900,0 1100,35'
    : 'M0,35 C 200,0 300,70 550,35 C 800,0 900,70 1100,35';
  return (
    <div className="apple-divider">
      <svg viewBox="0 0 1100 70" preserveAspectRatio="none">
        <path d={path} stroke={color} strokeWidth="1" fill="none" opacity="0.4" />
      </svg>
    </div>
  );
}
