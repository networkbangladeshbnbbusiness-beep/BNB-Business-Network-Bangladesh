import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const ADMIN_APP_ID = 'com.bnb.business.admin';
const ADMIN_APP_NAME = 'BNB এডমিন প্যানেল';

function updateCapacitorConfig() {
  const capConfigPath = path.join(ROOT, 'capacitor.config.json');
  const raw = fs.readFileSync(capConfigPath, 'utf8');
  const cfg = JSON.parse(raw);
  cfg.appId = ADMIN_APP_ID;
  cfg.appName = ADMIN_APP_NAME;
  fs.writeFileSync(capConfigPath, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
  console.log(`[AdminAPK] Updated capacitor.config.json -> ${ADMIN_APP_ID}`);
}

function updateBuildGradle() {
  const gradlePath = path.join(ROOT, 'android/app/build.gradle');
  let gradle = fs.readFileSync(gradlePath, 'utf8');
  gradle = gradle
    .replace(/namespace\s*=\s*["'][^"']+["']/, `namespace = "${ADMIN_APP_ID}"`)
    .replace(/applicationId\s+["'][^"']+["']/, `applicationId "${ADMIN_APP_ID}"`);
  fs.writeFileSync(gradlePath, gradle, 'utf8');
  console.log(`[AdminAPK] Updated android/app/build.gradle -> ${ADMIN_APP_ID}`);
}

function updateStringsXml() {
  const stringsPath = path.join(ROOT, 'android/app/src/main/res/values/strings.xml');
  const content = `<?xml version='1.0' encoding='utf-8'?>
<resources>
    <string name="app_name">${ADMIN_APP_NAME}</string>
    <string name="title_activity_main">${ADMIN_APP_NAME}</string>
    <string name="package_name">${ADMIN_APP_ID}</string>
    <string name="custom_url_scheme">${ADMIN_APP_ID}</string>
</resources>
`;
  fs.writeFileSync(stringsPath, content, 'utf8');
  console.log(`[AdminAPK] Updated strings.xml -> ${ADMIN_APP_NAME} (${ADMIN_APP_ID})`);
}

function updateAndroidManifest() {
  const manifestPath = path.join(ROOT, 'android/app/src/main/AndroidManifest.xml');
  let manifest = fs.readFileSync(manifestPath, 'utf8');

  manifest = manifest.replace(/android:scheme="bnbnetwork"/g, 'android:scheme="bnbadmin"');

  const adminAppLinksBlock = `            <!-- Android App Links strictly scoped to /admin for Standalone Admin APK -->
            <intent-filter android:autoVerify="true">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="https" android:host="businessnetworkbangladesh.com" android:pathPrefix="/admin" />
                <data android:scheme="https" android:host="www.businessnetworkbangladesh.com" android:pathPrefix="/admin" />
            </intent-filter>`;

  manifest = manifest.replace(
    /\s*<!-- Android App Links for production domain and wallet redirects -->[\s\S]*?<\/intent-filter>/,
    `\n${adminAppLinksBlock}`
  );

  fs.writeFileSync(manifestPath, manifest, 'utf8');
  console.log('[AdminAPK] Updated AndroidManifest.xml with bnbadmin scheme & /admin App Links');
}

function migrateMainActivity() {
  const srcJavaRoot = path.join(ROOT, 'android/app/src/main/java');
  const oldActivityPath = path.join(srcJavaRoot, 'com/bnb/business/network/MainActivity.java');
  const newActivityDir = path.join(srcJavaRoot, 'com/bnb/business/admin');
  const newActivityPath = path.join(newActivityDir, 'MainActivity.java');

  if (!fs.existsSync(oldActivityPath)) {
    throw new Error(`Expected MainActivity.java not found at ${oldActivityPath}`);
  }

  let javaCode = fs.readFileSync(oldActivityPath, 'utf8');
  javaCode = javaCode
    .replace(/^package\s+com\.bnb\.business\.network\s*;/m, `package ${ADMIN_APP_ID};`)
    .replace(/bnb_native_prefs/g, 'bnb_admin_native_prefs');

  fs.mkdirSync(newActivityDir, { recursive: true });
  fs.writeFileSync(newActivityPath, javaCode, 'utf8');
  fs.rmSync(path.join(srcJavaRoot, 'com/bnb/business/network'), { recursive: true, force: true });
  console.log(`[AdminAPK] Migrated MainActivity.java to ${ADMIN_APP_ID}`);
}

updateCapacitorConfig();
updateBuildGradle();
updateStringsXml();
updateAndroidManifest();
migrateMainActivity();
