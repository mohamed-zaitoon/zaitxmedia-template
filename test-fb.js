import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import fs from "fs";

const configPath = "./app/firebase.ts";
const code = fs.readFileSync(configPath, 'utf8');

// Just extracting the config object
const match = code.match(/const firebaseConfig = ({[\s\S]*?});/);
if (match) {
  const configStr = match[1]
    .replace(/process\.env\.NEXT_PUBLIC_FIREBASE_API_KEY/, '"dummy"')
    .replace(/process\.env\.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN/, '"zaitxmedia-ab12c.firebaseapp.com"')
    .replace(/process\.env\.NEXT_PUBLIC_FIREBASE_PROJECT_ID/, '"zaitxmedia-ab12c"')
    .replace(/process\.env\.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET/, '"zaitxmedia-ab12c.appspot.com"')
    .replace(/process\.env\.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID/, '"123"')
    .replace(/process\.env\.NEXT_PUBLIC_FIREBASE_APP_ID/, '"123"');

  eval(`var firebaseConfig = ${configStr};`);
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  getDoc(doc(db, "settings", "site")).then(s => {
    console.log(JSON.stringify(s.data()?.wallets, null, 2));
    process.exit(0);
  }).catch(e => {
    console.error(e);
    process.exit(1);
  });
}
