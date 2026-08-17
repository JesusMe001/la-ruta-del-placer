import React from 'react';

export default function Hero() {
  return (
    <section className="hero" id="inicio">
      <svg className="apple-watermark" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M100 40c-6-14-22-22-38-18 4 16 18 26 34 24-4 12-16 20-30 20-30 0-54 26-54 62 0 40 28 76 54 76 12 0 18-8 34-8s22 8 34 8c24 0 50-32 54-70-20-6-34-24-34-46 0-20 12-36 28-44-8-14-24-22-40-20-10 1-18 6-24 12-4-8-10-14-14-16z"
          fill="#B23A3A"
        />
      </svg>
      <div className="eyebrow">Un símbolo que marca la diferencia</div>
      <h1 className="hero-title">
        Sigue <em>la ruta</em>
        <br />
        del placer.
      </h1>
      <p className="hero-sub">
        Somos un referente en Guayaquil. Extasis es la más grande cadena de moteles del Ecuador — marcamos
        diferencia e imponemos tendencias. <strong>14 puntos estratégicos</strong> forman parte de la ruta del
        placer. ¡Descúbrelos!
      </p>
      <a className="btn btn-primary" href="#hoteles">Ver moteles Extasis</a>
      <a className="btn btn-outline" href="#habitaciones">Ver habitaciones</a>
    </section>
  );
}
