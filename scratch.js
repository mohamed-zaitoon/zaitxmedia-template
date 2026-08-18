const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc } = require('firebase/firestore');

const firebaseConfig = {
    apiKey: "dummy",
    authDomain: "zaitxmedia-ab12c.firebaseapp.com",
    projectId: "zaitxmedia-ab12c",
    storageBucket: "zaitxmedia-ab12c.appspot.com",
    messagingSenderId: "123",
    appId: "1:123:web:123"
};

// I need the actual config. Let me read it from app/firebase.ts
