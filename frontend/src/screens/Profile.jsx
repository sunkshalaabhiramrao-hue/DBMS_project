import { useEffect, useState } from 'react';
import { Bookmark, MessageSquareText, Save, UserRound, MapPinned } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getBookings, getFavorites, getProfile, removeFavorite, updateProfile } from '../services/api';
import { usePageState } from '../context/usePageState';

const EMPTY_FEEDBACK = { rating: '5', comment: '' };

export default function Profile() {
  const navigate = useNavigate();
  const [form, setForm] = usePageState('profile.form', null);
  const formValues = form || { name: '', email: '' };
  const [favorites, setFavorites] = useState([]);
  const [trips, setTrips] = useState([]);
  const [feedback, setFeedback] = usePageState('profile.feedback', EMPTY_FEEDBACK);
  const [feedbackSubmitted, setFeedbackSubmitted] = usePageState('profile.feedbackSubmitted', false);
  const [status, setStatus] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([getProfile(), getFavorites(), getBookings()])
      .then(([profileResponse, favoritesResponse, bookingsResponse]) => {
        setForm((current) => current || { name: profileResponse.data.name, email: profileResponse.data.email });
        setFavorites(favoritesResponse.data);
        setTrips(bookingsResponse.data || []);
      })
      .catch((err) => setStatus({ type: 'error', text: err.response?.data?.error || 'Could not load your profile.' }))
      .finally(() => setLoading(false));
  }, [setForm]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setStatus({ type: '', text: '' });
    try {
      const { data } = await updateProfile(formValues);
      localStorage.setItem('rentalUser', JSON.stringify({ id: data.id, name: data.name, email: data.email }));
      setForm({ name: data.name, email: data.email });
      setStatus({ type: 'success', text: 'Profile updated successfully.' });
    } catch (err) {
      setStatus({ type: 'error', text: err.response?.data?.error || 'Could not update your profile.' });
    } finally {
      setSaving(false);
    }
  };

  const removeFavoriteVehicle = async (vehicleId) => {
    try {
      await removeFavorite(vehicleId);
      setFavorites(favorites.filter((favorite) => favorite.id !== vehicleId));
    } catch (err) {
      setStatus({ type: 'error', text: err.response?.data?.error || 'Could not remove favorite.' });
    }
  };

  const submitFeedback = (event) => {
    event.preventDefault();
    setFeedbackSubmitted(true);
    setStatus({ type: 'success', text: 'Thank you for your feedback.' });
    setFeedback({ rating: '5', comment: '' });
  };

  return <main style={styles.page}>
    <section style={styles.card}>
      <div style={styles.icon}><UserRound size={24} /></div>
      <p style={styles.eyebrow}>ACCOUNT SETTINGS</p>
      <h1 style={styles.title}>Your profile</h1>
      <p style={styles.subtitle}>Keep your contact details current for every reservation.</p>
      <form onSubmit={handleSubmit} style={styles.form}>
        <label style={styles.label}>Full name<input value={formValues.name} onChange={(e) => setForm({ ...formValues, name: e.target.value })} disabled={loading} required style={styles.input} /></label>
        <label style={styles.label}>Email address<input type="email" value={formValues.email} onChange={(e) => setForm({ ...formValues, email: e.target.value })} disabled={loading} required style={styles.input} /></label>
        {status.text && <p role="status" style={status.type === 'error' ? styles.error : styles.success}>{status.text}</p>}
        <button type="submit" disabled={loading || saving} style={styles.button}><Save size={17} /> {saving ? 'Saving...' : 'Save changes'}</button>
      </form>
    </section>

    <section style={styles.card}>
      <div style={styles.sectionHeading}><MapPinned size={21} color="#38bdf8" /><h2 style={styles.sectionTitle}>Previous trip details</h2></div>
      {trips.length === 0 ? <p style={styles.sectionText}>No past trips yet. Your completed bookings will appear here.</p> : <div style={styles.tripList}>{trips.slice(0, 3).map((trip) => <div key={trip.id} style={styles.tripItem}><div><strong>{trip.brand} {trip.model}</strong><p style={styles.tripMeta}>{trip.start_date} to {trip.end_date}</p></div><div style={styles.tripMetaBox}><span>{trip.pickup_location_name || 'Pickup branch'}</span><strong>{trip.total_amount ? `₹${trip.total_amount}` : '₹0'}</strong></div></div>)}</div>}
    </section>

    <section style={styles.card}>
      <div style={styles.sectionHeading}><MessageSquareText size={21} color="#38bdf8" /><h2 style={styles.sectionTitle}>Feedback</h2></div>
      <form onSubmit={submitFeedback} style={styles.form}>
        <label style={styles.label}>Your rating<select value={feedback.rating} onChange={(e) => setFeedback({ ...feedback, rating: e.target.value })} style={styles.input}><option value="5">5 - Excellent</option><option value="4">4 - Very good</option><option value="3">3 - Good</option><option value="2">2 - Fair</option><option value="1">1 - Poor</option></select></label>
        <label style={styles.label}>Comments<textarea value={feedback.comment} onChange={(e) => setFeedback({ ...feedback, comment: e.target.value })} rows="4" placeholder="Tell us about your trip experience..." style={{ ...styles.input, resize: 'vertical', minHeight: '110px' }} /></label>
        {feedbackSubmitted && <p style={styles.success}>Feedback submitted successfully.</p>}
        <button type="submit" style={styles.button}>Submit feedback</button>
      </form>
    </section>

    <section style={styles.card}>
      <div style={styles.sectionHeading}><Bookmark size={21} color="#38bdf8" /><h2 style={styles.sectionTitle}>Favorite vehicles</h2></div>
      {favorites.length === 0 ? <p style={styles.sectionText}>No favorites yet. Save vehicles from the fleet catalog for quick access.</p> : <div style={styles.favoriteList}>{favorites.map((vehicle) => <div key={vehicle.id} style={styles.favoriteRow}><div><strong>{vehicle.brand} {vehicle.model}</strong><span style={styles.favoriteMeta}> {vehicle.seats} seats</span></div><button type="button" onClick={() => removeFavoriteVehicle(vehicle.id)} style={styles.removeButton}>Remove</button></div>)}</div>}
      <button type="button" onClick={() => navigate('/catalog')} style={styles.secondaryButton}>Browse fleet catalog</button>
    </section>
  </main>;
}

