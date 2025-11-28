
import fs from 'fs';
import path from 'path';

const mapPath = path.join(process.cwd(), 'databases/maps/01_starting_zone.json');
const swatchesPath = path.join(process.cwd(), 'databases/swatches.json');

const mapData = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
const swatchesData = JSON.parse(fs.readFileSync(swatchesPath, 'utf8'));

// 1. Ensure we have single-tile swatches for filling
const testSet = swatchesData.find((s: any) => s.id === 'test_set');
if (!testSet) throw new Error('Test set not found');

// Add single wall swatch if not exists
if (!testSet.swatches.find((s: any) => s.id === 'single_wall')) {
    testSet.swatches.push({
        id: 'single_wall',
        name: 'Single Wall',
        tileset: 'dev-tileset-stone',
        gridSize: 256,
        properties: { walkable: false },
        tiles: [{ x: 0, y: 0 }]
    });
}

// Add single water swatch if not exists
if (!testSet.swatches.find((s: any) => s.id === 'single_water')) {
    testSet.swatches.push({
        id: 'single_water',
        name: 'Single Water',
        tileset: 'dev-tileset-stone', // Using stone for water as per existing logic
        gridSize: 256,
        properties: { walkable: false },
        tiles: [{ x: 0, y: 0 }] // Placeholder coordinate, might need adjustment
    });
}

fs.writeFileSync(swatchesPath, JSON.stringify(swatchesData, null, 4));
console.log('Updated swatches.json');

// 2. Convert regions to placedSwatches
if (!mapData.placedSwatches) mapData.placedSwatches = [];

// Clear existing placed swatches to avoid duplicates if run multiple times
mapData.placedSwatches = [];

for (const region of mapData.tiles.regions) {
    const { x, y, width, height } = region.area;
    let swatchId = '';

    if (region.type === 'WALL') {
        swatchId = 'single_wall';
    } else if (region.type === 'WATER') {
        swatchId = 'single_water';
    } else {
        continue;
    }

    console.log(`Processing region ${region.name} (${region.type}) at ${x},${y} ${width}x${height}`);

    for (let dx = 0; dx < width; dx++) {
        for (let dy = 0; dy < height; dy++) {
            mapData.placedSwatches.push({
                x: (x + dx) * 32, // Convert grid to pixel coords (assuming 32px grid in editor)
                y: (y + dy) * 32,
                swatchId: swatchId,
                instanceId: Math.random().toString(36).substr(2, 9)
            });
        }
    }
}

// 3. Save map
fs.writeFileSync(mapPath, JSON.stringify(mapData, null, 4));
console.log('Updated 01_starting_zone.json with placedSwatches');
