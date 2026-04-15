import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { useGtmConsent, useGtmPush, useGtmClient } from '@jwiedeman/gtm-kit-react';
import { pushEcommerce } from '@jwiedeman/gtm-kit';

export const consentDefaults = {
  ad_storage: 'denied',
  analytics_storage: 'denied',
  ad_personalization: 'denied',
  ad_user_data: 'denied'
} as const;

const styles: Record<string, string> = {
  container: 'min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center gap-6 font-sans p-6',
  panel: 'max-w-xl w-full rounded-xl bg-slate-900 shadow-xl p-6 space-y-4 border border-slate-800',
  widePanel: 'max-w-4xl w-full rounded-xl bg-slate-900 shadow-xl p-6 space-y-4 border border-slate-800',
  heading: 'text-2xl font-semibold',
  code: 'font-mono text-amber-300',
  button:
    'rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400',
  primary: 'bg-amber-400 text-slate-950 hover:bg-amber-300',
  secondary: 'bg-slate-800 text-slate-100 hover:bg-slate-700',
  danger: 'bg-red-500 text-white hover:bg-red-600',
  pill: 'inline-flex items-center gap-2 rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-wide text-slate-300',
  nav: 'flex items-center justify-center gap-3 text-sm font-medium flex-wrap',
  navLink:
    'rounded-lg px-3 py-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 text-slate-300 hover:text-amber-300',
  navActive:
    'rounded-lg px-3 py-1 bg-amber-400 text-slate-950 font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400'
};

// Product types
interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  brand: string;
  variant: string;
}

interface CartItem extends Product {
  quantity: number;
}

// Sample products
const products: Product[] = [
  { id: 'SKU-001', name: 'Blue T-Shirt', price: 29.99, category: 'Clothing', brand: 'GTM Apparel', variant: 'Blue/M' },
  {
    id: 'SKU-002',
    name: 'Running Shoes',
    price: 89.99,
    category: 'Footwear',
    brand: 'SpeedRunner',
    variant: 'Black/10'
  },
  {
    id: 'SKU-003',
    name: 'Wireless Headphones',
    price: 149.99,
    category: 'Electronics',
    brand: 'SoundMax',
    variant: 'Black'
  },
  { id: 'SKU-004', name: 'Laptop Stand', price: 49.99, category: 'Accessories', brand: 'DeskPro', variant: 'Silver' }
];

const toGA4Item = (product: Product, quantity = 1, index?: number) => ({
  item_id: product.id,
  item_name: product.name,
  item_brand: product.brand,
  item_category: product.category,
  item_variant: product.variant,
  price: product.price,
  quantity,
  ...(index !== undefined && { index })
});

/**
 * Custom hook for route-aware page view tracking.
 *
 * This pattern handles several edge cases common in React SPAs:
 *
 * 1. **Deduplication via ref**: `lastPathRef` prevents duplicate page views
 *    when the component re-renders but the route hasn't actually changed.
 *    This is especially important in React StrictMode which double-invokes effects.
 *
 * 2. **requestAnimationFrame**: Defers the push to the next frame to ensure
 *    document.title has been updated by the new page component. Without this,
 *    you might capture the previous page's title.
 *
 * 3. **Cleanup function**: Cancels the pending frame if the component unmounts
 *    before the frame fires, preventing memory leaks and stale pushes.
 */
