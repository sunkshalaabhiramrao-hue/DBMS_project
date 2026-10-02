import { useEffect, useRef, useState } from 'react';
import { Camera, ChevronLeft, ChevronRight, MoveHorizontal, X } from 'lucide-react';
import './CarWalkthrough.css';

const licenseUrls = {
  'CC0 1.0': 'https://creativecommons.org/publicdomain/zero/1.0/',
  'CC BY 3.0': 'https://creativecommons.org/licenses/by/3.0/',
  'CC BY 4.0': 'https://creativecommons.org/licenses/by/4.0/',
  'CC BY 2.0': 'https://creativecommons.org/licenses/by/2.0/',
  'CC BY-SA 4.0': 'https://creativecommons.org/licenses/by-sa/4.0/'
};

const catalogInteriorMedia = {
  'bmw x5': {
    photos: [
      {
        imageUrl: '/vehicle-media/bmw-x5-interior.jpg',
        credit: 'User3204',
        sourceUrl: 'https://commons.wikimedia.org/w/index.php?curid=91881860',
        license: 'CC0 1.0',
        viewLabel: '2020 front cabin'
      },
      {
        imageUrl: '/vehicle-media/bmw-x5-rear-seats-2013.jpg',
        credit: 'Michael Sheehan',
        sourceUrl: 'https://commons.wikimedia.org/w/index.php?curid=39509562',
        license: 'CC BY 2.0',
        viewLabel: '2013 rear seats'
      }
    ]
  },
  'tesla model 3': {
    photos: [
      {
        imageUrl: '/vehicle-media/tesla-model-3-interior-screen.jpg',
        credit: 'jurvetson',
        sourceUrl: 'https://www.flickr.com/photos/44124348109@N01/35418230094',
        license: 'CC BY 2.0',
        viewLabel: 'Front cabin'
      },
      {
        imageUrl: '/vehicle-media/tesla-model-3-interior.jpg',
        credit: 'Coolomon Tetris (CoolT)',
        sourceUrl: 'https://commons.wikimedia.org/w/index.php?curid=116247408',
        license: 'CC BY-SA 4.0',
        viewLabel: 'Dashboard and front seats'
      },
      {
        imageUrl: '/vehicle-media/tesla.webp',
        viewLabel: 'Rear seats'
      }
    ]
  },
  'toyota camry': {
    photos: [
      {
        imageUrl: '/vehicle-media/toyota-camry-2020-interior.jpg',
        credit: "AIMHO'S REBELLION 8490s",
        sourceUrl: 'https://commons.wikimedia.org/w/index.php?curid=80002164',
        license: 'CC BY-SA 4.0',
        viewLabel: 'Front cabin'
      },
      {
        imageUrl: '/vehicle-media/toyota-camry-interior.jpg',
        credit: 'Ryan Hildebrand',
        sourceUrl: 'https://commons.wikimedia.org/w/index.php?curid=65991086',
        license: 'CC BY-SA 4.0',
        viewLabel: 'Driver cockpit'
      },
      {
        imageUrl: '/vehicle-media/toyota.jpeg',
        viewLabel: 'Rear seats'
      }
    ]
  },
  'porsche taycan': {
    photos: [
      {
        imageUrl: '/vehicle-media/porsche-taycan-interior-flickr.jpg',
        credit: 'L.C. Nøttaasen',
        sourceUrl: 'https://www.flickr.com/photos/35166455@N00/48776655661',
        license: 'CC BY 2.0',
        viewLabel: 'Front cabin'
      },
      {
        imageUrl: '/vehicle-media/porsche-taycan-interior.jpg',
        credit: 'Aos.1905',
        sourceUrl: 'https://commons.wikimedia.org/w/index.php?curid=174782556',
        license: 'CC BY 4.0',
        viewLabel: 'Driver cockpit'
      },
      {
        imageUrl: '/vehicle-media/porsche.jpeg',
        viewLabel: 'Rear seats'
      }
    ]
  }
};

const readFrames = (value) => {
  if (Array.isArray(value)) return value.filter((frame) => typeof frame === 'string' && frame);
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((frame) => typeof frame === 'string' && frame) : [];
  } catch {
    return [];
  }
};

