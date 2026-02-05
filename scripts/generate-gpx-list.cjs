const fs = require('fs');
const path = require('path');

function writeFileList(dir) {
  const absDir = path.join(__dirname, '..', 'public', dir);
  const files = fs.readdirSync(absDir)
    .filter(f => f.endsWith('.gpx'));
  fs.writeFileSync(
    path.join(absDir, 'filelist.json'),
    JSON.stringify(files, null, 2)
  );
}

writeFileList('data');
writeFileList('completed'); 