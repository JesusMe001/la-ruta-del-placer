# La Ruta del Placer / Hotel Lilax — Frontend (proyecto único)

Un solo proyecto React (Vite) con **tres páginas independientes**:

| Página | URL en desarrollo | Qué es |
|---|---|---|
| Landing de la cadena | `http://localhost:5173/` | Sitio de La Ruta del Placer (marca Extasis), contenido real tomado de larutadelplacer.ec |
| Panel de cajera | `http://localhost:5173/cajera.html` | App conectada al backend de Hotel Lilax: login, mapa de habitaciones, check-in/out, consumo, cobro |
| Menú del huésped | `http://localhost:5173/menu.html?code=<qr_code>` | Página pública que se abre al escanear el QR físico de la habitación |
| Administración | `http://localhost:5173/admin.html` | Solo admin/supervisor: crear cajeras, dashboard en tiempo real e histórico |

## Arrancar en local

El panel de cajera y el menú del huésped requieren el backend (`lilax-backend`)
corriendo en `http://localhost:3000` (vía `docker compose up -d`). La landing no
necesita backend, es contenido estático.

```bash
npm install
npm run dev
```

## Estructura

```
index.html          → landing de la cadena (entry: src/landing-main.jsx)
cajera.html          → panel de cajera (entry: src/cajera-main.jsx)
menu.html            → menú del huésped (entry: src/menu-main.jsx)

src/
  api.js                    cliente fetch centralizado (agrega el JWT automáticamente)

  cajera-main.jsx           entry point del panel de cajera
  App.jsx                   orquesta login, mapa de habitaciones y modales
  styles.css                tokens de diseño de Lilax (morado/dorado/turquesa)
  components/               Login, RoomCard, CashSessionModal, CheckInModal, RentalModal, PaymentModal

  menu-main.jsx             entry point del menú del huésped
  guest-menu.css            estilos de esa página (reutiliza paleta Lilax)
  pages/
    GuestMenu.jsx

  landing-main.jsx          entry point de la landing de la cadena
  landing/
    LandingApp.jsx           ensambla todas las secciones
    landing-styles.css       tokens de diseño de la cadena (rojo/dorado/verde, serif)
    components/
      Nav.jsx, Hero.jsx, StatBanner.jsx, FeatureRow.jsx, AppleDivider.jsx,
      HotelesSection.jsx, ValueSection.jsx, Footer.jsx

public/
  logo.png                  logo de Lilax (panel de cajera / menú del huésped)
  extasis-logo.png          logo de Extasis (landing)
  lilax-logo.png             logo de Lilax (tarjeta de destino en la landing)
```

## Por qué está todo junto

Aunque conceptualmente son sitios distintos (uno es el dominio raíz de la cadena,
otro es el subdominio operativo de Hotel Lilax), viven en el mismo proyecto para
que sea más fácil de mantener mientras el negocio es chico. Cuando la cadena
crezca a los otros 13 puntos, cada página se puede separar a su propio despliegue
sin tener que reescribir nada — cada `*.html` ya es independiente en el build.

## Notas

- El slug de hotel para el panel de cajera está fijo en `HOTEL_SLUG = 'lilax'`
  dentro de `App.jsx`.
- El copy de la landing se tomó directamente del sitio real; ajusta los
  componentes de `landing/components/` si el contenido oficial cambia.
- La paleta de la landing (rojo/dorado/verde) es una aproximación fiel al logo
  de Extasis — si tienen la guía de marca o el CSS original, se puede afinar a
  los hex exactos.