const useRouteAwarePageView = (): void => {
  const push = useGtmPush();
  const location = useLocation();
  // Track the last tracked path to prevent duplicate page views
  const lastPathRef = useRef<string>();

  useEffect(() => {
    // Combine all URL parts for complete path tracking
    const path = `${location.pathname}${location.search}${location.hash}`;

    // Skip if we've already tracked this exact path (handles StrictMode double-invoke)
    if (lastPathRef.current === path) {
      return;
    }

    lastPathRef.current = path;

    // Defer to next frame to ensure document.title is updated by the new page
    const frame = requestAnimationFrame(() => {
      push({
        event: 'page_view',
        page_path: path,
        page_title: document.title || 'React StrictMode example'
      });
    });

    // Cancel pending frame on unmount or route change
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [location, push]);
};

const ConsentControls = () => {
  const { updateConsent } = useGtmConsent();
  const [consent, setConsent] = useState<'denied' | 'granted'>('denied');

  const handleGrant = useCallback(() => {
    setConsent('granted');
    updateConsent({
      ad_storage: 'granted',
      analytics_storage: 'granted',
      ad_personalization: 'granted',
      ad_user_data: 'granted'
    });
  }, [updateConsent]);

  const handleRevoke = useCallback(() => {
    setConsent('denied');
    updateConsent(consentDefaults);
  }, [updateConsent]);

  return (
    <div className={styles.panel}>
      <div className={styles.pill}>Consent controls</div>
      <p className="text-sm text-slate-300">
        Toggle consent to see how the adapter forwards updates to the GTM client.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleGrant}
          className={`${styles.button} ${styles.primary}`}
          disabled={consent === 'granted'}
        >
          Grant consent
        </button>
        <button
          type="button"
          onClick={handleRevoke}
          className={`${styles.button} ${styles.secondary}`}
          disabled={consent === 'denied'}
        >
          Revoke consent
        </button>
      </div>
      <p className="text-xs text-slate-400">
        Current consent state: <span className={styles.code}>{consent}</span>
      </p>
    </div>
  );
};

const CustomEventDemo = () => {
  const push = useGtmPush();
  const [count, setCount] = useState(0);

  const sendEvent = useCallback(() => {
    const nextCount = count + 1;
    setCount(nextCount);
    push({
      event: 'cta_click',
      cta_label: 'Get started',
      click_count: nextCount
    });
  }, [count, push]);

  return (
    <div className={styles.panel}>
      <div className={styles.pill}>Custom events</div>
      <p className="text-sm text-slate-300">Click the button to emit structured events into the data layer.</p>
      <button type="button" onClick={sendEvent} className={`${styles.button} ${styles.primary}`}>
        Emit CTA event
      </button>
      <p className="text-xs text-slate-400">Events sent: {count}</p>
    </div>
  );
};

const Overview = () => {
  useEffect(() => {
    document.title = 'React StrictMode example';
  }, []);

  return (
    <>
      <CustomEventDemo />
      <ConsentControls />
    </>
  );
};

