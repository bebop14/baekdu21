#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function writeText(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf8');
}

function stripJsonTrailingCommas(jsonLike) {
  // Remove trailing commas before ] or }
  return jsonLike
    .replace(/,\s*]/g, ']')
    .replace(/,\s*}/g, '}');
}

function parseServerJson(serverJsonPath) {
  const raw = readText(serverJsonPath);
  const sanitized = stripJsonTrailingCommas(raw);
  try {
    return JSON.parse(sanitized);
  } catch (err) {
    console.error('server.json 파싱 실패. 파일 내용을 확인하세요.');
    throw err;
  }
}

function extractHostsFromKnownHosts(knownHostsContent) {
  const hosts = new Set();
  const lines = knownHostsContent.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const firstToken = trimmed.split(/\s+/)[0];
    if (!firstToken) continue;
    const maybeMultiple = firstToken.split(',');
    for (const h of maybeMultiple) {
      const hostname = h.trim();
      if (!hostname) continue;
      hosts.add(hostname);
    }
  }
  return Array.from(hosts);
}

function ensureHostsInProfiles(serverObj, hostsToAdd) {
  if (!serverObj || !Array.isArray(serverObj.profiles)) {
    throw new Error('server.json에 profiles 배열이 없습니다.');
  }

  for (const profile of serverObj.profiles) {
    if (!Array.isArray(profile.hosts)) {
      profile.hosts = [];
    }
    const existingHostnames = new Set(
      profile.hosts
        .filter(h => h && typeof h.hostname === 'string')
        .map(h => h.hostname)
    );

    const additions = [];
    for (const host of hostsToAdd) {
      if (!existingHostnames.has(host)) {
        additions.push({ hostname: host, description: '' });
        existingHostnames.add(host);
      }
    }

    if (additions.length > 0) {
      profile.hosts.push(...additions);
    }
  }
}

function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const knownHostsPath = path.resolve(projectRoot, '.known_hosts');
  const serverJsonPath = path.resolve(projectRoot, 'server.json');

  if (!fs.existsSync(knownHostsPath)) {
    console.error(`파일 없음: ${knownHostsPath}`);
    process.exit(1);
  }
  if (!fs.existsSync(serverJsonPath)) {
    console.error(`파일 없음: ${serverJsonPath}`);
    process.exit(1);
  }

  const knownHostsContent = readText(knownHostsPath);
  const hostsFromKnown = extractHostsFromKnownHosts(knownHostsContent);

  if (hostsFromKnown.length === 0) {
    console.log('추가할 호스트가 없습니다.');
    process.exit(0);
  }

  const serverObj = parseServerJson(serverJsonPath);
  ensureHostsInProfiles(serverObj, hostsFromKnown);

  const output = JSON.stringify(serverObj, null, 2) + '\n';
  writeText(serverJsonPath, output);

  console.log(`병합 완료: ${hostsFromKnown.length}개 후보를 처리했습니다.`);
}

if (require.main === module) {
  try {
    main();
  } catch (e) {
    console.error(e.message || e);
    process.exit(1);
  }
}
