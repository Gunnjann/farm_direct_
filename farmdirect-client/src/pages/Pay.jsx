import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth, useCart, useToast } from '../context/AppContext';
import { api } from '../lib/api';
import { rupees } from '../lib/format';
import { Button, ErrorBox, Icon, Loading } from '../components/ui';

function loadRazorpay() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = resolve;
    s.onerror = () => reject(new Error('Could not load Razorpay. Check your internet connection.'));
    document.body.appendChild(s);
  });
}

/**
 * Payment screen. The browser NEVER decides that a payment succeeded:
 *  - Razorpay mode: we send Razorpay's ids + signature to the API, which verifies them.
 *  - Mock mode (dev only): the API simulates the gateway.
 */
export default function Pay() {
  const { checkoutId } = useParams();
  const { state } = useLocation();
  const { user } = useAuth();
  const cart = useCart();
  const toast = useToast();
  const nav = useNavigate();
  const [payment, setPayment] = useState(state?.checkout?.payment || null);
  const [config, setConfig] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/config').then(setConfig).catch(setError);
    if (!payment) api(`/checkout/payment/${checkoutId}`).then((d) => setPayment(d.payment)).catch(setError);
  }, [checkoutId]); // eslint-disable-line react-hooks/exhaustive-deps

  const done = () => {
    if (state?.kind === 'cart') cart.clear();
    toast('Payment successful', 'ok');
    if (state?.kind === 'group' && state.groupId) nav(`/groups/${state.groupId}`, { replace: true });
    else if (state?.checkout?.orders?.length === 1) nav(`/orders/${state.checkout.orders[0]._id}`, { replace: true });
    else nav('/orders', { replace: true });
  };

  const payMock = async (outcome) => {
    setBusy(true);
    setError(null);
    try {
      const r = await api('/checkout/mock/complete', { method: 'POST', body: { providerOrderId: payment.providerOrderId, outcome } });
      if (r.ok) done();
      else toast(r.message, 'error');
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  const payRazorpay = async () => {
    setBusy(true);
    setError(null);
    try {
      await loadRazorpay();
      const rzp = new window.Razorpay({
        key: config.razorpayKeyId,
        order_id: payment.providerOrderId,
        amount: payment.amount,
        currency: 'INR',
        name: 'FarmDirect',
        description: `Order ${checkoutId.slice(-8)}`,
        prefill: { name: user.name, email: user.email, contact: user.phone },
        theme: { color: '#141414' },
        handler: async (resp) => {
          try {
            await api('/checkout/verify', { method: 'POST', body: resp });
            done();
          } catch (e) {
            setError(e);
          } finally {
            setBusy(false);
          }
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      rzp.on('payment.failed', (r) => {
        toast(r.error?.description || 'Payment failed. You can try again.', 'error');
        setBusy(false);
      });
      rzp.open();
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  };

  if (!payment || !config) return error ? <div className="container page"><ErrorBox error={error} /></div> : <Loading label="Preparing payment…" />;

  if (payment.status === 'paid')
    return (
      <div className="container page">
        <div className="empty stack">
          <h2>Already paid</h2>
          <Button onClick={() => nav('/orders')}>View orders</Button>
        </div>
      </div>
    );

  return (
    <div className="container page" style={{ maxWidth: 560 }}>
      <div className="card stack" style={{ '--gap': '18px' }}>
        <div className="panel-title">
          <span>Pay securely</span>
          <Icon name="shield" />
        </div>
        <div className="center">
          <div className="eyebrow">Amount to pay</div>
          <div className="price" style={{ fontSize: '2.6rem' }}>
            {rupees(payment.amount)}
          </div>
          <div className="tiny muted mono">{payment.checkoutId}</div>
        </div>
        {payment.status === 'expired' && (
          <div className="alert warn small">
            <Icon name="alert" /> The stock hold expired. If you pay now, we'll confirm the order if stock is still available — otherwise you're refunded automatically.
          </div>
        )}

        {config.paymentMode === 'razorpay' ? (
          <Button variant="primary" size="lg" block loading={busy} onClick={payRazorpay}>
            Pay with UPI / Card / Netbanking
          </Button>
        ) : (
          <div className="card flat tint-turmeric stack">
            <strong>Test payment mode</strong>
            <p className="small" style={{ margin: 0 }}>
              Razorpay keys are not configured, so this server simulates the gateway. No real money moves. Set <span className="mono">PAYMENT_MODE=razorpay</span> to use Razorpay test mode.
            </p>
            <div className="row">
              <Button variant="leaf" className="grow" loading={busy} onClick={() => payMock('success')}>
                Simulate success
              </Button>
              <Button variant="ghost" disabled={busy} onClick={() => payMock('failure')}>
                Simulate failure
              </Button>
            </div>
          </div>
        )}
        <ErrorBox error={error} />
        <p className="tiny muted center" style={{ margin: 0 }}>
          If money is deducted but the order doesn't confirm, it's confirmed automatically within minutes or refunded in full.
        </p>
      </div>
    </div>
  );
}