// E-Commerce Shop Page
const Shop = () => {
  const client = useGtmClient();
  const push = useGtmPush();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkoutStep, setCheckoutStep] = useState<'browse' | 'cart' | 'shipping' | 'payment' | 'complete'>('browse');
  const [lastOrderId, setLastOrderId] = useState('');

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  useEffect(() => {
    document.title = 'Shop | React StrictMode example';
    // Track view_item_list on mount
    pushEcommerce(client, 'view_item_list', {
      item_list_id: 'shop_main',
      item_list_name: 'Shop Products',
      items: products.map((p, i) => toGA4Item(p, 1, i))
    });
  }, [client]);

  const viewProduct = (product: Product, index: number) => {
    pushEcommerce(client, 'select_item', {
      item_list_id: 'shop_main',
      item_list_name: 'Shop Products',
      items: [toGA4Item(product, 1, index)]
    });
    pushEcommerce(client, 'view_item', {
      currency: 'USD',
      value: product.price,
      items: [toGA4Item(product)]
    });
  };

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        return prev.map((i) => (i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    pushEcommerce(client, 'add_to_cart', {
      currency: 'USD',
      value: product.price,
      items: [toGA4Item(product)]
    });
  };

  const removeFromCart = (item: CartItem) => {
    pushEcommerce(client, 'remove_from_cart', {
      currency: 'USD',
      value: item.price * item.quantity,
      items: [toGA4Item(item, item.quantity)]
    });
    setCart((prev) => prev.filter((i) => i.id !== item.id));
  };

  const viewCart = () => {
    setCheckoutStep('cart');
    pushEcommerce(client, 'view_cart', {
      currency: 'USD',
      value: cartTotal,
      items: cart.map((item, i) => toGA4Item(item, item.quantity, i))
    });
  };

  const beginCheckout = () => {
    pushEcommerce(client, 'begin_checkout', {
      currency: 'USD',
      value: cartTotal,
      items: cart.map((item) => toGA4Item(item, item.quantity))
    });
    setCheckoutStep('shipping');
  };

  const addShipping = () => {
    pushEcommerce(client, 'add_shipping_info', {
      currency: 'USD',
      value: cartTotal,
      shipping_tier: 'Standard',
      items: cart.map((item) => toGA4Item(item, item.quantity))
    });
    setCheckoutStep('payment');
  };

  const addPayment = () => {
    pushEcommerce(client, 'add_payment_info', {
      currency: 'USD',
      value: cartTotal,
      payment_type: 'Credit Card',
      items: cart.map((item) => toGA4Item(item, item.quantity))
    });
    completePurchase();
  };

  const completePurchase = () => {
    const orderId = `TXN-${Date.now()}`;
    setLastOrderId(orderId);
    pushEcommerce(client, 'purchase', {
      transaction_id: orderId,
      currency: 'USD',
      value: cartTotal,
      tax: cartTotal * 0.08,
      shipping: 5.99,
      items: cart.map((item) => toGA4Item(item, item.quantity))
    });
    setCart([]);
    setCheckoutStep('complete');
  };

  const requestRefund = () => {
    pushEcommerce(client, 'refund', {
      transaction_id: lastOrderId,
      currency: 'USD',
      value: 0,
      items: []
    });
    push({ event: 'refund_requested', order_id: lastOrderId });
    setLastOrderId('');
    setCheckoutStep('browse');
  };

  return (
    <div className={styles.widePanel}>
      <div className="flex justify-between items-center">
        <div className={styles.pill}>E-Commerce Demo</div>
        {cartCount > 0 && checkoutStep === 'browse' && (
          <button onClick={viewCart} className={`${styles.button} ${styles.primary}`}>
            View Cart ({cartCount})
          </button>
        )}
      </div>

      <p className="text-sm text-slate-300">
        Full e-commerce tracking: view_item_list, select_item, view_item, add_to_cart, remove_from_cart, view_cart,
        begin_checkout, add_shipping_info, add_payment_info, purchase, refund
      </p>

      {checkoutStep === 'browse' && (
        <div className="grid grid-cols-2 gap-4">
          {products.map((product, index) => (
            <div
              key={product.id}
              className="bg-slate-800 p-4 rounded-lg cursor-pointer hover:bg-slate-700 transition"
              onClick={() => viewProduct(product, index)}
            >
              <h3 className="font-medium">{product.name}</h3>
              <p className="text-slate-400 text-sm">{product.brand}</p>
              <p className="text-amber-300 font-semibold">${product.price.toFixed(2)}</p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  addToCart(product);
                }}
                className={`${styles.button} ${styles.primary} mt-2 w-full`}
              >
                Add to Cart
              </button>
            </div>
          ))}
        </div>
      )}

      {checkoutStep === 'cart' && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Your Cart</h3>
          {cart.map((item) => (
            <div key={item.id} className="flex justify-between items-center bg-slate-800 p-3 rounded">
              <div>
                <p className="font-medium">{item.name}</p>
                <p className="text-sm text-slate-400">
                  Qty: {item.quantity} × ${item.price.toFixed(2)}
                </p>
              </div>
              <button onClick={() => removeFromCart(item)} className={`${styles.button} ${styles.danger}`}>
                Remove
              </button>
            </div>
          ))}
          <div className="border-t border-slate-700 pt-4">
            <p className="text-xl font-semibold">Total: ${cartTotal.toFixed(2)}</p>
            <div className="flex gap-3 mt-3">
              <button onClick={() => setCheckoutStep('browse')} className={`${styles.button} ${styles.secondary}`}>
                Continue Shopping
              </button>
              <button onClick={beginCheckout} className={`${styles.button} ${styles.primary}`}>
                Begin Checkout
              </button>
            </div>
          </div>
        </div>
      )}

      {checkoutStep === 'shipping' && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Shipping (Step 1/2)</h3>
          <div className="bg-slate-800 p-4 rounded">
            <p className="text-slate-300">Address: 123 Main St, City, ST 12345</p>
            <p className="text-slate-300">Method: Standard Shipping ($5.99)</p>
          </div>
          <button onClick={addShipping} className={`${styles.button} ${styles.primary}`}>
            Continue to Payment
          </button>
        </div>
      )}

      {checkoutStep === 'payment' && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Payment (Step 2/2)</h3>
          <div className="bg-slate-800 p-4 rounded">
            <p className="text-slate-300">Card: **** **** **** 4242</p>
            <p className="text-slate-300 mt-2">Subtotal: ${cartTotal.toFixed(2)}</p>
            <p className="text-slate-300">Tax: ${(cartTotal * 0.08).toFixed(2)}</p>
            <p className="text-slate-300">Shipping: $5.99</p>
            <p className="text-amber-300 font-semibold mt-2">Total: ${(cartTotal * 1.08 + 5.99).toFixed(2)}</p>
          </div>
          <button onClick={addPayment} className={`${styles.button} ${styles.primary}`}>
            Complete Purchase
          </button>
        </div>
      )}

      {checkoutStep === 'complete' && (
        <div className="text-center space-y-4">
          <div className="text-4xl">✓</div>
          <h3 className="text-xl font-medium">Order Complete!</h3>
          <p className="text-slate-400 font-mono">{lastOrderId}</p>
          <div className="flex gap-3 justify-center">
            <button onClick={requestRefund} className={`${styles.button} ${styles.danger}`}>
              Request Refund
            </button>
            <button onClick={() => setCheckoutStep('browse')} className={`${styles.button} ${styles.primary}`}>
              Continue Shopping
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const PageViewTracker = (): JSX.Element => {
  useRouteAwarePageView();
  return <></>;
};

const App = (): JSX.Element => {
  const location = useLocation();

  const containerList = useMemo(() => {
    const raw = import.meta.env.VITE_GTM_CONTAINERS ?? 'GTM-XXXX';
    return raw
      .split(',')
      .map((id: string) => id.trim())
      .filter((id: string) => Boolean(id))
      .join(', ');
  }, []);

  return (
    <main className={styles.container}>
      <PageViewTracker />
      <section className="space-y-4 text-center">
        <div className={styles.pill}>React StrictMode</div>
        <h1 className={styles.heading}>GTM Provider demo</h1>
        <p className="text-sm text-slate-300 max-w-xl mx-auto">
          This sandbox mounts the GTM provider inside <span className={styles.code}>{'<React.StrictMode>'}</span>. The
          router integration pushes a <span className={styles.code}>page_view</span> event on every navigation.
        </p>
        <p className="text-xs text-slate-500">Configured containers: {containerList}</p>
        <nav className={styles.nav} aria-label="Example pages">
          <Link to="/" className={location.pathname === '/' ? styles.navActive : styles.navLink}>
            Overview
          </Link>
          <Link to="/shop" className={location.pathname === '/shop' ? styles.navActive : styles.navLink}>
            Shop
          </Link>
          <Link to="/contact" className={location.pathname === '/contact' ? styles.navActive : styles.navLink}>
            Contact
          </Link>
          <Link to="/booking" className={location.pathname === '/booking' ? styles.navActive : styles.navLink}>
            Booking
          </Link>
          <Link to="/videos" className={location.pathname === '/videos' ? styles.navActive : styles.navLink}>
            Videos
          </Link>
          <Link to="/pricing" className={location.pathname === '/pricing' ? styles.navActive : styles.navLink}>
            Pricing
          </Link>
        </nav>
      </section>
      <Routes>
        <Route path="/" element={<Overview />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/booking" element={<Booking />} />
        <Route path="/videos" element={<Videos />} />
        <Route path="/pricing" element={<Pricing />} />
      </Routes>
    </main>
  );
};

const Pricing = () => {
  const push = useGtmPush();

  useEffect(() => {
    document.title = 'Pricing | React StrictMode example';
  }, []);

  const trackConversion = useCallback(() => {
    push({
      event: 'generate_lead',
      form_id: 'pricing_cta',
      value: 100,
      currency: 'USD'
    });
  }, [push]);

  return (
    <div className={styles.panel}>
      <div className={styles.pill}>Pricing</div>
      <p className="text-sm text-slate-300">
        Route transitions push page views automatically. Use this CTA to demonstrate generate_lead events.
      </p>
      <button type="button" className={`${styles.button} ${styles.primary}`} onClick={trackConversion}>
        Start free trial
      </button>
      <p className="text-xs text-slate-400">
        Inspect <span className={styles.code}>window.dataLayer</span> to watch events stream in.
      </p>
    </div>
  );
};

// =============================================================================
// LEAD CAPTURE / CONTACT FORM DEMO
// =============================================================================

const Contact = () => {
  const push = useGtmPush();
  const [formState, setFormState] = useState({
    name: '',
    email: '',
    company: '',
    message: ''
  });
  const [step, setStep] = useState<'form' | 'submitted'>('form');
  const [errors, setErrors] = useState<string[]>([]);
  const formStartedRef = useRef(false);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    document.title = 'Contact | React StrictMode example';
  }, []);

  const handleFocus = (fieldName: string, fieldType: string, position: number) => {
    // Track form_start on first interaction
    if (!formStartedRef.current) {
      formStartedRef.current = true;
      startTimeRef.current = Date.now();
      push({
        event: 'form_start',
        form_id: 'contact-form',
        form_name: 'Contact Us',
        form_type: 'contact',
        form_fields_count: 4,
        form_required_fields: 3
      });
    }

    push({
      event: 'form_field_focus',
      form_id: 'contact-form',
      field_name: fieldName,
      field_type: fieldType,
      field_position: position
    });
  };

  const handleChange = (fieldName: string, value: string) => {
    setFormState((prev) => ({ ...prev, [fieldName]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors: string[] = [];

    if (!formState.name.trim()) validationErrors.push('name');
    if (!formState.email.trim() || !formState.email.includes('@')) validationErrors.push('email');
    if (!formState.message.trim()) validationErrors.push('message');

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      push({
        event: 'form_error',
        form_id: 'contact-form',
        error_type: 'validation',
        error_count: validationErrors.length,
        error_fields: validationErrors
      });
      return;
    }

    const timeToComplete = Date.now() - startTimeRef.current;

    // Track successful submission
    push({
      event: 'form_submit',
      form_id: 'contact-form',
      form_name: 'Contact Us',
      form_type: 'contact',
      form_fields_filled: Object.values(formState).filter((v) => v.trim()).length,
      time_to_complete_ms: timeToComplete
    });

    push({
      event: 'form_submit_success',
      form_id: 'contact-form',
      form_name: 'Contact Us',
      form_type: 'contact'
    });

    // Also track as a lead
    push({
      event: 'generate_lead',
      value: 50,
      currency: 'USD'
    });

    setStep('submitted');
  };

  return (
    <div className={styles.panel}>
      <div className={styles.pill}>Lead Capture Demo</div>
      <p className="text-sm text-slate-300">
        Form tracking: form_start, form_field_focus, form_error, form_submit, form_submit_success, generate_lead
      </p>

      {step === 'form' ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Name *</label>
            <input
              type="text"
              value={formState.name}
              onChange={(e) => handleChange('name', e.target.value)}
              onFocus={() => handleFocus('name', 'text', 1)}
              className={`w-full bg-slate-800 rounded px-3 py-2 text-slate-100 ${errors.includes('name') ? 'border border-red-500' : ''}`}
              placeholder="John Doe"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Email *</label>
            <input
              type="email"
              value={formState.email}
              onChange={(e) => handleChange('email', e.target.value)}
              onFocus={() => handleFocus('email', 'email', 2)}
              className={`w-full bg-slate-800 rounded px-3 py-2 text-slate-100 ${errors.includes('email') ? 'border border-red-500' : ''}`}
              placeholder="john@example.com"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Company</label>
            <input
              type="text"
              value={formState.company}
              onChange={(e) => handleChange('company', e.target.value)}
              onFocus={() => handleFocus('company', 'text', 3)}
              className="w-full bg-slate-800 rounded px-3 py-2 text-slate-100"
              placeholder="Acme Inc."
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Message *</label>
            <textarea
              value={formState.message}
              onChange={(e) => handleChange('message', e.target.value)}
              onFocus={() => handleFocus('message', 'textarea', 4)}
              className={`w-full bg-slate-800 rounded px-3 py-2 text-slate-100 h-24 ${errors.includes('message') ? 'border border-red-500' : ''}`}
              placeholder="How can we help?"
            />
          </div>
          {errors.length > 0 && <p className="text-red-400 text-sm">Please fix the highlighted fields</p>}
          <button type="submit" className={`${styles.button} ${styles.primary} w-full`}>
            Send Message
          </button>
        </form>
      ) : (
        <div className="text-center space-y-4">
          <div className="text-4xl">✉️</div>
          <h3 className="text-lg font-medium">Message Sent!</h3>
          <p className="text-slate-400">Thank you for reaching out.</p>
          <button
            onClick={() => {
              setStep('form');
              setFormState({ name: '', email: '', company: '', message: '' });
              setErrors([]);
              formStartedRef.current = false;
            }}
            className={`${styles.button} ${styles.secondary}`}
          >
            Send Another
          </button>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// BOOKING / RESERVATION DEMO
// =============================================================================

const Booking = () => {
  const push = useGtmPush();
  const [step, setStep] = useState<'select' | 'confirm' | 'complete'>('select');
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState('');
  const [dates, setDates] = useState({ checkIn: '2024-03-15', checkOut: '2024-03-18' });

  const rooms = [
    { id: 'standard', name: 'Standard Room', price: 99, type: 'standard' },
    { id: 'deluxe', name: 'Deluxe Suite', price: 199, type: 'deluxe_suite' },
    { id: 'penthouse', name: 'Penthouse', price: 499, type: 'penthouse' }
  ];

  useEffect(() => {
    document.title = 'Booking | React StrictMode example';
  }, []);

  const getNights = () => {
    const checkIn = new Date(dates.checkIn);
    const checkOut = new Date(dates.checkOut);
    return Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getSelectedRoomData = () => rooms.find((r) => r.id === selectedRoom);

  const selectRoom = (room: (typeof rooms)[0]) => {
    setSelectedRoom(room.id);
    push({
      event: 'booking_requested',
      booking_type: 'hotel',
      room_type: room.type,
      value: room.price * getNights(),
      currency: 'USD',
      check_in_date: dates.checkIn,
      check_out_date: dates.checkOut,
      nights: getNights(),
      guests: 2
    });
  };

  const confirmBooking = () => {
    const room = getSelectedRoomData();
    if (!room) return;

    const newBookingId = `BK-${Date.now()}`;
    setBookingId(newBookingId);

    push({
      event: 'booking_confirmed',
      booking_id: newBookingId,
      booking_type: 'hotel',
      room_type: room.type,
      value: room.price * getNights(),
      currency: 'USD',
      check_in_date: dates.checkIn,
      check_out_date: dates.checkOut,
      nights: getNights(),
      guests: 2,
      provider: 'GTM Hotel Demo',
      payment_method: 'credit_card'
    });

    // Also track as a reservation confirmed (alias)
    push({
      event: 'reservation_confirmed',
      booking_id: newBookingId,
      booking_type: 'hotel',
      value: room.price * getNights(),
      currency: 'USD'
    });

    setStep('complete');
  };

  const cancelBooking = () => {
    const room = getSelectedRoomData();
    push({
      event: 'booking_cancelled',
      booking_id: bookingId,
      booking_type: 'hotel',
      room_type: room?.type,
      value: room ? room.price * getNights() : 0,
      currency: 'USD',
      cancellation_reason: 'user_requested'
    });
    setStep('select');
    setSelectedRoom(null);
    setBookingId('');
  };

  return (
    <div className={styles.widePanel}>
      <div className={styles.pill}>Booking Demo</div>
      <p className="text-sm text-slate-300">
        Booking tracking: booking_requested, booking_confirmed, reservation_confirmed, booking_cancelled
      </p>

      {step === 'select' && (
        <div className="space-y-4">
          <div className="flex gap-4 mb-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Check-in</label>
              <input
                type="date"
                value={dates.checkIn}
                onChange={(e) => setDates((d) => ({ ...d, checkIn: e.target.value }))}
                className="bg-slate-800 rounded px-3 py-2 text-slate-100"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Check-out</label>
              <input
                type="date"
                value={dates.checkOut}
                onChange={(e) => setDates((d) => ({ ...d, checkOut: e.target.value }))}
                className="bg-slate-800 rounded px-3 py-2 text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {rooms.map((room) => (
              <div
                key={room.id}
                onClick={() => selectRoom(room)}
                className={`bg-slate-800 p-4 rounded-lg cursor-pointer hover:bg-slate-700 transition ${
                  selectedRoom === room.id ? 'ring-2 ring-amber-400' : ''
                }`}
              >
                <h3 className="font-medium">{room.name}</h3>
                <p className="text-amber-300 font-semibold">${room.price}/night</p>
                <p className="text-slate-400 text-sm">
                  {getNights()} nights = ${room.price * getNights()}
                </p>
              </div>
            ))}
          </div>

          {selectedRoom && (
            <button onClick={() => setStep('confirm')} className={`${styles.button} ${styles.primary} mt-4`}>
              Continue to Confirmation
            </button>
          )}
        </div>
      )}

      {step === 'confirm' && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Confirm Your Booking</h3>
          <div className="bg-slate-800 p-4 rounded">
            <p className="text-slate-300">Room: {getSelectedRoomData()?.name}</p>
            <p className="text-slate-300">Check-in: {dates.checkIn}</p>
            <p className="text-slate-300">Check-out: {dates.checkOut}</p>
            <p className="text-slate-300">Nights: {getNights()}</p>
            <p className="text-amber-300 font-semibold mt-2">
              Total: ${getSelectedRoomData() ? getSelectedRoomData()!.price * getNights() : 0}
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep('select')} className={`${styles.button} ${styles.secondary}`}>
              Back
            </button>
            <button onClick={confirmBooking} className={`${styles.button} ${styles.primary}`}>
              Confirm Booking
            </button>
          </div>
        </div>
      )}

      {step === 'complete' && (
        <div className="text-center space-y-4">
          <div className="text-4xl">🏨</div>
          <h3 className="text-xl font-medium">Booking Confirmed!</h3>
          <p className="text-slate-400 font-mono">{bookingId}</p>
          <p className="text-slate-300">
            {getSelectedRoomData()?.name} • {dates.checkIn} to {dates.checkOut}
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={cancelBooking} className={`${styles.button} ${styles.danger}`}>
              Cancel Booking
            </button>
            <button
              onClick={() => {
                setStep('select');
                setSelectedRoom(null);
                setBookingId('');
              }}
              className={`${styles.button} ${styles.primary}`}
            >
              Book Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// VIDEO TRACKING DEMO
// =============================================================================

const Videos = () => {
  const push = useGtmPush();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const trackedMilestones = useRef<Set<number>>(new Set());

  const videoData = {
    video_id: 'demo-video-001',
    video_title: 'GTM Kit Product Demo',
    video_provider: 'html5',
    video_category: 'product_demo'
  };

  useEffect(() => {
    document.title = 'Videos | React StrictMode example';
  }, []);

  const handlePlay = () => {
    setIsPlaying(true);
    const video = videoRef.current;
    push({
      event: 'video_start',
      ...videoData,
      video_duration: video?.duration || 0,
      video_current_time: video?.currentTime || 0
    });
  };

  const handlePause = () => {
    setIsPlaying(false);
    const video = videoRef.current;
    push({
      event: 'video_pause',
      ...videoData,
      video_duration: video?.duration || 0,
      video_current_time: video?.currentTime || 0,
      video_percent: progress
    });
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;

    const currentProgress = Math.floor((video.currentTime / video.duration) * 100);
    setProgress(currentProgress);

    // Track progress milestones (25%, 50%, 75%)
    const milestones = [25, 50, 75];
    for (const milestone of milestones) {
      if (currentProgress >= milestone && !trackedMilestones.current.has(milestone)) {
        trackedMilestones.current.add(milestone);
        push({
          event: 'video_progress',
          ...videoData,
          video_duration: video.duration,
          video_current_time: video.currentTime,
          video_percent: milestone
        });
      }
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    const video = videoRef.current;
    push({
      event: 'video_complete',
      ...videoData,
      video_duration: video?.duration || 0
    });
    trackedMilestones.current.clear();
  };

  const handleSeek = () => {
    const video = videoRef.current;
    push({
      event: 'video_seek',
      ...videoData,
      video_duration: video?.duration || 0,
      video_current_time: video?.currentTime || 0,
      video_percent: Math.floor(((video?.currentTime || 0) / (video?.duration || 1)) * 100)
    });
  };

  const simulateError = () => {
    push({
      event: 'video_error',
      ...videoData,
      video_error_message: 'Simulated playback error'
    });
  };

  return (
    <div className={styles.widePanel}>
      <div className={styles.pill}>Video Tracking Demo</div>
      <p className="text-sm text-slate-300">
        Video events: video_start, video_progress (25%, 50%, 75%), video_pause, video_seek, video_complete, video_error
      </p>

      <div className="space-y-4">
        {/* Video Player */}
        <div className="bg-slate-800 rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            className="w-full aspect-video bg-black"
            onPlay={handlePlay}
            onPause={handlePause}
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleEnded}
            onSeeked={handleSeek}
            controls
            poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='640' height='360' viewBox='0 0 640 360'%3E%3Crect fill='%231e293b' width='640' height='360'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%2394a3b8' font-size='24' font-family='system-ui'%3EDemo Video Player%3C/text%3E%3C/svg%3E"
          >
            {/* Using a sample video URL - in production, use your own video */}
            <source
              src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
              type="video/mp4"
            />
            Your browser does not support the video tag.
          </video>
        </div>

        {/* Progress Display */}
        <div className="flex items-center gap-4">
          <div className="flex-1 bg-slate-800 rounded-full h-2">
            <div className="bg-amber-400 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-sm text-slate-400">{progress}%</span>
        </div>

        {/* Tracking Status */}
        <div className="flex gap-4 text-sm">
          <span className={`${progress >= 25 ? 'text-amber-300' : 'text-slate-500'}`}>25% ✓</span>
          <span className={`${progress >= 50 ? 'text-amber-300' : 'text-slate-500'}`}>50% ✓</span>
          <span className={`${progress >= 75 ? 'text-amber-300' : 'text-slate-500'}`}>75% ✓</span>
          <span className={`${progress >= 100 ? 'text-amber-300' : 'text-slate-500'}`}>Complete ✓</span>
        </div>

        {/* Video Info */}
        <div className="bg-slate-800 p-4 rounded text-sm">
          <p className="text-slate-300">
            Video ID: <span className={styles.code}>{videoData.video_id}</span>
          </p>
          <p className="text-slate-300">Title: {videoData.video_title}</p>
          <p className="text-slate-300">Provider: {videoData.video_provider}</p>
          <p className="text-slate-300">Status: {isPlaying ? '▶️ Playing' : '⏸️ Paused'}</p>
        </div>

        {/* Simulate Error */}
        <button onClick={simulateError} className={`${styles.button} ${styles.danger}`}>
          Simulate Video Error
        </button>
      </div>
    </div>
  );
};

export default App;