const styles = {
  page: { width: '100%', minHeight: '100%', display: 'grid', gap: '18px', padding: '32px clamp(16px, 3vw, 40px)', boxSizing: 'border-box', maxWidth: 'none', margin: 0 },
  card: { width: '100%', boxSizing: 'border-box', background: '#ffffff', border: '1px solid #d9e4f2', borderRadius: '16px', padding: '28px', textAlign: 'left', boxShadow: '0 20px 45px rgba(38, 76, 112, 0.14)' },
  icon: { width: '48px', height: '48px', display: 'grid', placeItems: 'center', color: '#087f8c', background: '#dff8f4', borderRadius: '12px', marginBottom: '20px' },
  eyebrow: { color: '#087f8c', fontSize: '0.75rem', fontWeight: 'bold', letterSpacing: '1.5px', marginBottom: '8px' },
  title: { color: '#172a46', fontSize: '2rem', margin: '0 0 8px' },
  subtitle: { color: '#52637a', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: '24px' },
  form: { display: 'grid', gap: '16px' },
  label: { display: 'grid', gap: '6px', color: '#40536d', fontSize: '0.9rem', fontWeight: '600' },
  input: { width: '100%', boxSizing: 'border-box', padding: '11px 12px', background: '#f8fbff', color: '#172a46', border: '1px solid #b9cce2', borderRadius: '8px', fontSize: '1rem', outline: 'none' },
  sectionHeading: { display: 'flex', alignItems: 'center', gap: '9px' },
  sectionTitle: { color: '#172a46', fontSize: '1.25rem', margin: 0 },
  sectionText: { color: '#52637a', fontSize: '0.9rem', lineHeight: 1.5 },
  tripList: { display: 'grid', gap: '10px', marginTop: '16px' },
  tripItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '12px', background: '#f3f8ff', border: '1px solid #d9e4f2', borderRadius: '8px' },
  tripMeta: { margin: '4px 0 0', color: '#718198', fontSize: '0.85rem' },
  tripMetaBox: { display: 'grid', textAlign: 'right', color: '#172a46', fontSize: '0.85rem', gap: '4px' },
  favoriteList: { display: 'grid', gap: '8px', margin: '16px 0' },
  favoriteRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '12px', background: '#f3f8ff', color: '#172a46', border: '1px solid #d9e4f2', borderRadius: '8px' },
  favoriteMeta: { color: '#718198', fontSize: '0.85rem' },
  button: { display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: '8px', padding: '12px', background: '#087f8c', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.95rem', cursor: 'pointer' },
  secondaryButton: { padding: '10px 14px', background: '#e1f7f5', color: '#087f8c', border: '1px solid #a7dfda', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' },
  removeButton: { padding: '6px 9px', background: '#fff0f2', color: '#c2415d', border: '1px solid #f3a7b5', borderRadius: '6px', cursor: 'pointer' },
  error: { color: '#b42345', background: '#fff0f2', padding: '10px 12px', borderRadius: '8px', margin: 0 },
  success: { color: '#18734b', background: '#e5f8ed', padding: '10px 12px', borderRadius: '8px', margin: 0 }
};
