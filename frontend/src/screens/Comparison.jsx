import { ArrowLeft, Check, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useComparison } from '../context/useComparison';

const formatINR = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);

const rows = [
  ['Brand', (vehicle) => vehicle.brand || 'Not listed'],
  ['Model', (vehicle) => vehicle.model || 'Not listed'],
  ['Price per day', (vehicle) => formatINR(vehicle.daily_rate)],
  ['Fuel type', (vehicle) => vehicle.fuel_type || vehicle.fuel || `${vehicle.fuel_level ?? 'Not listed'}% level`],
  ['Transmission', (vehicle) => vehicle.transmission || 'Not listed'],
  ['Seating capacity', (vehicle) => vehicle.seats ? `${vehicle.seats} seats` : 'Not listed'],
  ['Mileage', (vehicle) => vehicle.mileage || vehicle.mileage_kmpl || 'Not listed'],
  ['Engine / vehicle type', (vehicle) => vehicle.engine_type || vehicle.vehicle_type || vehicle.type || 'Not listed'],
  ['Availability', (vehicle) => vehicle.availability || 'Available'],
  ['Customer rating', (vehicle) => vehicle.rating ? `${vehicle.rating}/5` : 'Not rated'],
];

export default function Comparison() {
  const navigate = useNavigate();
  const { vehicles, removeVehicle, clearVehicles } = useComparison();

  return <main style={styles.page}>
    <div style={styles.header}>
      <div><p style={styles.eyebrow}>FLEET SHORTLIST</p><h1 style={styles.title}>Compare cars</h1><p style={styles.muted}>Review up to three vehicles side by side.</p></div>
      <button type="button" onClick={() => navigate('/catalog')} style={styles.back}><ArrowLeft size={16} /> Back to fleet</button>
    </div>
    {vehicles.length < 2 ? <section style={styles.empty}><h2>Select at least two cars</h2><p style={styles.muted}>Choose cars from the fleet catalog to compare their features and pricing.</p><button type="button" onClick={() => navigate('/catalog')} style={styles.primary}>Choose cars</button></section> : <>
      <div style={styles.actions}><span style={styles.count}>{vehicles.length} cars selected</span><button type="button" onClick={clearVehicles} style={styles.clear}>Clear comparison</button></div>
      <div style={styles.tableWrap}><table style={styles.table}><thead><tr><th style={styles.labelCell}>Vehicle</th>{vehicles.map((vehicle) => <th key={vehicle.id} style={styles.vehicleCell}><img src={vehicle.image_url} alt={`${vehicle.brand} ${vehicle.model}`} style={styles.image} /><strong>{vehicle.brand} {vehicle.model}</strong><button type="button" onClick={() => removeVehicle(vehicle.id)} style={styles.remove}><X size={14} /> Remove</button><button type="button" onClick={() => navigate(`/checkout/${vehicle.id}`, { state: { vehicle } })} style={styles.book}>Book Now</button></th>)}</tr></thead><tbody>{rows.map(([label, getValue]) => { const values = vehicles.map(getValue); const differs = new Set(values).size > 1; return <tr key={label}><th style={styles.labelCell}>{label}</th>{values.map((value, index) => <td key={`${label}-${vehicles[index].id}`} style={{ ...styles.valueCell, ...(differs ? styles.difference : {}) }}>{value}{label === 'Availability' && <Check size={15} color="#18734b" />}</td>)}</tr>; })}</tbody></table></div>
    </>}
  </main>;
}

const styles = {
  page: { width: '100%', maxWidth: 'none', boxSizing: 'border-box', margin: 0, padding: '32px clamp(16px, 3vw, 40px)', color: '#172a46', textAlign: 'left' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '24px' },
  eyebrow: { color: '#087f8c', fontSize: '0.75rem', fontWeight: 'bold', letterSpacing: '1.5px', marginBottom: '8px' },
  title: { margin: 0, color: '#172a46' },
  muted: { color: '#718198', margin: '6px 0' },
  back: { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 12px', background: '#fff', color: '#40536d', border: '1px solid #b9cce2', borderRadius: '7px', cursor: 'pointer' },
  empty: { background: '#fff', border: '1px solid #d9e4f2', borderRadius: '12px', padding: '28px', textAlign: 'center' },
  primary: { marginTop: '14px', padding: '10px 14px', background: '#087f8c', color: '#fff', border: 0, borderRadius: '8px', cursor: 'pointer' },
  actions: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' },
  count: { color: '#087f8c', fontWeight: 'bold' },
  clear: { padding: '8px 12px', background: '#fff0f2', color: '#b42345', border: '1px solid #f3a7b5', borderRadius: '7px', cursor: 'pointer' },
  tableWrap: { overflowX: 'auto', background: '#fff', border: '1px solid #d9e4f2', borderRadius: '12px', boxShadow: '0 12px 30px rgba(38, 76, 112, 0.1)' },
  table: { borderCollapse: 'collapse', width: '100%', minWidth: '680px' },
  labelCell: { width: '160px', padding: '14px', textAlign: 'left', color: '#52637a', borderBottom: '1px solid #e7eef7', verticalAlign: 'middle' },
  vehicleCell: { minWidth: '180px', padding: '14px', textAlign: 'center', borderLeft: '1px solid #e7eef7', borderBottom: '1px solid #e7eef7', verticalAlign: 'top' },
  image: { width: '100%', height: '100px', objectFit: 'cover', borderRadius: '8px', display: 'block', marginBottom: '10px' },
  remove: { display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '10px', padding: '6px 8px', background: '#fff', color: '#b42345', border: '1px solid #f3a7b5', borderRadius: '6px', cursor: 'pointer' },
  book: { display: 'block', width: '100%', marginTop: '8px', padding: '8px', background: '#087f8c', color: '#fff', border: 0, borderRadius: '6px', cursor: 'pointer' },
  valueCell: { padding: '14px', color: '#172a46', borderLeft: '1px solid #e7eef7', borderBottom: '1px solid #e7eef7', textAlign: 'center' },
  difference: { background: '#fff9e9', fontWeight: 'bold' }
};
