import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

function money(n) {
  return '$' + Number(n).toFixed(2);
}

const PAYMENT_LABELS = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
  mixto: 'Mixto',
};

function getQrCode() {
  const params = new URLSearchParams(window.location.search);
  return params.get('code');
}

// El carrito se guarda en localStorage por habitación (código QR) para que
// no se borre si el huésped recarga la página o se le apaga la pantalla
// mientras arma su pedido.
function cartStorageKey(code) {
  return `lilax-cart-${code}`;
}

function loadStoredCart(code) {
  if (!code) return {};
  try {
    const raw = window.localStorage.getItem(cartStorageKey(code));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// Agrupa por categoría normalizando may/min y espacios (evita "Bebidas" y
// "BEBIDAS" apareciendo como dos categorías distintas por un dato sucio),
// pero conserva el nombre REAL tal como viene de la base (Informix), nunca
// una categoría inventada a partir de las carpetas de fotos.
function groupByCategoryNormalized(menu) {
  const order = [];
  const map = new Map();
  menu.forEach((item) => {
    const label = (item.category || 'Otros').trim();
    const key = label.toLowerCase();
    if (!map.has(key)) {
      map.set(key, { key, label, items: [] });
      order.push(key);
    }
    map.get(key).items.push(item);
  });
  return order.map((key) => map.get(key));
}

function Sunburst() {
  const heights = [40, 65, 85, 100, 85, 65, 40, 55, 75, 95];
  return (
    <div className="divider">
      {heights.map((h, i) => (
        <i key={i} style={{ height: h + '%' }} />
      ))}
    </div>
  );
}

const CATEGORY_ICONS = {
  bebidas: '🥤',
  comida: '🍔',
  alimentos: '🍔',
  aseo: '🧴',
  'aseo personal': '🧴',
  juguetes: '🎁',
  varios: '🛍️',
  preservativos: '💗',
  lubricantes: '💧',
  licores: '🥃',
  gaseosas: '🥤',
  energizantes: '⚡',
  cigarrillo: '🚬',
  cervezas: '🍺',
  'aguas y jugos': '🧃',
};

function iconForCategory(category) {
  const key = (category || '').trim().toLowerCase();
  return CATEGORY_ICONS[key] || '🛍️';
}

function ProductImage({ item, onClick }) {
  if (item.imageUrl) {
    return <img src={item.imageUrl} alt={item.name} className="product-image" onClick={onClick} />;
  }
  return (
    <div className="product-image product-image-placeholder" onClick={onClick}>
      {iconForCategory(item.category)}
    </div>
  );
}

function ProductRow({ item, cartQty, onIncrement, onDecrement, onImageClick }) {
  return (
    <div className="product-card">
      <ProductImage item={item} onClick={onImageClick} />
      <div className="product-body">
        <div className="product-top-row">
          <div className="name">{item.name}</div>
          <div className="qty-stepper compact">
            <button onClick={onDecrement} aria-label="Quitar" disabled={cartQty === 0}>−</button>
            <span>{cartQty}</span>
            <button onClick={onIncrement} aria-label="Agregar">+</button>
          </div>
        </div>
        <div className="unit-price">{money(item.price)} c/u</div>
      </div>
    </div>
  );
}

export default function GuestMenu() {
  const code = getQrCode();
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [toast, setToast] = useState('');
  const [flashId, setFlashId] = useState(null);
  const [search, setSearch] = useState('');
  const [requestingCheckout, setRequestingCheckout] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('efectivo');
  const [submittingCheckout, setSubmittingCheckout] = useState(false);
  const [billOpen, setBillOpen] = useState(false);
  const [zoomedItem, setZoomedItem] = useState(null);
  const [confirmSendOpen, setConfirmSendOpen] = useState(false);
  const [enteredMenu, setEnteredMenu] = useState(false);
  const [activeCategory, setActiveCategory] = useState(null); // null = ver todo el menú
  const [showAllCategories, setShowAllCategories] = useState(false);

  // carrito: { [productId]: { id, name, price, quantity, note } }
  // Se inicializa desde localStorage para que un refresh de página no borre
  // lo que el huésped ya había agregado.
  const [cart, setCart] = useState(() => loadStoredCart(code));
  const [cartOpen, setCartOpen] = useState(false);
  const [submittingCart, setSubmittingCart] = useState(false);

  // Cada cambio en el carrito se guarda de inmediato en localStorage.
  useEffect(() => {
    if (!code) return;
    try {
      if (Object.keys(cart).length === 0) {
        window.localStorage.removeItem(cartStorageKey(code));
      } else {
        window.localStorage.setItem(cartStorageKey(code), JSON.stringify(cart));
      }
    } catch {
      /* localStorage puede no estar disponible (modo privado, etc.) — no bloquea la app */
    }
  }, [cart, code]);

  function load() {
    if (!code) {
      setState({ loading: false, error: 'no-code', data: null });
      return;
    }
    api(`/qr/${code}`)
      .then((data) => setState({ loading: false, error: null, data }))
      .catch(() => setState((s) => ({ ...s, loading: false, error: 'not-found', data: null })));
  }

  useEffect(load, []);

  // Refresca solo la cuenta (sin tocar loading/menu) para que el estado de
  // "en camino" / entregado se actualice solo, sin que el huésped tenga que
  // recargar la página cuando la cajera marca un producto como entregado.
  function refreshAccount() {
    if (!code) return;
    api(`/qr/${code}`)
      .then((data) => setState((s) => (s.data ? { ...s, data: { ...s.data, account: data.account } } : s)))
      .catch(() => {});
  }

  useEffect(() => {
    if (!code) return;
    const id = setInterval(refreshAccount, 6000);
    return () => clearInterval(id);
  }, [code]);

  function openCategory(catKey) {
    setEnteredMenu(true);
    setActiveCategory(catKey);
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  }

  function incrementCart(item) {
    setCart((c) => {
      const existing = c[item.id];
      return {
        ...c,
        [item.id]: {
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: (existing?.quantity || 0) + 1,
          note: existing?.note || '',
        },
      };
    });
    setFlashId(item.id);
    setTimeout(() => setFlashId(null), 500);
  }

  function decrementCart(productId) {
    setCart((c) => {
      const existing = c[productId];
      if (!existing) return c;
      if (existing.quantity <= 1) {
        const next = { ...c };
        delete next[productId];
        return next;
      }
      return { ...c, [productId]: { ...existing, quantity: existing.quantity - 1 } };
    });
  }

  function updateCartQty(productId, quantity) {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((c) => ({ ...c, [productId]: { ...c[productId], quantity } }));
  }

  function updateCartNote(productId, note) {
    setCart((c) => ({ ...c, [productId]: { ...c[productId], note } }));
  }

  function removeFromCart(productId) {
    setCart((c) => {
      const next = { ...c };
      delete next[productId];
      return next;
    });
  }

  const cartItems = Object.values(cart);
  const cartCount = cartItems.reduce((sum, i) => sum + i.quantity, 0);
  const cartTotal = cartItems.reduce((sum, i) => sum + i.quantity * i.price, 0);

  async function submitCart() {
    if (cartItems.length === 0) return;
    setSubmittingCart(true);
    try {
      const res = await api(`/qr/${code}/order-batch`, {
        method: 'POST',
        body: JSON.stringify({
          items: cartItems.map((i) => ({
            productId: i.id,
            quantity: i.quantity,
            note: i.note?.trim() || undefined,
          })),
        }),
      });
      setState((s) => ({ ...s, data: { ...s.data, account: res.account } }));
      setCart({});
      setCartOpen(false);
      showToast('Pedido enviado a recepción');
    } catch (err) {
      showToast(err.message || 'No se pudo enviar el pedido');
    } finally {
      setSubmittingCart(false);
    }
  }

  const account = state.data?.account;
  // Una vez que el huésped pidió la cuenta, ya no puede seguir agregando
  // consumo (el backend también lo bloquea, esto es solo para que la UI
  // no lo deje ni intentarlo).
  const canOrder = !!account && !account.checkoutRequested;

  async function submitCheckoutRequest() {
    setSubmittingCheckout(true);
    try {
      const res = await api(`/qr/${code}/request-checkout`, {
        method: 'POST',
        body: JSON.stringify({ method: paymentMethod }),
      });
      setState((s) => ({ ...s, data: { ...s.data, account: res.account } }));
      setRequestingCheckout(false);
      showToast('Recepción ya sabe que quieres pagar');
    } catch (err) {
      showToast(err.message || 'No se pudo enviar la solicitud');
    } finally {
      setSubmittingCheckout(false);
    }
  }

  return (
    <div className="wrap" style={{ paddingBottom: cartCount > 0 ? 90 : 60 }}>
      <div className="header-row">
        <div className="logo">
          <img src="/logo.png" alt="Hotel" />
        </div>
        <div className="header-text">
          <h1>{state.data ? state.data.hotel.name : state.loading ? 'Cargando...' : 'No disponible'}</h1>
          <div className="powered-by">La Ruta del Placer</div>
        </div>
      </div>
      {state.data && <div className="room-pill-wrap"><div className="room-pill">Habitación {state.data.room.number}</div></div>}

      <Sunburst />

      {state.loading && <div className="loading">Cargando el menú de tu habitación...</div>}

      {state.error === 'no-code' && (
        <div className="error">Este enlace no incluye un código de habitación válido.</div>
      )}
      {state.error === 'not-found' && (
        <div className="error">
          No pudimos cargar la información de esta habitación. Intenta de nuevo o comunícate con recepción.
        </div>
      )}

      {state.data && (
        <button className="bill-btn" onClick={() => setBillOpen(true)}>
          <span className="bill-btn-icon">🧾</span>
          <span className="bill-btn-text">Ver mi cuenta</span>
          <span className="bill-btn-total">{money(account?.totalAmount ?? 0)}</span>
        </button>
      )}

      {state.data && state.data.menu.length === 0 && (
        <div className="empty">Aún no hay productos cargados para este hotel.</div>
      )}

      {state.data && state.data.menu.length > 0 && !enteredMenu && (() => {
        const categories = groupByCategoryNormalized(state.data.menu).map((c) => {
          const withImage = c.items.find((i) => i.imageUrl);
          return {
            key: c.key,
            label: c.label,
            count: c.items.length,
            image: withImage ? withImage.imageUrl : null,
          };
        });
        const visible = showAllCategories ? categories : categories.slice(0, 4);
        const hiddenCount = categories.length - visible.length;

        return (
          <div className="category-preview">
            <div className="category-preview-title">¿Qué se te antoja?</div>
            <div className="category-preview-grid">
              {visible.map((cat) => (
                <button key={cat.key} className="category-preview-card" onClick={() => openCategory(cat.key)}>
                  <div className="category-preview-media">
                    {cat.image ? (
                      <img src={cat.image} alt={cat.label} className="category-preview-image" />
                    ) : (
                      <div className="category-preview-icon">{iconForCategory(cat.label)}</div>
                    )}
                  </div>
                  <div className="category-preview-name">{cat.label}</div>
                </button>
              ))}
            </div>
            {hiddenCount > 0 && (
              <button className="category-preview-more" onClick={() => setShowAllCategories(true)}>
                Ver más categorías ({hiddenCount}) ↓
              </button>
            )}
            {showAllCategories && categories.length > 4 && (
              <button className="category-preview-more" onClick={() => setShowAllCategories(false)}>
                Ver menos ↑
              </button>
            )}
            <button className="category-preview-all" onClick={() => openCategory(null)}>
              Ver todo el menú →
            </button>
          </div>
        );
      })()}

      {state.data && state.data.menu.length > 0 && enteredMenu && (
        <>
          {activeCategory && (
            <div className="active-category-title">
              {(state.data.menu.find(
                (item) => (item.category || 'Otros').trim().toLowerCase() === activeCategory,
              )?.category) || 'Otros'}
            </div>
          )}
          <div className="search-wrap">
            <input
              className="search-input"
              type="text"
              placeholder="Buscar producto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {(() => {
            const term = search.trim().toLowerCase();
            let filtered = state.data.menu.filter(
              (item) => !term || item.name.toLowerCase().includes(term),
            );
            if (activeCategory) {
              filtered = filtered.filter(
                (item) => (item.category || 'Otros').trim().toLowerCase() === activeCategory,
              );
            }

            if (filtered.length === 0) {
              return <div className="empty">No encontramos productos que coincidan con tu búsqueda.</div>;
            }

            const groups = activeCategory
              ? groupByCategoryNormalized(filtered).slice(0, 1)
              : groupByCategoryNormalized(filtered);

            return groups.map(({ key, label, items }) => (
              <div key={key} id={`cat-${key}`}>
                {!activeCategory && <div className="section-title">{label}</div>}
                {items.map((item) => (
                  <div key={item.id} className={flashId === item.id ? 'flash' : ''}>
                    {canOrder ? (
                      <ProductRow
                        item={item}
                        cartQty={cart[item.id]?.quantity || 0}
                        onIncrement={() => incrementCart(item)}
                        onDecrement={() => decrementCart(item.id)}
                        onImageClick={() => setZoomedItem(item)}
                      />
                    ) : (
                      <div className="product-card">
                        <ProductImage item={item} onClick={() => setZoomedItem(item)} />
                        <div className="product-body">
                          <div className="product-info">
                            <div className="name">{item.name}</div>
                          </div>
                          <div className="price-only">{money(item.price)}</div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ));
          })()}
        </>
      )}

      <div className="note">
        {canOrder
          ? 'Agrega lo que quieras al carrito y envíalo cuando termines. Toca "Ver mi cuenta" arriba para ver el total en cualquier momento.'
          : account?.checkoutRequested
            ? 'Ya pediste la cuenta — recepción va en camino. Si necesitas algo más, comunícate con recepción por el teléfono de la habitación.'
            : 'Para pedir cualquiera de estos productos, comunícate con recepción por el teléfono de la habitación.'}
      </div>

      <div className={'toast' + (toast ? ' show' : '')}>{toast}</div>

      {enteredMenu && (
        <button
          className={'back-to-categories-fab' + (cartCount > 0 && !cartOpen ? ' with-cart' : '')}
          onClick={() => { setEnteredMenu(false); setActiveCategory(null); setSearch(''); }}
        >
          ‹ Categorías
        </button>
      )}

      {cartCount > 0 && !cartOpen && canOrder && (
        <button className="cart-fab" onClick={() => setCartOpen(true)}>
          🛒 Ver carrito ({cartCount}) — {money(cartTotal)}
        </button>
      )}

      {cartOpen && (
        <div className="confirm-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setCartOpen(false); }}>
          <div className="confirm-box cart-box">
            <div className="confirm-title">Tu pedido</div>

            {cartItems.length === 0 ? (
              <div className="empty" style={{ padding: '20px 0' }}>Tu carrito está vacío.</div>
            ) : (
              <div className="cart-list">
                {cartItems.map((i) => (
                  <div className="cart-line" key={i.id}>
                    <div className="cart-line-top">
                      <div className="cart-line-name">{i.name}</div>
                      <div className="cart-line-actions">
                        <div className="qty-stepper small">
                          <button onClick={() => updateCartQty(i.id, i.quantity - 1)}>−</button>
                          <span>{i.quantity}</span>
                          <button onClick={() => updateCartQty(i.id, i.quantity + 1)}>+</button>
                        </div>
                        <div className="cart-line-price">{money(i.quantity * i.price)}</div>
                        <button className="cart-remove" onClick={() => removeFromCart(i.id)} aria-label="Quitar">✕</button>
                      </div>
                    </div>
                    <input
                      className="cart-line-note"
                      type="text"
                      placeholder="Nota para este producto (opcional)"
                      value={i.note || ''}
                      onChange={(e) => updateCartNote(i.id, e.target.value)}
                      maxLength={200}
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="confirm-total">{money(cartTotal)}</div>
            <div className="confirm-desc">Esto se sumará a tu cuenta y recepción lo llevará a tu habitación.</div>
            <div className="confirm-actions">
              <button className="btn-cancel" onClick={() => setCartOpen(false)}>Seguir viendo el menú</button>
              <button
                className="add-btn"
                onClick={() => setConfirmSendOpen(true)}
                disabled={submittingCart || cartItems.length === 0 || !canOrder}
              >
                Enviar pedido
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmSendOpen && (
        <div className="confirm-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setConfirmSendOpen(false); }}>
          <div className="confirm-box">
            <div className="confirm-title">¿Confirmar pedido?</div>
            <div className="cart-list" style={{ maxHeight: 200 }}>
              {cartItems.map((i) => (
                <div className="account-row small" key={i.id}>
                  <span>{i.quantity}× {i.name}</span>
                  <span>{money(i.quantity * i.price)}</span>
                </div>
              ))}
            </div>
            <div className="confirm-total">{money(cartTotal)}</div>
            <div className="confirm-desc">
              Esto se va a sumar a tu cuenta y recepción lo va a llevar a tu habitación. ¿Confirmas?
            </div>
            <div className="confirm-actions">
              <button className="btn-cancel" onClick={() => setConfirmSendOpen(false)}>Cancelar</button>
              <button
                className="add-btn"
                onClick={async () => { setConfirmSendOpen(false); await submitCart(); }}
                disabled={submittingCart}
              >
                {submittingCart ? 'Enviando...' : 'Sí, confirmar pedido'}
              </button>
            </div>
          </div>
        </div>
      )}

      {billOpen && (
        <div className="confirm-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setBillOpen(false); }}>
          <div className="confirm-box bill-box">
            <div className="confirm-title">Tu cuenta</div>
            <div className="account-row">
              <span>Habitación (5h)</span>
              <span>{money(account?.basePrice ?? 0)}</span>
            </div>
            {Number(account?.extraChargesTotal ?? 0) > 0 && (
              <div className="account-row">
                <span>Tiempo extra</span>
                <span>{money(account.extraChargesTotal)}</span>
              </div>
            )}
            {account?.items?.length > 0 && (
              <div className="order-breakdown">
                {account.items.map((it, i) => (
                  <div className="account-row small" key={i}>
                    <span>
                      {it.quantity}× {it.name}
                      {!it.delivered && <span className="pending-tag"> · en camino</span>}
                      {it.note && <div className="item-note">"{it.note}"</div>}
                    </span>
                    <span>{money(it.subtotal)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="account-row">
              <span>Consumo</span>
              <span>{money(account?.productsTotal ?? 0)}</span>
            </div>
            <div className="account-row total">
              <span>Total de tu cuenta</span>
              <span>{money(account?.totalAmount ?? 0)}</span>
            </div>
            {!canOrder && (
              <div className="account-note">Aún no hay un check-in activo para pedir consumo desde aquí.</div>
            )}
            {canOrder && !account.checkoutRequested && (
              <button className="checkout-btn" onClick={() => { setBillOpen(false); setRequestingCheckout(true); }}>
                Pedir la cuenta
              </button>
            )}
            {canOrder && account.checkoutRequested && (
              <div className="checkout-requested-note">
                ✓ Ya avisamos a recepción — pago preferido:{' '}
                <strong>{PAYMENT_LABELS[account.checkoutRequestedMethod] || account.checkoutRequestedMethod}</strong>
              </div>
            )}
            <div className="confirm-actions" style={{ marginTop: 16 }}>
              <button className="btn-cancel" onClick={() => setBillOpen(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {requestingCheckout && (
        <div className="confirm-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setRequestingCheckout(false); }}>
          <div className="confirm-box">
            <div className="confirm-title">Pedir la cuenta</div>
            <div className="confirm-total">{money(account?.totalAmount ?? 0)}</div>
            <div className="confirm-desc">¿Cómo prefieres pagar? Recepción vendrá a cobrarte.</div>
            <div className="payment-options">
              {Object.entries(PAYMENT_LABELS).map(([value, label]) => (
                <button
                  key={value}
                  className={'payment-option' + (paymentMethod === value ? ' active' : '')}
                  onClick={() => setPaymentMethod(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="confirm-actions">
              <button className="btn-cancel" onClick={() => setRequestingCheckout(false)}>Cancelar</button>
              <button className="add-btn" onClick={submitCheckoutRequest} disabled={submittingCheckout}>
                {submittingCheckout ? 'Enviando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {zoomedItem && (
        <div className="confirm-overlay" onMouseDown={() => setZoomedItem(null)}>
          <div className="zoom-box">
            {zoomedItem.imageUrl ? (
              <img src={zoomedItem.imageUrl} alt={zoomedItem.name} className="zoom-image" />
            ) : (
              <div className="zoom-image zoom-image-placeholder">
                {iconForCategory(zoomedItem.category)}
              </div>
            )}
            <div className="zoom-name">{zoomedItem.name}</div>
            <div className="zoom-price">{money(zoomedItem.price)}</div>

            {canOrder && (
              <div className="zoom-stepper-row">
                <div className="qty-stepper">
                  <button
                    onClick={() => decrementCart(zoomedItem.id)}
                    aria-label="Quitar"
                    disabled={(cart[zoomedItem.id]?.quantity || 0) === 0}
                  >
                    −
                  </button>
                  <span>{cart[zoomedItem.id]?.quantity || 0}</span>
                  <button onClick={() => incrementCart(zoomedItem)} aria-label="Agregar">+</button>
                </div>
                <span className="zoom-stepper-label">en el carrito</span>
              </div>
            )}

            <button className="btn-cancel" style={{ marginTop: 14 }} onClick={() => setZoomedItem(null)}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}
