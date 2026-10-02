import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Fuel, Users, ArrowRight, CalendarDays, Bookmark, GitCompare, ScanEye } from 'lucide-react';
import { addFavorite, getFavorites, getVehicles, removeFavorite } from '../services/api';
import { useComparison } from '../context/useComparison';
import { usePageState } from '../context/usePageState';
import CarWalkthrough from '../components/CarWalkthrough';

const formatINR = (amount) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);

const EMPTY_LIST = [];
const EMPTY_DATES = { startDate: '', endDate: '' };

export default function VehicleCatalog() {
  const navigate = useNavigate();
  const [vehicles, setVehicles] = usePageState('catalog.vehicles', EMPTY_LIST);
  const [search, setSearch] = usePageState('catalog.search', '');
  const [dates, setDates] = usePageState('catalog.dates', EMPTY_DATES);
  const [searchedDates, setSearchedDates] = usePageState('catalog.searchedDates', null);
  const [favoriteIds, setFavoriteIds] = usePageState('catalog.favoriteIds', EMPTY_LIST);
  const [sortBy, setSortBy] = usePageState('catalog.sortBy', 'recommended');
  const [fuelFilter, setFuelFilter] = usePageState('catalog.fuelFilter', 'all');
  const [seatFilter, setSeatFilter] = usePageState('catalog.seatFilter', 'all');
  const [priceFilter, setPriceFilter] = usePageState('catalog.priceFilter', 'all');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [walkthroughVehicle, setWalkthroughVehicle] = useState(null);
  const { vehicles: comparedVehicles, toggleVehicle } = useComparison();

  useEffect(() => {
    if (!localStorage.getItem('rentalToken')) return;
    getFavorites().then(({ data }) => setFavoriteIds(data.map((vehicle) => vehicle.id))).catch(() => {});
  }, [setFavoriteIds]);

  const toggleFavorite = async (vehicleId) => {
    if (!localStorage.getItem('rentalToken')) {
      navigate('/login', { state: { from: '/catalog' } });
      return;
    }
    const isFavorite = favoriteIds.includes(vehicleId);
    try {
      if (isFavorite) await removeFavorite(vehicleId);
      else await addFavorite(vehicleId);
      setFavoriteIds(isFavorite ? favoriteIds.filter((id) => id !== vehicleId) : [...favoriteIds, vehicleId]);
    } catch {
      setError('Could not update your favorites.');
    }
  };

  const findAvailableVehicles = async (event) => {
    event.preventDefault();
    if (!dates.startDate || !dates.endDate || dates.startDate >= dates.endDate) {
      setError('Choose a return date after the pickup date.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await getVehicles(dates);
      setVehicles(response.data);
      setSearchedDates(dates);
    } catch {
      setError('Could not load vehicles. Ensure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const filtered = vehicles
    .filter((v) => `${v.brand} ${v.model}`.toLowerCase().includes(search.toLowerCase()))
    .filter((v) => fuelFilter === 'all' || v.fuel_type === fuelFilter)
    .filter((v) => seatFilter === 'all' || Number(v.seats) >= Number(seatFilter))
    .filter((v) => {
      if (priceFilter === 'all') return true;
      if (priceFilter === 'under-1500') return Number(v.daily_rate) <= 1500;
      if (priceFilter === '1500-2500') return Number(v.daily_rate) > 1500 && Number(v.daily_rate) <= 2500;
      if (priceFilter === '2500-plus') return Number(v.daily_rate) > 2500;
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'price-low': return Number(a.daily_rate) - Number(b.daily_rate);
        case 'price-high': return Number(b.daily_rate) - Number(a.daily_rate);
        case 'rating': return Number(b.rating || 0) - Number(a.rating || 0);
        case 'seats': return Number(b.seats || 0) - Number(a.seats || 0);
        default:
          return (Number(b.rating || 0) * 10 + Number(b.seats || 0)) - (Number(a.rating || 0) * 10 + Number(a.seats || 0));
      }
    });

  const featuredVehicles = filtered.slice(0, 3);

  return (
    <div style={styles.container}>
      <div style={styles.heroPanel}>
        <div>
          <p style={styles.heroEyebrow}>Ready for your next trip?</p>
          <h2 style={styles.heroTitle}>Find a vehicle that fits your plans</h2>
        </div>
        <div style={styles.heroStats}>
          <div style={styles.statBox}><strong>4.9/5</strong><span>Average rating</span></div>
          <div style={styles.statBox}><strong>120+</strong><span>Trips booked</span></div>
          <div style={styles.statBox}><strong>24/7</strong><span>Support</span></div>
        </div>
      </div>

      <div style={styles.featureRow}>
        <div style={styles.featurePill}>Transparent pricing</div>
        <div style={styles.featurePill}>Instant booking</div>
        <div style={styles.featurePill}>Verified vehicles</div>
      </div>

      <h2 style={{ color: '#172a46', marginBottom: '16px' }}>Find a vehicle</h2>
      <form onSubmit={findAvailableVehicles} style={styles.datePanel}>
        <div style={styles.dateHeading}><CalendarDays size={18} /> Choose your rental dates</div>
        <div style={styles.dateFields}>
          <label style={styles.dateLabel}>
            Pickup date
            <input type="date" value={dates.startDate} min={new Date().toISOString().split('T')[0]} onChange={(e) => setDates({ ...dates, startDate: e.target.value })} style={styles.dateInput} required />
          </label>
          <label style={styles.dateLabel}>
            Return date
            <input type="date" value={dates.endDate} min={dates.startDate || new Date().toISOString().split('T')[0]} onChange={(e) => setDates({ ...dates, endDate: e.target.value })} style={styles.dateInput} required />
          </label>
        </div>
        <button type="submit" disabled={loading} style={styles.searchButton}>{loading ? 'Checking availability...' : 'Show available cars'}</button>
        {error && <p role="alert" style={styles.error}>{error}</p>}
      </form>
      {searchedDates && <p style={styles.resultText}>
        {vehicles.length > 0
          ? `${vehicles.length} vehicle${vehicles.length === 1 ? '' : 's'} available from ${searchedDates.startDate} to ${searchedDates.endDate}.`
          : `No vehicles are available from ${searchedDates.startDate} to ${searchedDates.endDate}. Try different rental dates.`}
      </p>}
      <div style={styles.filterRow}>
        <div style={styles.searchBar}>
          <Search size={18} color="#94a3b8" />
          <input
            type="text"
            placeholder="Search make or model..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={styles.input}
          />
        </div>

        <div style={styles.filterControls}>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={styles.selectInput}>
            <option value="recommended">Recommended</option>
            <option value="price-low">Price: Low to high</option>
            <option value="price-high">Price: High to low</option>
            <option value="rating">Top rated</option>
            <option value="seats">Most spacious</option>
          </select>
          <select value={fuelFilter} onChange={(e) => setFuelFilter(e.target.value)} style={styles.selectInput}>
            <option value="all">All fuel</option>
            <option value="Petrol">Petrol</option>
            <option value="Diesel">Diesel</option>
            <option value="Electric">Electric</option>
          </select>
          <select value={seatFilter} onChange={(e) => setSeatFilter(e.target.value)} style={styles.selectInput}>
            <option value="all">Any seats</option>
            <option value="4">4+ seats</option>
            <option value="5">5+ seats</option>
            <option value="7">7+ seats</option>
          </select>
          <select value={priceFilter} onChange={(e) => setPriceFilter(e.target.value)} style={styles.selectInput}>
            <option value="all">Any price</option>
            <option value="under-1500">Under ₹1,500</option>
            <option value="1500-2500">₹1,500 - ₹2,500</option>
            <option value="2500-plus">₹2,500+</option>
          </select>
        </div>
      </div>

      {featuredVehicles.length > 0 && (
        <div style={styles.featuredSection}>
          <div style={styles.featuredHeader}>
            <h3 style={styles.featuredTitle}>Popular this week</h3>
            <span style={styles.featuredTag}>Top picks</span>
          </div>
          <div style={styles.featuredGrid}>
            {featuredVehicles.map((v) => (
              <button key={v.id} type="button" onClick={() => navigate(`/checkout/${v.id}`, { state: { vehicle: v, ...searchedDates } })} style={styles.featuredCard}>
                <img src={v.image_url} alt={v.model} style={styles.featuredImage} />
                <div style={styles.featuredMeta}>
                  <strong>{v.brand} {v.model}</strong>
                  <span>{formatINR(v.daily_rate)} / day</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={styles.compareBar}>{comparedVehicles.length > 0 && <span>{comparedVehicles.length}/3 cars selected</span>} {comparedVehicles.length >= 2 && <button type="button" onClick={() => navigate('/compare')} style={styles.compareButton}><GitCompare size={16} /> Compare Cars</button>}</div>
      <div style={styles.grid}>
        {filtered.map((v) => (
          <div key={v.id} style={styles.card}>
            <img src={v.image_url} alt={v.model} style={styles.image} />
            <div style={styles.cardBody}>
              <div style={styles.titleRow}><h3>{v.brand} {v.model}</h3><button type="button" aria-label={favoriteIds.includes(v.id) ? `Remove ${v.brand} ${v.model} from favorites` : `Save ${v.brand} ${v.model} to favorites`} onClick={() => toggleFavorite(v.id)} style={styles.favoriteButton}><Bookmark size={18} fill={favoriteIds.includes(v.id) ? '#38bdf8' : 'none'} /></button></div>
              <p style={{ color: '#087f8c' }}>{formatINR(v.daily_rate)} / day</p>
              <div style={styles.specRow}>
                <span><Fuel size={14} /> {v.fuel_level}%</span>
                <span><Users size={14} /> {v.seats} Seats</span>
              </div>
              <label style={styles.compareLabel}><input type="checkbox" checked={comparedVehicles.some((vehicle) => String(vehicle.id) === String(v.id))} onChange={() => { if (comparedVehicles.length >= 3 && !comparedVehicles.some((vehicle) => String(vehicle.id) === String(v.id))) setError('You can compare a maximum of 3 cars.'); else { setError(''); toggleVehicle(v); } }} /> Compare</label>
              <button type="button" onClick={() => setWalkthroughVehicle(v)} style={styles.exploreButton}><ScanEye size={16} /> Explore inside</button>
              <button
                style={styles.btn}
                onClick={() => navigate(`/checkout/${v.id}`, { state: { vehicle: v, ...searchedDates } })}
              >
                Book Now <ArrowRight size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
      {walkthroughVehicle && <CarWalkthrough vehicle={walkthroughVehicle} onClose={() => setWalkthroughVehicle(null)} />}
    </div>
  );
}

const styles = {
  container: { width: '100%', boxSizing: 'border-box', padding: '24px clamp(16px, 3vw, 40px)', color: '#172a46', maxWidth: 'none', margin: 0 },
  heroPanel: { display: 'grid', gap: '20px', background: 'linear-gradient(135deg, rgba(8,127,140,0.12), rgba(232,155,24,0.1))', border: '1px solid #d9e4f2', borderRadius: '16px', padding: '20px', marginBottom: '16px', boxShadow: '0 14px 30px rgba(38, 76, 112, 0.08)' },
  heroEyebrow: { margin: '0 0 6px', color: '#087f8c', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: '0.72rem' },
  heroTitle: { margin: 0, fontSize: '2rem', color: '#172a46' },
  heroStats: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' },
  statBox: { background: '#ffffff', border: '1px solid #d9e4f2', borderRadius: '10px', padding: '12px', display: 'grid', gap: '4px', color: '#172a46' },
  featureRow: { display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '12px', margin: '0 0 18px' },
  featurePill: { flex: '1 1 0', minWidth: '150px', textAlign: 'center', background: '#dff7f3', color: '#087f8c', border: '1.5px solid #7bc8c1', borderRadius: '999px', padding: '12px 18px', fontSize: '1rem', fontWeight: '700', boxShadow: 'inset 0 0 0 1px rgba(8,127,140,0.05)' },
  filterRow: { display: 'grid', gap: '12px', marginBottom: '16px' },
  searchBar: { display: 'flex', gap: '8px', background: '#ffffff', border: '1px solid #d9e4f2', padding: '10px', borderRadius: '10px', boxShadow: '0 10px 28px rgba(38, 76, 112, 0.08)' },
  input: { background: 'none', border: 'none', color: '#172a46', outline: 'none', width: '100%' },
  filterControls: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' },
  selectInput: { width: '100%', boxSizing: 'border-box', padding: '9px 10px', background: '#f8fbff', color: '#172a46', border: '1px solid #b9cce2', borderRadius: '8px', outline: 'none' },
  datePanel: { background: '#ffffff', border: '1px solid #d9e4f2', padding: '16px', borderRadius: '12px', marginBottom: '16px', textAlign: 'left', boxShadow: '0 10px 28px rgba(38, 76, 112, 0.08)' },
  dateHeading: { display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', marginBottom: '12px' },
  dateFields: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' },
  dateLabel: { display: 'grid', gap: '6px', color: '#52637a', fontSize: '0.85rem' },
  dateInput: { width: '100%', boxSizing: 'border-box', padding: '9px', background: '#f8fbff', color: '#172a46', colorScheme: 'light', accentColor: '#087f8c', border: '1px solid #b9cce2', borderRadius: '7px' },
  searchButton: { width: '100%', marginTop: '14px', padding: '10px', background: '#087f8c', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' },
  compareBar: { display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px', minHeight: '42px', color: '#087f8c', fontSize: '0.9rem', fontWeight: 'bold' },
  compareButton: { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 12px', background: '#e89b18', color: '#172a46', border: 0, borderRadius: '7px', cursor: 'pointer', fontWeight: 'bold' },
  error: { color: '#b42345', marginTop: '10px', fontSize: '0.9rem' },
  resultText: { color: '#52637a', marginBottom: '12px', fontSize: '0.9rem' },
  featuredSection: { marginBottom: '18px', background: '#ffffff', border: '1px solid #d9e4f2', borderRadius: '12px', padding: '14px', boxShadow: '0 10px 28px rgba(38, 76, 112, 0.08)' },
  featuredHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' },
  featuredTitle: { margin: 0, color: '#172a46', fontSize: '1.05rem' },
  featuredTag: { color: '#087f8c', background: '#e1f7f5', border: '1px solid #a7dfda', borderRadius: '999px', padding: '4px 9px', fontSize: '0.75rem', fontWeight: '700' },
  featuredGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' },
  featuredCard: { display: 'grid', background: '#f7fbff', border: '1px solid #d9e4f2', borderRadius: '10px', overflow: 'hidden', cursor: 'pointer', padding: 0, textAlign: 'left' },
  featuredImage: { width: '100%', height: '90px', objectFit: 'cover' },
  featuredMeta: { display: 'grid', gap: '4px', padding: '10px 12px', color: '#172a46' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' },
  card: { background: '#ffffff', border: '1px solid #d9e4f2', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 12px 30px rgba(38, 76, 112, 0.1)', transition: 'transform 0.2s ease, box-shadow 0.2s ease', cursor: 'pointer' },
  image: { width: '100%', height: '140px', objectFit: 'cover' },
  cardBody: { padding: '12px' },
  titleRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' },
  favoriteButton: { display: 'grid', placeItems: 'center', padding: '6px', color: '#087f8c', background: '#e1f7f5', border: '1px solid #a7dfda', borderRadius: '7px', cursor: 'pointer' },
  specRow: { display: 'flex', gap: '12px', fontSize: '0.85rem', color: '#52637a', marginBottom: '12px' },
  compareLabel: { display: 'flex', alignItems: 'center', gap: '6px', color: '#40536d', fontSize: '0.85rem', marginBottom: '10px' },
  exploreButton: { width: '100%', display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: '7px', marginBottom: '8px', padding: '9px', color: '#087f8c', background: '#e1f7f5', border: '1px solid #a7dfda', borderRadius: '7px', cursor: 'pointer', fontWeight: '700' },
  btn: { width: '100%', padding: '10px', background: '#087f8c', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }
};