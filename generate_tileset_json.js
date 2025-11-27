const fs = require('fs');
const path = require('path');

const TILE_SIZE = 32;
const IMG_SIZE = 256;
const COLS = IMG_SIZE / TILE_SIZE;
const ROWS = IMG_SIZE / TILE_SIZE;

function generateJson(filename, type) {
    const tiles = [];
    let id = 0;
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            tiles.push({
                id: id++,
                x: x * TILE_SIZE,
                y: y * TILE_SIZE,
                width: TILE_SIZE,
                height: TILE_SIZE,
                type: type,
                properties: {
                    walkable: type === 'grass',
                    variant: `${type}_${y}_${x}`
                }
            });
        }
    }

    const data = {
        texture: filename,
        imageWidth: IMG_SIZE,
        imageHeight: IMG_SIZE,
        tileSize: TILE_SIZE,
        tiles: tiles
    };

    fs.writeFileSync(
        path.join(process.cwd(), 'client/public/assets/tilesets', filename.replace('.png', '.json')),
        JSON.stringify(data, null, 2)
    );
}

generateJson('dev-tileset-grass.png', 'grass');
generateJson('dev-tileset-stone.png', 'stone');
