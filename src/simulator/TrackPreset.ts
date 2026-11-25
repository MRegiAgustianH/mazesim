// Maze Grid preset geometry (canvas px, canvas is 800px = 150cm).
// 6x6 boxes, each 110px (~20.6cm), robot starts at the top-left corner.
export const MAZE_GRID = { margin: 70, cell: 110, cells: 6 } as const;

export const drawTrack = (ctx: CanvasRenderingContext2D, width: number, height: number, type: 'loop' | 'scurve' | 'maze', pixelsPerCm: number = 5.33) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#222';
    ctx.lineWidth = 2.5 * pixelsPerCm; // Line width in pixels (matches exactly 2cm tape width physically)
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';

    ctx.beginPath();

    if (type === 'loop') {
        // Simple rounded loop (more padded to allow robot maneuvering)
        ctx.roundRect(150, 150, width - 300, height - 300, 100);
    } else if (type === 'scurve') {
        // S-Curve (Chicane)
        ctx.moveTo(150, height - 100);
        ctx.lineTo(150, 500); // Straight UP
        // Turn right 90 degrees
        ctx.arc(250, 500, 100, Math.PI, -Math.PI / 2, false);
        // We are at (250, 400). Turn left 90 degrees to get back to facing UP
        ctx.arc(250, 300, 100, Math.PI / 2, 0, true);
        // We are at (350, 300) facing UP
        ctx.lineTo(350, 100); // Straight UP to end

        // Add crossing lines (intersections for testing 'rl' or 'll' or 'sac' or 'trigger')
        ctx.moveTo(130, height - 150);
        ctx.lineTo(170, height - 150); // Start intersection marker

        ctx.moveTo(330, 200);
        ctx.lineTo(370, 200); // End intersection marker
    } else if (type === 'maze') {
        // 6x6 box grid (7 lines each way) for routing/maze logic
        const { margin, cell, cells } = MAZE_GRID;
        const end = margin + cell * cells;
        for (let i = 0; i <= cells; i++) {
            const p = margin + i * cell;
            ctx.moveTo(margin, p); // horizontal
            ctx.lineTo(end, p);
            ctx.moveTo(p, margin); // vertical
            ctx.lineTo(p, end);
        }
    }

    ctx.stroke();
};
