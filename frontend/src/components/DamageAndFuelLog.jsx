import { useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { uploadDamageLog } from '../services/api';
import { usePageState } from '../context/usePageState';

export default function DamageAndFuelLog() {
  const { state } = useLocation();
  const bookingId = state?.bookingId || 'BK-9941';

  const videoRef = useRef(null);
  const [part, setPart] = usePageState(`inspection.${bookingId}.part`, 'Front Bumper');
  const [fuel] = usePageState(`inspection.${bookingId}.fuel`, 75);
  const [odometer] = usePageState(`inspection.${bookingId}.odometer`, 45200);
  const [status, setStatus] = usePageState(`inspection.${bookingId}.status`, '');

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
      if (videoRef.current) videoRef.current.srcObject = stream;
    }).catch((err) => console.error("Camera access denied or unavailable:", err));
  }, []);

  const captureAndUpload = () => {
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video?.videoWidth || 640;
    canvas.height = video?.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (video) ctx.drawImage(video, 0, 0);

    canvas.toBlob(async (blob) => {
      const formData = new FormData();
      formData.append('bookingId', bookingId);
      formData.append('vehiclePart', part);
      formData.append('fuelLevel', fuel);
      formData.append('odometer', odometer);
      formData.append('latitude', 17.385);
      formData.append('longitude', 78.4867);
      formData.append('heading', 90);
      formData.append('image', blob, `${part}.jpg`);

      try {
        setStatus('Uploading to MySQL...');
        await uploadDamageLog(formData);
        setStatus('Uploaded successfully to database!');
      } catch {
        setStatus('Upload failed.');
      }
    }, 'image/jpeg');
  };

  return (
    <div style={{ padding: '16px', color: '#172a46', maxWidth: '600px', margin: 'auto' }}>
      <h2>AR Inspection (Booking: {bookingId})</h2>
      <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '260px', borderRadius: '8px', background: '#000', objectFit: 'cover' }} />
      <div style={{ background: '#ffffff', border: '1px solid #d9e4f2', padding: '12px', marginTop: '12px', borderRadius: '12px', boxShadow: '0 12px 30px rgba(38, 76, 112, 0.1)' }}>
        <label style={{ display: 'block', marginBottom: '4px' }}>Select Part:</label>
        <select value={part} onChange={(e) => setPart(e.target.value)} style={{ width: '100%', padding: '8px', marginBottom: '12px', background: '#f8fbff', color: '#172a46', border: '1px solid #b9cce2', borderRadius: '7px' }}>
          <option>Front Bumper</option>
          <option>Driver Door</option>
          <option>Rear Bumper</option>
        </select>
        <button onClick={captureAndUpload} style={{ width: '100%', padding: '12px', background: '#087f8c', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
          Capture & Upload Direct to Server
        </button>
        {status && <p style={{ color: '#18734b', marginTop: '8px' }}>{status}</p>}
      </div>
    </div>
  );
}