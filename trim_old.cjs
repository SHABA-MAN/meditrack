const fs = require('fs');
const filePath = 'c:\\Users\\MOHAMMED\\Downloads\\555\\meditrack\\src\\components\\MediTrackApp.jsx';
const lines = fs.readFileSync(filePath, 'utf8').split('\n');
// Keep lines 1-712 (index 0-711), then add clean ending
const kept = lines.slice(0, 712);
kept.push('    );');
kept.push('};');
kept.push('');
kept.push('export default MediTrackApp;');
kept.push('');
fs.writeFileSync(filePath, kept.join('\n'), 'utf8');
console.log('Done. New line count:', kept.length);