export default function CarWalkthrough({ vehicle, onClose }) {
  const [view, setView] = useState('exterior');
  const [frameIndex, setFrameIndex] = useState(0);
  const [photoIndex, setPhotoIndex] = useState(0);
  const lastDragX = useRef(null);
  const vehicleIdentity = `${vehicle.brand || ''} ${vehicle.model || ''}`.toLowerCase();
  const fallbackMedia = Object.entries(catalogInteriorMedia).find(([name]) => vehicleIdentity.includes(name))?.[1] || {};
  const fallbackPhotos = fallbackMedia.photos || [];
  const vehiclePhoto = vehicle.interior_image_url ? {
    imageUrl: vehicle.interior_image_url,
    credit: vehicle.interior_image_credit,
    sourceUrl: vehicle.interior_image_source_url,
    license: vehicle.interior_image_license
  } : null;
  const interiorPhotos = [
    ...(vehiclePhoto ? [vehiclePhoto] : []),
    ...fallbackPhotos.filter((photo) => photo.imageUrl !== vehiclePhoto?.imageUrl)
  ];
  const interiorPhoto = interiorPhotos[photoIndex % Math.max(interiorPhotos.length, 1)];
  const exteriorFrames = readFrames(vehicle.exterior_360_frames);
  const interiorFrames = readFrames(vehicle.interior_360_frames);
  const frames = view === 'exterior' ? exteriorFrames : interiorFrames;
  const hasFrameSequence = frames.length > 1;
  const image = hasFrameSequence
    ? frames[frameIndex % frames.length]
    : view === 'exterior'
      ? vehicle.exterior_image_url || vehicle.image_url
      : interiorPhoto?.imageUrl;

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  const changeView = (nextView) => {
    setView(nextView);
    setFrameIndex(0);
    setPhotoIndex(0);
  };

  const rotateBy = (amount) => {
    setFrameIndex((current) => (current + amount + frames.length) % frames.length);
  };

  const changePhoto = (amount) => {
    setPhotoIndex((current) => (current + amount + interiorPhotos.length) % interiorPhotos.length);
  };

  const handlePointerMove = (event) => {
    if (lastDragX.current === null || frames.length < 2) return;
    const delta = event.clientX - lastDragX.current;
    if (Math.abs(delta) >= 24) {
      rotateBy(delta < 0 ? 1 : -1);
      lastDragX.current = event.clientX;
    }
  };

  return (
    <div className="walkthrough-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="walkthrough-dialog" role="dialog" aria-modal="true" aria-labelledby="walkthrough-title">
        <header className="walkthrough-header">
          <div>
            <p className="walkthrough-eyebrow">VEHICLE WALKTHROUGH</p>
            <h2 id="walkthrough-title">{vehicle.brand} {vehicle.model}</h2>
          </div>
          <button className="walkthrough-close" type="button" onClick={onClose} aria-label="Close vehicle walkthrough"><X size={20} /></button>
        </header>

        <div className="walkthrough-tabs" role="tablist" aria-label="Vehicle views">
          <button type="button" role="tab" aria-selected={view === 'exterior'} className={view === 'exterior' ? 'active' : ''} onClick={() => changeView('exterior')}>Exterior</button>
          <button type="button" role="tab" aria-selected={view === 'interior'} className={view === 'interior' ? 'active' : ''} onClick={() => changeView('interior')}>Interior</button>
        </div>

        <div className="walkthrough-content">
          <div>
            {image ? (
              <div
                className={`walkthrough-image-wrap${hasFrameSequence ? ' is-draggable' : ''}`}
                onPointerDown={(event) => { if (hasFrameSequence) { lastDragX.current = event.clientX; event.currentTarget.setPointerCapture(event.pointerId); } }}
                onPointerMove={handlePointerMove}
                onPointerUp={() => { lastDragX.current = null; }}
                onPointerCancel={() => { lastDragX.current = null; }}
              >
                <img className="walkthrough-image" src={image} alt={`${vehicle.brand} ${vehicle.model} ${view} view`} draggable="false" />
                <span className="walkthrough-view-label"><Camera size={15} /> {view === 'exterior' ? 'Exterior' : hasFrameSequence ? 'Interior · 360°' : interiorPhoto?.viewLabel || 'Interior'}</span>
                {view === 'interior' && interiorPhotos.length > 1 && !hasFrameSequence && <>
                  <button className="walkthrough-gallery-button previous" type="button" onClick={() => changePhoto(-1)} aria-label="Previous interior photo"><ChevronLeft size={22} /></button>
                  <button className="walkthrough-gallery-button next" type="button" onClick={() => changePhoto(1)} aria-label="Next interior photo"><ChevronRight size={22} /></button>
                  <span className="walkthrough-gallery-count">{photoIndex + 1} / {interiorPhotos.length}</span>
                </>}
              </div>
            ) : (
              <div className="walkthrough-empty">
                <Camera size={28} />
                <strong>Interior photos not available yet</strong>
                <span>Check back later for a closer look inside this vehicle.</span>
              </div>
            )}
            {view === 'interior' && interiorPhoto?.sourceUrl && (
              <p className="walkthrough-credit">
                Reference photo; trim and year may differ. Photo by {interiorPhoto.credit || 'the original contributor'},{' '}
                <a href={interiorPhoto.sourceUrl} target="_blank" rel="noreferrer">source</a>, licensed under{' '}
                <a href={licenseUrls[interiorPhoto.license] || 'https://creativecommons.org/licenses/'} target="_blank" rel="noreferrer">{interiorPhoto.license || 'Creative Commons'}</a>.
              </p>
            )}
            {hasFrameSequence && (
              <div className="walkthrough-controls">
                <button type="button" onClick={() => rotateBy(-1)} aria-label="Rotate view left"><ChevronLeft size={19} /></button>
                <MoveHorizontal size={18} aria-hidden="true" />
                <input type="range" min="0" max={frames.length - 1} value={frameIndex} onChange={(event) => setFrameIndex(Number(event.target.value))} aria-label="Rotate vehicle view" />
                <button type="button" onClick={() => rotateBy(1)} aria-label="Rotate view right"><ChevronRight size={19} /></button>
              </div>
            )}
            {hasFrameSequence && <p className="walkthrough-hint">Drag the image or use the controls to rotate the view.</p>}
          </div>

          <aside className="walkthrough-specs" aria-label="Vehicle details">
            <p className="walkthrough-eyebrow">AT A GLANCE</p>
            <dl>
              <div><dt>Seats</dt><dd>{vehicle.seats || 'Not listed'}</dd></div>
              <div><dt>Transmission</dt><dd>{vehicle.transmission || 'Not listed'}</dd></div>
              <div><dt>Fuel</dt><dd>{vehicle.fuel_type || 'Not listed'}</dd></div>
              <div><dt>Vehicle type</dt><dd>{vehicle.vehicle_type || 'Not listed'}</dd></div>
            </dl>
          </aside>
        </div>
      </section>
    </div>
  );
}