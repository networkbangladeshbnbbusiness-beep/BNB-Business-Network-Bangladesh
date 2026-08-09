import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, limit, query } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

async function checkDb() {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app, "ai-studio-bnbbusinessnetwo-120ec6e1-2db5-45d2-b1b1-46493400c959");
  
  try {
    const q = query(collection(db, 'users'), limit(5));
    const usersSnap = await getDocs(q);
    console.log(`Database has ${usersSnap.size} users.`);
    return true;
  } catch (err) {
    console.log(`Failed: ${err.message}`);
    return false;
  }
}

checkDb().then(() => process.exit(0));
