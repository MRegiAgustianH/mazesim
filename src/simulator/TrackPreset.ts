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
        // Grid Maze for routing/maze logic
        // Draw horizontal lines
        for (let y = 150; y <= height - 150; y += 250) {
            ctx.moveTo(150, y);
            ctx.lineTo(width - 150, y);
        }
        // Draw vertical lines
        for (let x = 150; x <= width - 150; x += 250) {
            ctx.moveTo(x, 150);
            ctx.lineTo(x, height - 150);
        }

        // Start point indicator
        ctx.arc(150, 150, 8, 0, Math.PI * 2);
    }

    ctx.stroke();
};
