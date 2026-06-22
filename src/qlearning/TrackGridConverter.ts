/**
 * TrackGridConverter
 * Mengkonversi track canvas (800x800 pixel) menjadi grid matrix
 * yang bisa dibaca oleh Q-Learning agent.
 */

export const GRID_SIZE = 40; // 40x40 grid
const CELL_SIZE = 800 / GRID_SIZE; // 20px per cell
const LINE_THRESHOLD = 0.15; // cell dianggap "garis" jika >15% pixel hitam

export type GridMatrix = number[][]; // 0 = background, 1 = line

/**
 * Konversi canvas menjadi binary matrix 800x800
 */
function canvasToBinaryMatrix(ctx: CanvasRenderingContext2D): number[][] {
  const imageData = ctx.getImageData(0, 0, 800, 800);
  const pixels = imageData.data;
  const matrix: number[][] = [];

  for (let y = 0; y < 800; y++) {
    matrix[y] = [];
    for (let x = 0; x < 800; x++) {
      const idx = (y * 800 + x) * 4;
      const grayscale = (pixels[idx] + pixels[idx + 1] + pixels[idx + 2]) / 3;
      matrix[y][x] = grayscale < 128 ? 1 : 0;
    }
  }
  return matrix;
}

/**
 * Downscale binary matrix (800x800) ke grid matrix (GRID_SIZE x GRID_SIZE)
 */
function binaryToGrid(binary: number[][]): GridMatrix {
  const grid: GridMatrix = [];

  for (let gy = 0; gy < GRID_SIZE; gy++) {
    grid[gy] = [];
    for (let gx = 0; gx < GRID_SIZE; gx++) {
      let blackCount = 0;
      const totalPixels = CELL_SIZE * CELL_SIZE;

      for (let py = 0; py < CELL_SIZE; py++) {
        for (let px = 0; px < CELL_SIZE; px++) {
          const x = Math.floor(gx * CELL_SIZE + px);
          const y = Math.floor(gy * CELL_SIZE + py);
          if (y < 800 && x < 800) {
            blackCount += binary[y][x];
          }
        }
      }
      grid[gy][gx] = (blackCount / totalPixels) > LINE_THRESHOLD ? 1 : 0;
    }
  }
  return grid;
}

/**
 * Deteksi persimpangan dari grid matrix.
 * Persimpangan = cell garis yang punya >= 3 tetangga garis (T-junction, cross, etc.)
 */
export interface Intersection {
  gx: number;
  gy: number;
  neighbors: number; // jumlah tetangga garis
  pixelX: number;    // posisi pixel di canvas
  pixelY: number;
}

function getNeighborCount(grid: GridMatrix, gx: number, gy: number): number {
  let count = 0;
  const dirs = [
    [0, -1], [0, 1], [-1, 0], [1, 0], // up, down, left, right
  ];
  for (const [dx, dy] of dirs) {
    const nx = gx + dx;
    const ny = gy + dy;
    if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
      if (grid[ny][nx] === 1) count++;
    }
  }
  return count;
}

export function detectIntersections(grid: GridMatrix): Intersection[] {
  const intersections: Intersection[] = [];

  for (let gy = 0; gy < GRID_SIZE; gy++) {
    for (let gx = 0; gx < GRID_SIZE; gx++) {
      if (grid[gy][gx] !== 1) continue;

      const neighbors = getNeighborCount(grid, gx, gy);
      // Persimpangan: memiliki >= 3 tetangga garis (T, +, atau pertigaan)
      if (neighbors >= 3) {
        intersections.push({
          gx, gy, neighbors,
          pixelX: Math.floor(gx * CELL_SIZE + CELL_SIZE / 2),
          pixelY: Math.floor(gy * CELL_SIZE + CELL_SIZE / 2),
        });
      }
    }
  }

  // Gabungkan persimpangan yang terlalu dekat (dalam radius 3 cell)
  return mergeCloseIntersections(intersections, 3);
}

function mergeCloseIntersections(ints: Intersection[], radius: number): Intersection[] {
  const merged: Intersection[] = [];
  const used = new Set<number>();

  for (let i = 0; i < ints.length; i++) {
    if (used.has(i)) continue;

    let sumGx = ints[i].gx;
    let sumGy = ints[i].gy;
    let maxNeighbors = ints[i].neighbors;
    let count = 1;

    for (let j = i + 1; j < ints.length; j++) {
      if (used.has(j)) continue;
      const dx = Math.abs(ints[i].gx - ints[j].gx);
      const dy = Math.abs(ints[i].gy - ints[j].gy);
      if (dx <= radius && dy <= radius) {
        sumGx += ints[j].gx;
        sumGy += ints[j].gy;
        maxNeighbors = Math.max(maxNeighbors, ints[j].neighbors);
        count++;
        used.add(j);
      }
    }
    used.add(i);

    const avgGx = Math.round(sumGx / count);
    const avgGy = Math.round(sumGy / count);
    merged.push({
      gx: avgGx, gy: avgGy,
      neighbors: maxNeighbors,
      pixelX: Math.floor(avgGx * CELL_SIZE + CELL_SIZE / 2),
      pixelY: Math.floor(avgGy * CELL_SIZE + CELL_SIZE / 2),
    });
  }
  return merged;
}

/**
 * Entry point utama: konversi canvas → grid + intersections
 */
export function convertTrackToGrid(ctx: CanvasRenderingContext2D): {
  grid: GridMatrix;
  intersections: Intersection[];
} {
  const binary = canvasToBinaryMatrix(ctx);
  const grid = binaryToGrid(binary);
  const intersections = detectIntersections(grid);
  return { grid, intersections };
}

/**
 * Konversi posisi pixel ke posisi grid
 */
export function pixelToGrid(px: number, py: number): { gx: number; gy: number } {
  return {
    gx: Math.floor(px / CELL_SIZE),
    gy: Math.floor(py / CELL_SIZE),
  };
}

/**
 * Cek apakah posisi pixel ada di atas garis
 */
export function isOnLine(grid: GridMatrix, px: number, py: number): boolean {
  const { gx, gy } = pixelToGrid(px, py);
  if (gx < 0 || gx >= GRID_SIZE || gy < 0 || gy >= GRID_SIZE) return false;
  return grid[gy][gx] === 1;
}
