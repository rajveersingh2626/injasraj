const fs = require('fs');
const path = require('path');
const os = require('os');

const convDir = path.join(os.homedir(), '.gemini', 'antigravity', 'conversations');
const exportDir = path.join(os.homedir(), 'OneDrive', 'Desktop', 'antigravity_conversations_export');

if (!fs.existsSync(exportDir)) {
  fs.mkdirSync(exportDir, { recursive: true });
}

const files = fs.readdirSync(convDir);
console.log('Total files found:', files.length);

let copied = 0;
let skipped = 0;

for (const file of files) {
  const src = path.join(convDir, file);
  const dest = path.join(exportDir, file);
  try {
    fs.copyFileSync(src, dest);
    copied++;
  } catch (e) {
    // Current live conversation file is locked by Antigravity runtime
    skipped++;
  }
}

console.log(`Export complete: ${copied} copied, ${skipped} active/locked files skipped.`);
