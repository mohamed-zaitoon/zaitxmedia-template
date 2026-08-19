import { getApp, getApps, initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyCB3AJcgoKUKCT7helW0B3eConuFpNSHoU",
  authDomain: "eldawlystore-75acf.firebaseapp.com",
  projectId: "eldawlystore-75acf",
  storageBucket: "eldawlystore-75acf.firebasestorage.app",
  messagingSenderId: "623189714929",
  appId: "1:623189714929:web:60b39c2e7c2ee192188650",
  measurementId: "G-RTRRNM71G7",
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const analytics =
  typeof window !== "undefined" ? getAnalytics(app) : null;
