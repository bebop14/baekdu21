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

// completed 디렉토리의 GPX 파일에서 name 태그를 읽어 차수 순으로 정렬된 목록 생성
function writeCompletedOrderedList() {
  const absDir = path.join(__dirname, '..', 'public', 'completed');
  const files = fs.readdirSync(absDir).filter(f => f.endsWith('.gpx'));

  const entries = files.map(f => {
    const content = fs.readFileSync(path.join(absDir, f), 'utf-8');
    const nameMatch = content.match(/<name>(.*?)<\/name>/);
    const name = nameMatch ? nameMatch[1] : '';
    // "1차", "22차" 등에서 차수 추출
    const orderMatch = name.match(/^(\d+)차/);
    const order = orderMatch ? parseInt(orderMatch[1], 10) : 999;
    return { file: f, name, order };
  });

  // 차수(진행 순서) 기준 정렬
  entries.sort((a, b) => a.order - b.order);

  fs.writeFileSync(
    path.join(absDir, 'timeline.json'),
    JSON.stringify(entries, null, 2)
  );
}

writeFileList('data');
writeFileList('completed');
writeCompletedOrderedList();
