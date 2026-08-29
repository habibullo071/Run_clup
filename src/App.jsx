import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Flame, Bike, Footprints, Navigation, RotateCcw, Gauge } from 'lucide-react';
import { auth, db } from './firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  onAuthStateChanged,
  signOut
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';

const markerIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

// MET ko'rsatkichlari (Yoqilgan kaloriyani hisoblash uchun)
const MET_VALUES = {
  Running: 9.8,
  Cycling: 7.5,
  Walking: 3.8
};

// XARITA KOMPONENTI
function MapView({ selectedActivity, userData, onBack, onLogout }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const polylineRef = useRef(null);

  const [position, setPosition] = useState([41.0011, 71.6683]);
  const [route, setRoute] = useState([]);
  const [isTracking, setIsTracking] = useState(false);
  const [distance, setDistance] = useState(0); // metrda
  const [seconds, setSeconds] = useState(0);
  const [calories, setCalories] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState(0); // km/h

  // Xaritani initsializatsiya qilish
  useEffect(() => {
    if (mapRef.current && !mapInstanceRef.current) {
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

    setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 200);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // GPS Treking, Masofa va Spidometr (Tezlik)
  useEffect(() => {
    let watchId;
    if (isTracking) {
      if ('geolocation' in navigator) {
        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            const newPos = [pos.coords.latitude, pos.coords.longitude];
            setPosition(newPos);

            // Joriy tezlikni aniqlash (GPS m/s qaytaradi, uni km/h ga o'tkazamiz)
            if (pos.coords.speed !== null && pos.coords.speed > 0) {
              setCurrentSpeed((pos.coords.speed * 3.6).toFixed(1));
            } else {
              setCurrentSpeed(0);
            }

            setRoute((prevRoute) => {
              const updatedRoute = [...prevRoute, newPos];
              if (polylineRef.current) polylineRef.current.setLatLngs(updatedRoute);
              if (prevRoute.length > 0) {
                const lastPos = prevRoute[prevRoute.length - 1];
                const addedDist = L.latLng(lastPos).distanceTo(L.latLng(newPos));
                
                // Kichik shovqinlarni filtrlash (agar masofa juda kichik bo'lsa qo'shmaydi)
                if (addedDist > 0.5) {
                  setDistance((prev) => prev + addedDist);
                }
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
      } else {
        alert("Qurilmangizda Geolocation qo'llab-quvvatlanmaydi!");
      }
    } else {
      setCurrentSpeed(0);
    }
    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [isTracking]);

  // Vaqt va Kaloriya hisoblagichi
  useEffect(() => {
    let timer;
    if (isTracking) {
      timer = setInterval(() => {
        setSeconds((s) => {
          const newSeconds = s + 1;
          
          const met = MET_VALUES[selectedActivity] || 5;
          const weight = parseFloat(userData.weight) || 70;
          const durationInMinutes = newSeconds / 60;
          const burned = (met * weight * 3.5 / 200) * durationInMinutes;
          
          setCalories(burned.toFixed(1));
          return newSeconds;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isTracking, selectedActivity, userData.weight]);

  // O'rtacha tezlikni hisoblash (km/h)
  const avgSpeed = seconds > 0 ? ((distance / 1000) / (seconds / 3600)).toFixed(1) : '0.0';

  // Taymer va statistikani nolga tushirish
  const handleReset = () => {
    setIsTracking(false);
    setDistance(0);
    setSeconds(0);
    setCalories(0);
    setCurrentSpeed(0);
    setRoute([]);
    if (polylineRef.current) polylineRef.current.setLatLngs([]);
  };

  // Markazga qaytarish
  const handleRecenter = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.panTo(position);
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

      {/* Yuqori Panel */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={onBack}
            style={{ backgroundColor: 'transparent', border: 'none', color: '#38bdf8', fontSize: '20px', cursor: 'pointer' }}
          >
            ←
          </button>
          <div>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>{selectedActivity}</div>
            <div style={{ fontWeight: 'bold', color: '#fff' }}>{userData.firstName || 'User'} {userData.lastName}</div>
          </div>
        </div>
        
        <button
          onClick={onLogout}
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

      {/* Navigatsiya tugmasi */}
      <button
        onClick={handleRecenter}
        style={{
          position: 'absolute',
          right: '20px',
          bottom: '260px',
          backgroundColor: '#1e293b',
          color: '#38bdf8',
          border: '1px solid #334155',
          borderRadius: '50%',
          width: '45px',
          height: '45px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 1000,
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
        }}
      >
        <Navigation size={20} />
      </button>

      {/* Pastki Statistikalar va Spidometr Paneli */}
      <div style={{
        position: 'absolute',
        bottom: '25px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        color: '#fff',
        padding: '20px',
        borderRadius: '24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px',
        zIndex: 1000,
        boxShadow: '0px 10px 30px rgba(0,0,0,0.6)',
        width: '90%',
        maxWidth: '360px',
        border: '1px solid #334155'
      }}>
        {/* Spidometr + Statistikalar */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', width: '100%', textAlign: 'center', gap: '4px' }}>
          <div>
            <div style={{ fontSize: '10px', color: '#94a3b8' }}>Masofa</div>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#38bdf8' }}>
              {(distance / 1000).toFixed(2)} <span style={{fontSize: '9px'}}>km</span>
            </div>
          </div>

          <div>
            <div style={{ fontSize: '10px', color: '#94a3b8' }}>Tezlik</div>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#a855f7' }}>
              {currentSpeed} <span style={{fontSize: '9px'}}>km/h</span>
            </div>
          </div>

          <div>
            <div style={{ fontSize: '10px', color: '#94a3b8' }}>O'rt.Tezlik</div>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#eab308' }}>
              {avgSpeed} <span style={{fontSize: '9px'}}>km/h</span>
            </div>
          </div>

          <div>
            <div style={{ fontSize: '10px', color: '#94a3b8' }}>Kaloriya</div>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#f97316' }}>
              {calories} <span style={{fontSize: '9px'}}>kcal</span>
            </div>
          </div>
        </div>

        {/* Taymer va Boshqaruv Tugmalari */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '10px' }}>
          <div style={{ fontSize: '20px', fontWeight: 'bold', letterSpacing: '1px', paddingLeft: '8px' }}>
            {Math.floor(seconds / 60).toString().padStart(2, '0')}:{(seconds % 60).toString().padStart(2, '0')}
          </div>

          <div style={{ display: 'flex', gap: '8px', flex: 1, justifyContent: 'flex-end' }}>
            <button
              onClick={() => setIsTracking(!isTracking)}
              style={{
                flex: 1,
                maxWidth: '160px',
                backgroundColor: isTracking ? '#ef4444' : '#38bdf8',
                color: isTracking ? '#fff' : '#0f172a',
                border: 'none',
                padding: '12px',
                borderRadius: '14px',
                fontWeight: 'bold',
                cursor: 'pointer',
                fontSize: '15px',
                transition: 'all 0.2s ease'
              }}
            >
              {isTracking ? 'PAUSE' : seconds > 0 ? 'RESUME' : 'START'}
            </button>

            {seconds > 0 && !isTracking && (
              <button
                onClick={handleReset}
                style={{
                  backgroundColor: '#334155',
                  color: '#fff',
                  border: 'none',
                  padding: '12px 16px',
                  borderRadius: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <RotateCcw size={18} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ASOSIY APP KOMPONENTI
export default function App() {
  const [step, setStep] = useState('auth');
  const [initializing, setInitializing] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  const [selectedActivity, setSelectedActivity] = useState('Running');
  const [isSignUp, setIsSignUp] = useState(false);
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const docRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            setUserData((prev) => ({ 
              ...prev, 
              ...docSnap.data(), 
              email: user.email 
            }));
            setStep('home');
          } else {
            setUserData((prev) => ({ ...prev, email: user.email }));
            setStep('name');
          }
        } catch (err) {
          console.error("Firestore error:", err);
          setUserData((prev) => ({ ...prev, email: user.email }));
          setStep('home');
        }
      } else {
        setStep('auth');
      }
      setInitializing(false);
    });

    return () => unsubscribe();
  }, []);

  const handleChange = (field, value) => {
    setErrorMsg('');
    setUserData((prev) => ({ ...prev, [field]: value }));
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, userData.email, userData.password);
        setStep('name');
      } else {
        await signInWithEmailAndPassword(auth, userData.email, userData.password);
        setStep('home');
      }
    } catch (err) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setErrorMsg('Email yoki parol noto‘g‘ri!');
      } else if (err.code === 'auth/email-already-in-use') {
        setErrorMsg('Bu email allaqachon ro‘yxatdan o‘tgan!');
      } else if (err.code === 'auth/invalid-email') {
        setErrorMsg('Email formati noto‘g‘ri!');
      } else if (err.code === 'auth/weak-password') {
        setErrorMsg('Parol kamida 6 ta belgi bo‘lishi kerak!');
      } else {
        setErrorMsg('Xatolik yuz berdi. Qayta urinib ko‘ring.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
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
        }, { merge: true });
        setShowSettings(false);
        setStep('home');
      }
    } catch (err) {
      setErrorMsg('Ma’lumotlarni saqlashda xatolik bo‘ldi');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setShowSettings(false);
    setStep('auth');
  };

  const handleSelectActivity = (activity) => {
    setSelectedActivity(activity);
    setStep('main');
  };

  const containerStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0f172a',
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '20px',
    boxSizing: 'border-box',
    fontFamily: 'sans-serif',
    zIndex: 10
  };

  const cardStyle = {
    width: '100%',
    maxWidth: '360px'
  };

  const inputStyle = {
    width: '100%',
    padding: '14px 16px',
    borderRadius: '12px',
    border: '1px solid #1e293b',
    backgroundColor: '#172033',
    color: '#fff',
    marginBottom: '14px',
    outline: 'none',
    boxSizing: 'border-box',
    fontSize: '15px'
  };

  const buttonStyle = {
    width: '100%',
    padding: '14px',
    borderRadius: '12px',
    border: 'none',
    backgroundColor: '#38bdf8',
    color: '#0f172a',
    fontWeight: 'bold',
    fontSize: '16px',
    cursor: 'pointer',
    marginTop: '6px'
  };

  if (initializing) {
    return (
      <div style={containerStyle}>
        <div style={{ color: '#38bdf8', fontSize: '18px', fontWeight: 'bold' }}>Yuklanmoqda...</div>
      </div>
    );
  }

  if (step === 'auth') {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <h2 style={{ textAlign: 'center', marginBottom: '6px', fontSize: '26px' }}>
            {isSignUp ? 'Sign Up' : 'Sign In'}
          </h2>
          <p style={{ textAlign: 'center', color: '#94a3b8', marginBottom: '28px', fontSize: '14px' }}>
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
              {loading ? 'Tekshirilmoqda...' : isSignUp ? 'Sign Up' : 'Sign In'}
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

  if (step === 'name') {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <h2 style={{ textAlign: 'center', marginBottom: '6px', fontSize: '26px' }}>Your Profile</h2>
          <p style={{ textAlign: 'center', color: '#94a3b8', marginBottom: '28px', fontSize: '14px' }}>
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

  if (step === 'fitness') {
    return (
      <div style={containerStyle}>
        <div style={{ width: '100%', maxWidth: '360px' }}>
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

  if (step === 'home') {
    const activities = [
      { id: 'Running', label: 'Running', icon: <Flame size={32} />, color: '#ef4444', gradient: 'linear-gradient(135deg, #ef4444, #f97316)' },
      { id: 'Cycling', label: 'Cycling', icon: <Bike size={32} />, color: '#22c55e', gradient: 'linear-gradient(135deg, #22c55e, #10b981)' },
      { id: 'Walking', label: 'Walking', icon: <Footprints size={32} />, color: '#06b6d4', gradient: 'linear-gradient(135deg, #06b6d4, #3b82f6)' }
    ];

    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundImage: `linear-gradient(180deg, rgba(15, 23, 42, 0.25) 0%, rgba(15, 23, 42, 0.8) 75%, rgba(15, 23, 42, 0.95) 100%), url('https://lermagazine.com/wp-content/uploads/2016/08/8Runner-iStock_19347954-copy.jpg')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center 20%',
        backgroundRepeat: 'no-repeat',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '30px 20px 40px 20px',
        boxSizing: 'border-box',
        fontFamily: 'sans-serif',
        zIndex: 10
      }}>
        <style>{`
          @keyframes pulseGlow {
            0% { transform: scale(1); box-shadow: 0 0 10px rgba(255,255,255,0.1); }
            50% { transform: scale(1.03); box-shadow: 0 0 22px rgba(56,189,248,0.3); }
            100% { transform: scale(1); box-shadow: 0 0 10px rgba(255,255,255,0.1); }
          }
          .activity-card {
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          }
          .activity-card:hover {
            transform: translateY(-6px) scale(1.05);
          }
          .activity-card:active {
            transform: translateY(0) scale(0.95);
          }
          .activity-icon {
            transition: all 0.3s ease;
          }
          .activity-card:hover .activity-icon {
            transform: rotate(-8deg) scale(1.1);
          }
        `}</style>

        <div style={{
          width: '100%',
          maxWidth: '400px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            padding: '8px 16px',
            borderRadius: '16px',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.15)'
          }}>
            <div style={{ fontSize: '12px', color: '#cbd5e1' }}>Xush kelibsiz!</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
              {userData.firstName} {userData.lastName}
            </div>
          </div>

          <button
            onClick={() => setShowSettings(true)}
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.65)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#fff',
              fontSize: '22px',
              padding: '8px 14px',
              borderRadius: '14px',
              cursor: 'pointer',
              backdropFilter: 'blur(10px)'
            }}
          >
            ☰
          </button>
        </div>

        <div style={{
          width: '100%',
          maxWidth: '400px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}>
          <h2 style={{
            fontSize: '22px',
            fontWeight: '800',
            marginBottom: '20px',
            letterSpacing: '0.5px',
            textShadow: '0 2px 8px rgba(0,0,0,0.8)'
          }}>
            Choose Activity
          </h2>
          
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            width: '100%',
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            padding: '20px 16px',
            borderRadius: '28px',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
            boxSizing: 'border-box',
            animation: 'pulseGlow 4s infinite ease-in-out'
          }}>
            {activities.map((act) => (
              <div
                key={act.id}
                className="activity-card"
                onClick={() => handleSelectActivity(act.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  cursor: 'pointer',
                  width: '30%'
                }}
              >
                <div 
                  className="activity-icon"
                  style={{
                    width: '68px',
                    height: '68px',
                    borderRadius: '50%',
                    background: act.gradient,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    marginBottom: '10px',
                    boxShadow: `0 8px 20px ${act.color}66`
                  }}
                >
                  {act.icon}
                </div>
                <span style={{ 
                  color: '#fff', 
                  fontWeight: '700', 
                  fontSize: '13px',
                  letterSpacing: '0.3px'
                }}>
                  {act.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {showSettings && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.75)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 2000,
            padding: '20px'
          }}>
            <div style={{
              backgroundColor: '#1e293b',
              borderRadius: '24px',
              padding: '24px',
              width: '100%',
              maxWidth: '360px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, fontSize: '20px' }}>Settings</h3>
                <button
                  onClick={() => setShowSettings(false)}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>First Name</label>
                <input
                  type="text"
                  style={inputStyle}
                  value={userData.firstName}
                  onChange={(e) => handleChange('firstName', e.target.value)}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Last Name</label>
                <input
                  type="text"
                  style={inputStyle}
                  value={userData.lastName}
                  onChange={(e) => handleChange('lastName', e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Height (cm)</label>
                  <input
                    type="number"
                    style={inputStyle}
                    value={userData.height}
                    onChange={(e) => handleChange('height', e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Weight (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    style={inputStyle}
                    value={userData.weight}
                    onChange={(e) => handleChange('weight', e.target.value)}
                  />
                </div>
              </div>

              <button style={buttonStyle} onClick={handleSaveProfile} disabled={loading}>
                {loading ? 'Saqlanmoqda...' : 'Save Changes'}
              </button>

              <button
                onClick={handleLogout}
                style={{
                  ...buttonStyle,
                  backgroundColor: 'transparent',
                  border: '1px solid #ef4444',
                  color: '#ef4444',
                  marginTop: '12px'
                }}
              >
                Log Out
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <MapView
      selectedActivity={selectedActivity}
      userData={userData}
      onBack={() => setStep('home')}
      onLogout={handleLogout}
    />
  );
}