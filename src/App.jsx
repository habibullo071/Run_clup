import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { auth, db } from './firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  onAuthStateChanged 
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';

const markerIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

export default function App() {
  const [step, setStep] = useState('auth');
  const [isSignUp, setIsSignUp] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const [userData, setUserData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    gender: 'Male',
    height: 170,
    weight: 70.0
  });

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const polylineRef = useRef(null);

  const [position, setPosition] = useState([41.0011, 71.6683]);
  const [route, setRoute] = useState([]);
  const [isTracking, setIsTracking] = useState(false);
  const [distance, setDistance] = useState(0);
  const [seconds, setSeconds] = useState(0);

  // Auto-login session check
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setUserData((prev) => ({ ...prev, ...docSnap.data(), email: user.email }));
          setStep('main');
        } else {
          setStep('name');
        }
      } else {
        setStep('auth');
      }
    });
    return () => unsubscribe();
  }, []);

  // Map Initialization
  useEffect(() => {
    if (step === 'main' && !mapInstanceRef.current && mapRef.current) {
      const map = L.map(mapRef.current).setView(position, 15);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
      }).addTo(map);

      const marker = L.marker(position, { icon: markerIcon }).addTo(map);
      const polyline = L.polyline([], { color: '#38bdf8', weight: 5 }).addTo(map);

      mapInstanceRef.current = map;
      markerRef.current = marker;
      polylineRef.current = polyline;
    }
  }, [step]);

  // GPS Tracking Logic
  useEffect(() => {
    let watchId;
    if (isTracking && step === 'main') {
      if ('geolocation' in navigator) {
        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            const newPos = [pos.coords.latitude, pos.coords.longitude];
            setPosition(newPos);
            setRoute((prevRoute) => {
              const updatedRoute = [...prevRoute, newPos];
              if (polylineRef.current) polylineRef.current.setLatLngs(updatedRoute);
              if (prevRoute.length > 0) {
                const lastPos = prevRoute[prevRoute.length - 1];
                const addedDist = L.latLng(lastPos).distanceTo(L.latLng(newPos));
                setDistance((prev) => prev + addedDist);
              }
              return updatedRoute;
            });

            if (mapInstanceRef.current && markerRef.current) {
              markerRef.current.setLatLng(newPos);
              mapInstanceRef.current.panTo(newPos);
            }
          },
          (err) => console.error('GPS Error:', err),
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      }
    }
    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [isTracking, step]);

  // Timer
  useEffect(() => {
    let timer;
    if (isTracking && step === 'main') {
      timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    }
    return () => clearInterval(timer);
  }, [isTracking, step]);

  const handleChange = (field, value) => {
    setErrorMsg('');
    setUserData((prev) => ({ ...prev, [field]: value }));
  };

  // Real Auth Handler (Sign In / Sign Up)
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      if (isSignUp) {
        // Sign Up
        await createUserWithEmailAndPassword(auth, userData.email, userData.password);
        setStep('name');
      } else {
        // Sign In
        await signInWithEmailAndPassword(auth, userData.email, userData.password);
        setStep('main');
      }
    } catch (err) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setErrorMsg('Email yoki parol noto‘g‘ri!');
      } else if (err.code === 'auth/email-already-in-use') {
        setErrorMsg('Bu email allaqachon ro‘yxatdan o‘tgan!');
      } else if (err.code === 'auth/invalid-email') {
        setErrorMsg('Email formati noto‘g‘ri!');
      } else if (err.code === 'auth/weak-password') {
        setErrorMsg('Parol juda ojiz (kamida 6 ta belgi kiriting)!');
      } else {
        setErrorMsg('Xatolik yuz berdi. Qayta urinib ko‘ring.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Save Full Profile to Firestore
  const handleSaveProfile = async () => {
    if (!userData.firstName.trim()) {
      setErrorMsg('Iltimos, ismingizni kiriting!');
      return;
    }

    setLoading(true);
    try {
      const user = auth.currentUser;
      if (user) {
        await setDoc(doc(db, 'users', user.uid), {
          firstName: userData.firstName,
          lastName: userData.lastName,
          gender: userData.gender,
          height: userData.height,
          weight: userData.weight
        });
        setStep('main');
      }
    } catch (err) {
      setErrorMsg('Ma’lumotlarni saqlashda xatolik bo‘ldi');
    } finally {
      setLoading(false);
    }
  };

  const containerStyle = {
    minHeight: '100vh',
    backgroundColor: '#0f172a',
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '20px',
    fontFamily: 'sans-serif'
  };

  const cardStyle = {
    width: '100%',
    maxWidth: '400px',
    backgroundColor: '#1e293b',
    padding: '30px',
    borderRadius: '24px',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
  };

  const inputStyle = {
    width: '100%',
    padding: '14px',
    borderRadius: '12px',
    border: '1px solid #334155',
    backgroundColor: '#0f172a',
    color: '#fff',
    marginBottom: '16px',
    outline: 'none',
    boxSizing: 'border-box'
  };

  const buttonStyle = {
    width: '100%',
    padding: '16px',
    borderRadius: '16px',
    border: 'none',
    backgroundColor: '#38bdf8',
    color: '#0f172a',
    fontWeight: 'bold',
    fontSize: '16px',
    cursor: 'pointer',
    marginTop: '10px'
  };

  // 1-BOSQICH: AUTHENTICATION
  if (step === 'auth') {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <h2 style={{ textAlign: 'center', marginBottom: '8px' }}>
            {isSignUp ? 'Sign Up' : 'Sign In'}
          </h2>
          <p style={{ textAlign: 'center', color: '#94a3b8', marginBottom: '24px', fontSize: '14px' }}>
            {isSignUp ? 'Create your account to start tracking' : 'Welcome back to Run Club'}
          </p>

          <form onSubmit={handleAuthSubmit}>
            <input
              type="email"
              placeholder="Email address"
              style={inputStyle}
              value={userData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Password"
              style={inputStyle}
              value={userData.password}
              onChange={(e) => handleChange('password', e.target.value)}
              required
            />

            {errorMsg && (
              <div style={{ color: '#ef4444', fontSize: '13px', marginBottom: '12px', textAlign: 'center' }}>
                {errorMsg}
              </div>
            )}

            <button type="submit" style={buttonStyle} disabled={loading}>
              {loading ? 'Tekshirilmoqda...' : isSignUp ? 'Next' : 'Sign In'}
            </button>
          </form>

          <p
            onClick={() => {
              setErrorMsg('');
              setIsSignUp(!isSignUp);
            }}
            style={{ textAlign: 'center', color: '#38bdf8', marginTop: '20px', cursor: 'pointer', fontSize: '14px' }}
          >
            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </p>
        </div>
      </div>
    );
  }

  // 2-BOSQICH: NAME ENTRY
  if (step === 'name') {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <h2 style={{ textAlign: 'center', marginBottom: '8px' }}>Your Profile</h2>
          <p style={{ textAlign: 'center', color: '#94a3b8', marginBottom: '24px', fontSize: '14px' }}>
            Tell us a bit about yourself
          </p>

          <input
            type="text"
            placeholder="First Name"
            style={inputStyle}
            value={userData.firstName}
            onChange={(e) => handleChange('firstName', e.target.value)}
          />
          <input
            type="text"
            placeholder="Last Name"
            style={inputStyle}
            value={userData.lastName}
            onChange={(e) => handleChange('lastName', e.target.value)}
          />

          {errorMsg && (
            <div style={{ color: '#ef4444', fontSize: '13px', marginBottom: '12px', textAlign: 'center' }}>
              {errorMsg}
            </div>
          )}

          <button
            style={buttonStyle}
            onClick={() => {
              if (userData.firstName.trim()) setStep('fitness');
              else setErrorMsg('Iltimos, ismingizni kiriting!');
            }}
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  // 3-BOSQICH: FITNESS PROFILE
  if (step === 'fitness') {
    return (
      <div style={containerStyle}>
        <div style={{ width: '100%', maxWidth: '400px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            {['Male', 'Female'].map((g) => {
              const selected = userData.gender === g;
              return (
                <div
                  key={g}
                  onClick={() => handleChange('gender', g)}
                  style={{
                    backgroundColor: '#1e293b',
                    borderRadius: '20px',
                    padding: '30px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    border: selected ? '2px solid #38bdf8' : '2px solid transparent',
                    position: 'relative'
                  }}
                >
                  {selected && (
                    <div style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      backgroundColor: '#38bdf8',
                      color: '#0f172a',
                      borderRadius: '50%',
                      width: '20px',
                      height: '20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}>✓</div>
                  )}
                  <div style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    backgroundColor: '#334155',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '28px',
                    marginBottom: '12px',
                    color: selected ? '#38bdf8' : '#aaa'
                  }}>
                    {g === 'Male' ? '♂' : '♀'}
                  </div>
                  <span style={{ fontWeight: 'bold', color: selected ? '#fff' : '#aaa' }}>{g}</span>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div style={{ backgroundColor: '#1e293b', borderRadius: '20px', padding: '20px' }}>
              <div style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '8px' }}>Height</div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <input
                  type="number"
                  value={userData.height}
                  onChange={(e) => handleChange('height', e.target.value)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#38bdf8',
                    fontSize: '24px',
                    fontWeight: 'bold',
                    width: '70px',
                    outline: 'none'
                  }}
                />
                <span style={{ color: '#38bdf8', fontSize: '18px', fontWeight: 'bold' }}>cm</span>
              </div>
            </div>

            <div style={{ backgroundColor: '#1e293b', borderRadius: '20px', padding: '20px' }}>
              <div style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '8px' }}>Weight</div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <input
                  type="number"
                  step="0.1"
                  value={userData.weight}
                  onChange={(e) => handleChange('weight', e.target.value)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#38bdf8',
                    fontSize: '24px',
                    fontWeight: 'bold',
                    width: '70px',
                    outline: 'none'
                  }}
                />
                <span style={{ color: '#38bdf8', fontSize: '18px', fontWeight: 'bold' }}>kg</span>
              </div>
            </div>
          </div>

          <button style={buttonStyle} onClick={handleSaveProfile} disabled={loading}>
            {loading ? 'Saqlanmoqda...' : 'SAVE'}
          </button>
        </div>
      </div>
    );
  }

  // 4-BOSQICH: MAIN APP
  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', margin: 0, padding: 0 }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        right: '20px',
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        padding: '12px 20px',
        borderRadius: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(10px)',
        border: '1px solid #334155'
      }}>
        <div>
          <div style={{ fontSize: '14px', color: '#94a3b8' }}>Runner</div>
          <div style={{ fontWeight: 'bold', color: '#fff' }}>{userData.firstName || 'User'} {userData.lastName}</div>
        </div>
        <button
          onClick={() => auth.signOut()}
          style={{
            fontSize: '12px',
            color: '#ef4444',
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            padding: '6px 12px',
            borderRadius: '12px',
            cursor: 'pointer'
          }}
        >
          Exit
        </button>
      </div>

      <div style={{
        position: 'absolute',
        bottom: '30px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        color: '#fff',
        padding: '20px 30px',
        borderRadius: '24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '15px',
        zIndex: 1000,
        boxShadow: '0px 10px 30px rgba(0,0,0,0.6)',
        minWidth: '280px',
        border: '1px solid #334155'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>Masofa</div>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#38bdf8' }}>{(distance / 1000).toFixed(2)} km</div>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>Vaqt</div>
            <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{Math.floor(seconds / 60).toString().padStart(2, '0')}:{(seconds % 60).toString().padStart(2, '0')}</div>
          </div>
        </div>

        <button
          onClick={() => setIsTracking(!isTracking)}
          style={{
            width: '100%',
            backgroundColor: isTracking ? '#ef4444' : '#38bdf8',
            color: isTracking ? '#fff' : '#0f172a',
            border: 'none',
            padding: '14px',
            borderRadius: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          {isTracking ? 'STOP' : 'START'}
        </button>
      </div>
    </div>
  );
}