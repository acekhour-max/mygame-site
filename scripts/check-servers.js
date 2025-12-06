// Scheduled script to scan servers and create replacements for servers that became full
// and are still full after the configured delay.
//
// Usage: node scripts/check-servers.js
const fs = require('fs');
const path = require('path');
const { REPLACEMENT_DELAY_MS, SERVER_CAPACITY } = require('../config');

const DATA_FILE = path.join(__dirname, '..', 'servers.json');

function readData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (err) {
    return { servers: [] };
  }
}
function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function createServerRecord(name) {
  const now = Date.now();
  return {
    id: `srv-${now}`,
    name: name || `Server-${new Date(now).toISOString()}`,
    capacity: SERVER_CAPACITY,
    players: 0,
    created_at: now,
    full_at: null,
    spawned_replacement: false
  };
}

function runCheck() {
  const db = readData();
  const now = Date.now();
  const created = [];

  db.servers.forEach(srv => {
    // Only consider servers that were marked full and haven't spawned a replacement yet
    if (srv.full_at && !srv.spawned_replacement) {
      const elapsed = now - srv.full_at;

      // Ensure required delay passed
      if (elapsed >= REPLACEMENT_DELAY_MS) {
        // IMPORTANT: only spawn a replacement if the server is still full now
        if (srv.players >= srv.capacity) {
          const repl = createServerRecord(`${srv.name}-replica`);
          db.servers.push(repl);
          srv.spawned_replacement = true;
          created.push({ original: srv.id, replacement: repl.id });
          console.log(`Spawned replacement ${repl.id} for full server ${srv.id}`);
        } else {
          // Server is no longer full — do not spawn. Keep full_at or clear it depending on desired policy.
          console.log(`Server ${srv.id} was full at ${new Date(srv.full_at).toISOString()} but is not full now (players=${srv.players}). No replacement spawned.`);
          // Optionally clear full_at so future fullness is tracked from a fresh time:
          // srv.full_at = null;
        }
      } else {
        const remainingMs = REPLACEMENT_DELAY_MS - elapsed;
        console.log(`Server ${srv.id} waiting ${Math.ceil(remainingMs/1000/60/60/24)} day(s) to spawn replacement`);
      }
    }
  });

  writeData(db);
  if (created.length === 0) {
    console.log('No replacements created in this run.');
  }
}

runCheck();