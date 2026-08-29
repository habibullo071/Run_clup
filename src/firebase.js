import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { 
  getAuth, 
  setPersistence, 
  browserLocalPersistence 
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAM0HmcYbx0O8e4JI2Ty5d2l_ypKImRmmE",
  authDomain: "run-app-f5efd.firebaseapp.com",
  projectId: "run-app-f5efd",
  storageBucket: "run-app-f5efd.firebasestorage.app",
  messagingSenderId: "466148363690",
  appId: "1:466148363690:web:462d8672be3935070d2fd3",
  measurementId: "G-LLPFJGSC0V"
};

// Firebase-ni ishga tushirish
const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);

// Auth va Firestore-ni eksport qilish
export const auth = getAuth(app);
export const db = getFirestore(app);

// Login holati saqlanib qolishi uchun
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error("Persistence error:", error);
});