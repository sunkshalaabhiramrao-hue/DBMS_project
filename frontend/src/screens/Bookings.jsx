import { useEffect, useState } from 'react';
import { CalendarDays, CheckCircle2, CircleX, Clock3 } from 'lucide-react';
import { cancelBooking, getBookings } from '../services/api';

const formatINR = (amount) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0
}).format(amount);

const bookingStatusLabels = {
  awaiting_license: 'Awaiting license approval',
  license_rejected: 'License rejected',
  awaiting_payment: 'Ready for payment',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled'
};

const formatTime = (time) => {
  if (!time) return 'Not specified';
  const [hours, minutes] = String(time).split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return time;
  return new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(2000, 0, 1, hours, minutes));
};

export default function Bookings() {
  const [bookings, setBookings] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState('');

  const loadBookings = async () => {
    try {
      const response = await getBookings();
      setBookings(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load your bookings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getBookings().then((response) => setBookings(response.data))
      .catch((err) => setError(err.response?.data?.error || 'Could not load your bookings.'))
      .finally(() => setLoading(false));
  }, []);

  const handleCancel = async (bookingId) => {
    if (!window.confirm('Cancel this booking?')) return;
    setCancelling(bookingId);
    setError('');
    try {
      await cancelBooking(bookingId);
      await loadBookings();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not cancel the booking.');
    } finally {
      setCancelling('');
    }
  };

  return (
    <main style={styles.page}>
      <div style={styles.heading}><div><p style={styles.eyebrow}>YOUR DRIVEIN ACCOUNT</p><h1 style={styles.title}>My bookings</h1></div><CalendarDays color="#087f8c" size={32} /></div>
      {error && <p role="alert" style={styles.error}>{error}</p>}
      {loading && <p style={styles.muted}>Loading your reservations...</p>}
      {!loading && bookings.length === 0 && <div style={styles.empty}><h2>No bookings yet</h2><p style={styles.muted}>Your confirmed reservations will appear here.</p></div>}
      <div style={styles.list}>
        {bookings.map((booking) => {
          const cancelled = booking.status === 'cancelled';
          const statusStyle = cancelled || booking.status === 'license_rejected'
            ? styles.cancelled
            : booking.status === 'confirmed'
              ? styles.confirmed
              : styles.awaiting;
          return <article key={booking.id} style={styles.booking}>
            <div style={styles.bookingTop}><div><h2 style={styles.vehicle}>{booking.brand} {booking.model}</h2><p style={styles.muted}>{booking.id}</p></div><span style={{ ...styles.status, ...statusStyle }}>{bookingStatusLabels[booking.status] || booking.status || 'Pending'}</span></div>
            <p style={styles.dates}><CalendarDays size={16} color="#087f8c" /> {booking.start_date} to {booking.end_date}</p>
            <p style={styles.pickup}><Clock3 size={16} color="#087f8c" /> Pickup time: {formatTime(booking.pickup_time)}</p>
            <p style={styles.pickup}><span aria-hidden="true">⌖</span><span>Pickup branch: {booking.pickup_location_name ? `${booking.pickup_location_name}${booking.pickup_location_city ? `, ${booking.pickup_location_city}` : ''}` : 'Not recorded for this booking'}{booking.pickup_location_address && <><br />{booking.pickup_location_address}</>}</span></p>
            <p style={styles.pickup}><Clock3 size={16} color="#e89b18" /> Checkout time: {formatTime(booking.checkout_time)}</p>
            {!cancelled && booking.status === 'confirmed' && <p style={styles.deployment}>Vehicle deployment: {booking.deployment_status || 'Scheduled'}</p>}
            {booking.status === 'awaiting_payment' && <p style={styles.paymentNote}>Your license is approved. Complete payment from the license section to confirm this booking.</p>}
            <p style={styles.amount}>{formatINR(booking.total_amount)}</p>
            {!cancelled && <button type="button" disabled={cancelling === booking.id} onClick={() => handleCancel(booking.id)} style={styles.cancelButton}><CircleX size={16} /> {cancelling === booking.id ? 'Cancelling...' : 'Cancel booking'}</button>}
            {cancelled && <p style={styles.cancelNote}><CheckCircle2 size={16} /> This booking has been cancelled.</p>}
          </article>;
        })}
      </div>
    </main>
  );
}

const styles = {
  page: { width: '100%', maxWidth: 'none', boxSizing: 'border-box', margin: 0, padding: '32px clamp(16px, 3vw, 40px)', color: '#172a46', textAlign: 'left' },
  heading: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
  eyebrow: { color: '#087f8c', fontSize: '0.75rem', fontWeight: 'bold', letterSpacing: '1.5px', marginBottom: '8px' },
  title: { color: '#172a46', margin: 0, fontSize: '2rem' },
  list: { display: 'grid', gap: '14px' },
  booking: { background: '#ffffff', border: '1px solid #d9e4f2', borderRadius: '12px', padding: '18px', boxShadow: '0 12px 30px rgba(38, 76, 112, 0.1)' },
  bookingTop: { display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' },
  vehicle: { color: '#172a46', margin: 0, fontSize: '1.1rem' },
  muted: { color: '#718198', margin: '4px 0' },
  status: { display: 'inline-flex', padding: '5px 9px', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 'bold' },
  confirmed: { color: '#18734b', background: '#e5f8ed' },
  awaiting: { color: '#805d16', background: '#fff5d6' },
  cancelled: { color: '#b42345', background: '#fff0f2' },
  dates: { display: 'flex', alignItems: 'center', gap: '7px', color: '#52637a', margin: '18px 0 6px' },
  pickup: { display: 'flex', alignItems: 'center', gap: '7px', color: '#52637a', margin: '6px 0' },
  locationNote: { color: '#52637a', background: '#f8fbff', padding: '8px', borderRadius: '7px', fontSize: '0.85rem' },
  deployment: { color: '#18734b', margin: '6px 0 14px', fontWeight: 'bold' },
  paymentNote: { color: '#805d16', margin: '8px 0', fontSize: '0.88rem' },
  amount: { color: '#087f8c', fontWeight: 'bold', margin: 0 },
  cancelButton: { display: 'inline-flex', alignItems: 'center', gap: '7px', marginTop: '16px', padding: '9px 12px', background: '#fff0f2', color: '#c2415d', border: '1px solid #f3a7b5', borderRadius: '7px', cursor: 'pointer' },
  cancelNote: { display: 'flex', alignItems: 'center', gap: '7px', color: '#18734b', margin: '16px 0 0', fontSize: '0.9rem' },
  empty: { background: '#ffffff', border: '1px solid #d9e4f2', padding: '24px', borderRadius: '12px' },
  error: { color: '#b42345', background: '#fff0f2', padding: '10px 12px', borderRadius: '8px' }
};
