/**
 * Icon Generator Script
 * Run with: node generate-icons.js
 * Requires: npm install canvas
 */

const fs = require('fs');
const { createCanvas } = require('canvas');

function drawIcon(size) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    
    // Scale factor
    const scale = size / 24;
    
    // Create gradient
    const gradient = ctx.createLinearGradient(3 * scale, 2 * scale, 21 * scale, 22 * scale);
    gradient.addColorStop(0, '#10B981');
    gradient.addColorStop(1, '#059669');
    
    // Draw shield
    ctx.beginPath();
    ctx.moveTo(12 * scale, 2 * scale);
    ctx.lineTo(3 * scale, 7 * scale);
    ctx.lineTo(3 * scale, 12 * scale);
    ctx.bezierCurveTo(3 * scale, 17 * scale, 7 * scale, 21.5 * scale, 12 * scale, 22.5 * scale);
    ctx.bezierCurveTo(17 * scale, 21.5 * scale, 21 * scale, 17 * scale, 21 * scale, 12 * scale);
    ctx.lineTo(21 * scale, 7 * scale);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
    
    // Draw checkmark
    ctx.beginPath();
    ctx.moveTo(10 * scale, 15.5 * scale);
    ctx.lineTo(7.5 * scale, 13 * scale);
    ctx.lineTo(8.91 * scale, 11.59 * scale);
    ctx.lineTo(10 * scale, 12.67 * scale);
    ctx.lineTo(14.59 * scale, 8.09 * scale);
    ctx.lineTo(16 * scale, 9.5 * scale);
    ctx.closePath();
    ctx.fillStyle = 'white';
    ctx.fill();
    
    return canvas;
}

// Generate icons
[16, 32, 48, 128].forEach(size => {
    const canvas = drawIcon(size);
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(`icon${size}.png`, buffer);
    console.log(`Created icon${size}.png`);
});

console.log('All icons generated!');
