/**
 * board.js - AZ Kvíz hex board logic
 *
 * Layout: equilateral triangle, 7 rows, row r has (r+1) hexes.
 * Indexing: index 0 = apex, left-to-right within each row.
 *   Row r starts at index r*(r+1)/2.
 *
 * Neighbor rule for (r, c):
 *   (r-1,c-1), (r-1,c), (r,c-1), (r,c+1), (r+1,c), (r+1,c+1)
 *
 * Edges:
 *   A = left  edge: col 0 of each row
 *   B = right edge: last col of each row
 *   C = bottom row: all fields in row 6
 */

const ROWS = 7;

/** @param {number} r @returns {number} */
function rowStart(r) {
  return (r * (r + 1)) / 2;
}

/** Derive row and col from flat index. @param {number} index @returns {{ r: number, c: number }} */
function indexToRC(index) {
  let r = 0;
  while (rowStart(r + 1) <= index) r++;
  return { r, c: index - rowStart(r) };
}

/**
 * @typedef {{ index: number, row: number, col: number, owner: string|null }} Field
 */

/**
 * Returns the initial board: 28 fields, all owner = null.
 * @returns {Field[]}
 */
export function createBoard() {
  const board = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c <= r; c++) {
      board.push({ index: rowStart(r) + c, row: r, col: c, owner: null });
    }
  }
  return board;
}

/**
 * Returns indices of all valid neighbors of the field at `index`.
 * @param {number} index
 * @returns {number[]}
 */
export function getNeighbors(index) {
  const { r, c } = indexToRC(index);
  return [
    [r - 1, c - 1],
    [r - 1, c],
    [r,     c - 1],
    [r,     c + 1],
    [r + 1, c],
    [r + 1, c + 1],
  ]
    .filter(([nr, nc]) => nr >= 0 && nr < ROWS && nc >= 0 && nc <= nr)
    .map(([nr, nc]) => rowStart(nr) + nc);
}

/**
 * Returns the three edge field sets.
 *   A = left edge  (col 0 of every row)
 *   B = right edge (last col of every row)
 *   C = bottom row (all 7 fields of row 6)
 * @returns {{ A: number[], B: number[], C: number[] }}
 */
export function getEdgeFields() {
  const A = [];
  const B = [];
  const C = [];
  for (let r = 0; r < ROWS; r++) {
    A.push(rowStart(r));         // col 0
    B.push(rowStart(r) + r);     // col r (last)
  }
  const lastRow = ROWS - 1;
  for (let c = 0; c <= lastRow; c++) {
    C.push(rowStart(lastRow) + c);
  }
  return { A, B, C };
}

/**
 * Returns true if `teamId` has a connected path of owned fields
 * touching all three edges (A, B and C).
 * @param {Field[]} board
 * @param {string} teamId
 * @returns {boolean}
 */
export function checkWin(board, teamId) {
  const { A, B, C } = getEdgeFields();
  const setA = new Set(A);
  const setB = new Set(B);
  const setC = new Set(C);

  const visited = new Set();

  for (let start = 0; start < board.length; start++) {
    if (board[start].owner !== teamId || visited.has(start)) continue;

    // BFS: collect connected component
    const queue = [start];
    const component = new Set([start]);
    visited.add(start);

    while (queue.length > 0) {
      const curr = queue.shift();
      for (const nb of getNeighbors(curr)) {
        if (!visited.has(nb) && board[nb].owner === teamId) {
          visited.add(nb);
          component.add(nb);
          queue.push(nb);
        }
      }
    }

    // Win if component touches all three edges
    const touchA = [...component].some(i => setA.has(i));
    const touchB = [...component].some(i => setB.has(i));
    const touchC = [...component].some(i => setC.has(i));
    if (touchA && touchB && touchC) return true;
  }

  return false;
}

/** Team → fill color */
const OWNER_COLORS = {
  null:  '#d0d0d0',
  A:     '#1e88e5',
  B:     '#e53935',
  C:     '#43a047',
  BLACK: '#424242',
};

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Renders the board as an SVG into `container`.
 * Pointy-top hexagons, responsive (width 100%).
 *
 * @param {Field[]} board
 * @param {HTMLElement} container
 * @param {(index: number) => void} onFieldClick
 */
export function renderBoardSVG(board, container, onFieldClick) {
  const S = 36;                    // circumradius (px)
  const W = Math.sqrt(3) * S;      // hex width
  const ROW_H = 1.5 * S;           // vertical step between row centres

  // Apex centre so the whole board fits with S padding on every side
  const apexX = 3.5 * W;
  const apexY = S;
  const vbW = 7 * W;
  const vbH = (ROWS - 1) * ROW_H + 2 * S;  // top S + bottom S

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${vbW.toFixed(1)} ${vbH.toFixed(1)}`);
  svg.setAttribute('width', '100%');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Hrací plán AZ kvízu');

  const { A, B, C } = getEdgeFields();
  const edgeLabel = new Map();
  A.forEach(i => edgeLabel.set(i, (edgeLabel.get(i) ?? '') + 'A'));
  B.forEach(i => edgeLabel.set(i, (edgeLabel.get(i) ?? '') + 'B'));
  C.forEach(i => edgeLabel.set(i, (edgeLabel.get(i) ?? '') + 'C'));

  for (const field of board) {
    const { index, row: r, col: c, owner } = field;

    // Centre of this hex
    const cx = apexX + c * W - r * W / 2;
    const cy = apexY + r * ROW_H;

    // 6 vertices (pointy-top: first vertex at -90°)
    const pts = [];
    for (let v = 0; v < 6; v++) {
      const angle = (Math.PI / 3) * v - Math.PI / 2;
      pts.push(`${(cx + S * Math.cos(angle)).toFixed(2)},${(cy + S * Math.sin(angle)).toFixed(2)}`);
    }

    const g = document.createElementNS(SVG_NS, 'g');
    g.style.cursor = 'pointer';
    g.setAttribute('data-index', index);

    const poly = document.createElementNS(SVG_NS, 'polygon');
    poly.setAttribute('points', pts.join(' '));
    poly.setAttribute('fill', OWNER_COLORS[owner] ?? OWNER_COLORS['null']);
    poly.setAttribute('stroke', '#ffffff');
    poly.setAttribute('stroke-width', '2');
    g.appendChild(poly);

    // Field index label (small, for debugging)
    const txt = document.createElementNS(SVG_NS, 'text');
    txt.setAttribute('x', cx.toFixed(1));
    txt.setAttribute('y', (cy + 5).toFixed(1));
    txt.setAttribute('text-anchor', 'middle');
    txt.setAttribute('font-size', '11');
    txt.setAttribute('fill', owner === 'BLACK' ? '#aaa' : '#333');
    txt.setAttribute('pointer-events', 'none');
    txt.textContent = index;
    g.appendChild(txt);

    g.addEventListener('click', () => onFieldClick(index));
    svg.appendChild(g);
  }

  container.innerHTML = '';
  container.appendChild(svg);
}
