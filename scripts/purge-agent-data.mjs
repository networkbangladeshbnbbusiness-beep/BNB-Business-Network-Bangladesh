import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  deleteDoc, 
  doc, 
  updateDoc, 
  setDoc,
  deleteField 
} from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function purgeAgentData() {
  console.log("=== STARTING COMPLETE PERMANENT PURGE OF BNB AGENT DATA ===");

  const agentCollections = [
    'bap_agents',
    'agents',
    'agent_applications',
    'agent_requests',
    'agent_reports',
    'agent_locations',
    'agent_profiles'
  ];

  let totalDeletedDocs = 0;

  for (const colName of agentCollections) {
    try {
      console.log(`Clearing collection: ${colName}...`);
      const snap = await getDocs(collection(db, colName));
      let count = 0;
      for (const d of snap.docs) {
        await deleteDoc(doc(db, colName, d.id));
        count++;
      }
      totalDeletedDocs += count;
      console.log(`Cleared ${count} documents from '${colName}'.`);
    } catch (err) {
      console.warn(`Error clearing ${colName}:`, err?.message || err);
    }
  }

  // Purge user agent roles and agent fields in 'users' collection
  try {
    console.log("Scanning 'users' collection for agent profiles...");
    const usersSnap = await getDocs(collection(db, 'users'));
    let updatedUsers = 0;

    for (const uDoc of usersSnap.docs) {
      const data = uDoc.data();
      const isAgentRole = data.role === 'agent';
      const hasAgentFlag = Boolean(data.isAgent || data.agentStatus || data.agentDistrict || data.agentPhone || data.agentCommission);

      if (isAgentRole || hasAgentFlag) {
        const updates = {
          agentCommission: 0,
          isAgent: false,
          agentStatus: 'none',
          agentDivision: deleteField(),
          agentDistrict: deleteField(),
          agentThana: deleteField(),
          agentNid: deleteField(),
          agentPhone: deleteField(),
          agentAddress: deleteField(),
          agentLocation: deleteField(),
          agentExperience: deleteField(),
          agentAppliedAt: deleteField(),
          agentApprovedAt: deleteField(),
          agentPhoto: deleteField(),
          agentLogo: deleteField()
        };

        if (isAgentRole) {
          updates.role = 'user';
        }

        await updateDoc(doc(db, 'users', uDoc.id), updates);
        updatedUsers++;
      }
    }
    console.log(`Reset agent fields for ${updatedUsers} users.`);
  } catch (err) {
    console.warn("Error updating user agent profiles:", err?.message || err);
  }

  // Clear agent banners in system settings
  try {
    const configRef = doc(db, 'system_settings', 'app_config');
    await setDoc(configRef, {
      agentBanners: [],
      updatedAt: new Date().toISOString()
    }, { merge: true });
    console.log("Cleared agentBanners in app_config.");
  } catch (err) {
    console.warn("Error resetting agent banners:", err?.message || err);
  }

  console.log(`=== BNB AGENT PURGE COMPLETE. TOTAL DOCUMENTS DELETED: ${totalDeletedDocs} ===`);
  process.exit(0);
}

purgeAgentData().catch((err) => {
  console.error("Purge script failed:", err);
  process.exit(1);
});
