import React from 'react';
import Nav from './components/Nav.jsx';
import Hero from './components/Hero.jsx';
import StatBanner from './components/StatBanner.jsx';
import FeatureRow from './components/FeatureRow.jsx';
import AppleDivider from './components/AppleDivider.jsx';
import HotelesSection from './components/HotelesSection.jsx';
import ValueSection from './components/ValueSection.jsx';
import { ContactCta, Footer } from './components/Footer.jsx';

export default function App() {
  return (
    <div>
      <Nav />
      <Hero />
      <StatBanner />

      <FeatureRow
        id="menu"
        eyebrow="Gastronomía"
        title="Una experiencia de principio a fin"
        desc="Todos nuestros moteles cuentan con variedad de platos y bebidas de primera, para que tu hospedaje sea toda una experiencia de principio a fin."
        ctaLabel="Ver menú"
        ctaHref="#menu"
        icon={
          <svg viewBox="0 0 48 48" fill="none">
            <path
              d="M14 6v14a6 6 0 0 0 12 0V6M20 6v14M8 6v10c0 3 2 5 4 5M34 6c-3 0-6 3-6 8s2 8 6 10v18"
              stroke="#CBA135"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        }
      />

      <FeatureRow
        id="habitaciones"
        reverse
        eyebrow="Impecables"
        title="Sanitización de alto nivel"
        desc="Todas nuestras habitaciones son sometidas a un estricto proceso de sanitización propio de las más grandes cadenas hoteleras, ofreciéndote así un hospedaje confortable del más alto nivel."
        ctaLabel="Ver habitaciones"
        ctaHref="#habitaciones"
        icon={
          <svg viewBox="0 0 48 48" fill="none">
            <rect x="8" y="12" width="32" height="24" rx="2" stroke="#4C7A57" strokeWidth="1.5" />
            <path d="M8 20h32" stroke="#4C7A57" strokeWidth="1.5" />
          </svg>
        }
      />

      <AppleDivider color="#CBA135" curveUp />

      <HotelesSection />

      <AppleDivider color="#4C7A57" curveUp={false} />

      <ValueSection />

      <ContactCta />
      <Footer />
    </div>
  );
}
