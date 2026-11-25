import { glyph } from './font5x7';
import type { Bitmap } from './bitmaps';

// 128x64 monochrome framebuffer with the subset of the Adafruit SSD1306/GFX
// API the mrbMaze library uses (clearDisplay, drawPixel, drawBitmap,
// setCursor, setTextSize, print).
export class OledDisplay {
    static readonly W = 128;
    static readonly H = 64;
    readonly buf = new Uint8Array(OledDisplay.W * OledDisplay.H);
    private cx = 0;
    private cy = 0;
    private size = 1;
    revision = 0; // bumps when commit() finds a changed picture
    private lastHash = -1;

    clear() { this.buf.fill(0); }

    // Like display.display(): publish the frame (only counts as new if it changed)
    commit() {
        let h = 0;
        for (let i = 0; i < this.buf.length; i++) h = (h * 31 + (this.buf[i] ? i + 1 : 0)) | 0;
        if (h !== this.lastHash) { this.lastHash = h; this.revision++; }
    }

    pixel(x: number, y: number) {
        if (x < 0 || y < 0 || x >= OledDisplay.W || y >= OledDisplay.H) return;
        this.buf[y * OledDisplay.W + x] = 1;
    }

    hline(x0: number, x1: number, y: number) { for (let x = x0; x <= x1; x++) this.pixel(x, y); }
    vline(x: number, y0: number, y1: number) { for (let y = y0; y <= y1; y++) this.pixel(x, y); }

    // Adafruit drawBitmap: rows of ceil(w/8) bytes, MSB = leftmost pixel; 0 bits are transparent
    bitmap(x: number, y: number, bmp: Bitmap | undefined) {
        if (!bmp) return;
        const bw = (bmp.w + 7) >> 3;
        for (let j = 0; j < bmp.h; j++) {
            for (let i = 0; i < bmp.w; i++) {
                if (bmp.data[j * bw + (i >> 3)] & (0x80 >> (i & 7))) this.pixel(x + i, y + j);
            }
        }
    }

    setCursor(x: number, y: number) { this.cx = x; this.cy = y; }
    setTextSize(s: number) { this.size = Math.max(1, Math.round(s)); }

    print(v: string | number) {
        for (const ch of String(v)) {
            const g = glyph(ch);
            for (let r = 0; r < 7; r++) {
                for (let c = 0; c < 5; c++) {
                    if (!g[r][c]) continue;
                    for (let dy = 0; dy < this.size; dy++) {
                        for (let dx = 0; dx < this.size; dx++) this.pixel(this.cx + c * this.size + dx, this.cy + r * this.size + dy);
                    }
                }
            }
            this.cx += 6 * this.size;
        }
    }

    // Paint into a 128x64 canvas (1 canvas pixel per OLED pixel)
    renderTo(canvas: HTMLCanvasElement, on = [214, 236, 255], off = [6, 10, 20]) {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const img = ctx.createImageData(OledDisplay.W, OledDisplay.H);
        for (let i = 0; i < this.buf.length; i++) {
            const c = this.buf[i] ? on : off;
            img.data[i * 4] = c[0];
            img.data[i * 4 + 1] = c[1];
            img.data[i * 4 + 2] = c[2];
            img.data[i * 4 + 3] = 255;
        }
        ctx.putImageData(img, 0, 0);
    }
}
