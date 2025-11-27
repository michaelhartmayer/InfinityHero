const fs = require('fs');
const path = require('path');

function getPngDimensions(filePath) {
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(24);
    fs.readSync(fd, buffer, 0, 24, 0);
    fs.closeSync(fd);

    // Check PNG signature
    if (buffer.toString('hex', 0, 8) !== '89504e470d0a1a0a') {
        throw new Error('Not a PNG file');
    }

    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return { width, height };
}

const files = [
    'client/public/assets/tilesets/dev-tileset-grass.png',
    'client/public/assets/tilesets/dev-tileset-stone.png'
];

files.forEach(f => {
    try {
        const dims = getPngDimensions(path.join(process.cwd(), f));
        console.log(`${f}: ${dims.width}x${dims.height}`);
    } catch (e) {
        console.error(`${f}: Error - ${e.message}`);
    }
});
