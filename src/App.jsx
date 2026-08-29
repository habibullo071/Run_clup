import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Marker belgisining tayyor tasviri
const markerIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

export default function TrackerApp() {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const polylineRef = useRef(null);

  const [position, setPosition] = useState([41.0011, 71.6683]); // Namangan/Chortoq boshlang'ich koordinatasi
  const [route, setRoute] = useState([]);
  const [isTracking, setIsTracking] = useState(false);
  const [distance, setDistance] = useState(0);
  const [seconds, setSeconds] = useState(0);

  // Xarita va Marker'ni initsializatsiya qilish
  useEffect(() => {
    if (!mapInstanceRef.current && mapRef.current) {
      const map = L.map(mapRef.current).setView(position, 15);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      const marker = L.marker(position, { icon: markerIcon }).addTo(map);
      const polyline = L.polyline([], { color: '#ff4500', weight: 5 }).addTo(map);

      mapInstanceRef.current = map;
      markerRef.current = marker;
      polylineRef.current = polyline;
    }
  }, []);

  // GPS kuzatuv mantiqi (Geolocation API)
  useEffect(() => {
    let watchId;
    if (isTracking) {
      if ('geolocation' in navigator) {
        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            const newLat = pos.coords.latitude;
            const newLng = pos.coords.longitude;
            const newPos = [newLat, newLng];

            setPosition(newPos);
            setRoute((prevRoute) => {
              const updatedRoute = [...prevRoute, newPos];
              if (polylineRef.current) {
                polylineRef.current.setLatLngs(updatedRoute);
              }
              if (prevRoute.length > 0) {
                const lastPos = prevRoute[prevRoute.length - 1];
                const addedDist = L.latLng(lastPos).distanceTo(L.latLng(newPos));
                setDistance((prevDist) => prevDist + addedDist);
              }
              return updatedRoute;
            });

            if (mapInstanceRef.current && markerRef.current) {
              markerRef.current.setLatLng(newPos);
              mapInstanceRef.current.panTo(newPos);
            }
          },
          (err) => console.error('GPS Xatolik:', err),
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      }
    }
    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [isTracking]);

  // Taymer
  useEffect(() => {
    let timer;
    if (isTracking) {
      timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    }
    return () => clearInterval(timer);
  }, [isTracking]);

  // Test uchun add step (Xarita ustida bosqichma-bosqich chizish)
  const handleTestStep = () => {
    const nextLat = position[0] + 0.0005;
    const nextLng = position[1] + 0.0005;
    const newPos = [nextLat, nextLng];

    const updatedRoute = [...route, newPos];
    setRoute(updatedRoute);

    if (route.length > 0) {
      const lastPos = route[route.length - 1];
      const addedDist = L.latLng(lastPos).distanceTo(L.latLng(newPos));
      setDistance((prev) => prev + addedDist);
    }

    setPosition(newPos);
    if (mapInstanceRef.current && markerRef.current && polylineRef.current) {
      markerRef.current.setLatLng(newPos);
      polylineRef.current.setLatLngs(updatedRoute);
      mapInstanceRef.current.panTo(newPos);
    }
  };

  const formatTime = (sec) => {
    const mins = Math.floor(sec / 60).toString().padStart(2, '0');
    const secs = (sec % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      {/* Container Leaflet uchun */}
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

      {/* Boshqaruv paneli */}
      <div style={{
        position: 'absolute',
        bottom: '30px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: 'rgba(20, 20, 20, 0.9)',
        color: '#fff',
        padding: '20px 30px',
        borderRadius: '20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '15px',
        zIndex: 1000,
        boxShadow: '0px 10px 30px rgba(0,0,0,0.5)',
        minWidth: '280px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: '12px', color: '#aaa' }}>Masofa</div>
            <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{(distance / 1000).toFixed(2)} km</div>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#aaa' }}>Vaqt</div>
            <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{formatTime(seconds)}</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setIsTracking(!isTracking)}
            style={{
              backgroundColor: isTracking ? '#ff3b30' : '#ff5500',
              color: '#fff',
              border: 'none',
              padding: '12px 35px',
              borderRadius: '30px',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            {isTracking ? 'STOP' : 'START'}
          </button>

          <button
            onClick={handleTestStep}
            style={{
              backgroundColor: '#333',
              color: '#fff',
              border: '1px solid #555',
              padding: '12px 15px',
              borderRadius: '30px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            + Step (Test)
          </button>
        </div>
      </div>
    </div>
  );
}