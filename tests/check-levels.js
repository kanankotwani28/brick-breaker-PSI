/* Level solvability check - can every breakable brick in every level be
   reached by the ball?

   The ball (46 logical px across) is far wider than the 12 px gap between
   bricks, so it can only travel through cells whose brick is gone, moving
   between cells that share an edge. It can never reach a brick's corner
   between two diagonal stones either. Starting from below the field, every
   brick the ball can touch is broken, which opens its cell, and so on until
   nothing changes. A breakable brick still standing at the end can never be
   hit - the level cannot be finished.

   The strip above the top row is open play area too, so once any top-row
   cell is open the whole top row can be hit from above. The side strips are
   narrower than the ball and never count.

   Run:  node tests/check-levels.js          (exit code 1 if any level is unwinnable)
   Also loaded by playtest.html, which runs it against the live LEVELS.
*/
'use strict';

function loadLevels() {
  const fs = require('fs'), path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'www', 'index.html'), 'utf8');
  const start = src.indexOf('const LEVEL_DATA = [');
  const end = src.indexOf('];', start);
  if (start < 0 || end < 0) throw new Error('LEVEL_DATA not found in www/index.html');
  return Function('return ' + src.slice(start + 'const LEVEL_DATA = '.length, end + 1))();
}

/* Returns the [row, col] of every breakable brick the ball can never reach. */
function unreachable(rows) {
  const R = rows.length, C = 6;
  const cell = (r, c) => (rows[r][c] || '.');
  const open = rows.map((row) => Array.from({ length: C }, (_, c) => cell(rows.indexOf(row), c) === '.'));
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) open[r][c] = cell(r, c) === '.';
  const broken = rows.map(() => Array(C).fill(false));
  const reach = rows.map(() => Array(C).fill(false));
  let topOpen = false;

  let changed = true;
  while (changed) {
    changed = false;
    /* flood the open cells the ball can get into: from below the last row,
       from the top strip if it is reachable, and from each other */
    const q = [];
    for (let c = 0; c < C; c++) {
      if (open[R - 1][c] && !reach[R - 1][c]) { reach[R - 1][c] = true; q.push([R - 1, c]); }
      if (topOpen && open[0][c] && !reach[0][c]) { reach[0][c] = true; q.push([0, c]); }
    }
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (reach[r][c]) q.push([r, c]);
    while (q.length) {
      const [r, c] = q.pop();
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dr, dc]) => {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr >= R || nc < 0 || nc >= C) return;
        if (open[nr][nc] && !reach[nr][nc]) { reach[nr][nc] = true; q.push([nr, nc]); changed = true; }
      });
    }
    if (!topOpen && reach[0].some(Boolean)) { topOpen = true; changed = true; }

    /* break every brick the ball can touch: bottom row from below, top row
       from above once the top strip is reachable, any brick beside a
       reachable open cell */
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      const ch = cell(r, c);
      if (ch === '.' || ch === 'S' || broken[r][c]) continue;
      const touch = r === R - 1 || (topOpen && r === 0) ||
        [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dr, dc]) => {
          const nr = r + dr, nc = c + dc;
          return nr >= 0 && nr < R && nc >= 0 && nc < C && reach[nr][nc];
        });
      if (touch) { broken[r][c] = true; open[r][c] = true; changed = true; }
    }
  }

  const out = [];
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const ch = cell(r, c);
    if (ch !== '.' && ch !== 'S' && !broken[r][c]) out.push([r, c]);
  }
  return out;
}

if (typeof window !== 'undefined') window.checkLevels = { unreachable: unreachable };

if (typeof module !== 'undefined' && require.main === module) {
  const levels = loadLevels();
  let bad = 0;
  levels.forEach((lv, i) => {
    const u = unreachable(lv.rows);
    if (!u.length) { console.log('ok    ' + String(i + 1).padStart(2) + ' ' + lv.name); return; }
    bad++;
    console.log('FAIL  ' + String(i + 1).padStart(2) + ' ' + lv.name + ' - ' + u.length + ' brick(s) can never be hit:');
    lv.rows.forEach((row, r) => {
      const mark = row.split('').map((ch, c) => (u.some(([ur, uc]) => ur === r && uc === c) ? '#' : ch)).join('');
      console.log('        ' + row + '   ' + mark);
    });
  });
  console.log(bad ? '\n' + bad + ' level(s) cannot be finished (# = unreachable brick)' : '\nall ' + levels.length + ' levels can be finished');
  process.exit(bad ? 1 : 0);
}

if (typeof module !== 'undefined') module.exports = { unreachable, loadLevels };
