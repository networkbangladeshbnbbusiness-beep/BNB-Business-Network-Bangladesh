const fs = require('fs');

let content = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

// Remove isQuotaExceeded prop type
content = content.replace(/  isQuotaExceeded\?: boolean;\n/g, '');

// Remove isQuotaExceeded prop definition
content = content.replace(/  isQuotaExceeded = false\n/g, '');

// Remove localQuotaExceeded state
content = content.replace(/  const \[localQuotaExceeded, setLocalQuotaExceeded\] = useState\(false\);\n/g, '');

// Remove global error listener
content = content.replace(/  \/\/ Detect local quota exceeded[\s\S]*?window\.removeEventListener\('unhandledrejection', handleUnhandledRejection\);\n    };\n  }, \[\]\);\n/g, '');

// Remove banner
content = content.replace(/      \{\(isQuotaExceeded \|\| localQuotaExceeded\) && \([\s\S]*?      \)\}\n/g, '');

fs.writeFileSync('src/components/AdminPanel.tsx', content);
