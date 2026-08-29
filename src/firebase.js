import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
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

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export Auth & Firestore
export const auth = getAuth(app);
export const db = getFirestore(app);