
import fs from 'fs';
import path from 'path';

const mapPath = path.join(process.cwd(), 'databases/maps/01_starting_zone.json');
const swatchesPath = path.join(process.cwd(), 'databases/swatches.json');

const mapData = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
const swatchesData = JSON.parse(fs.readFileSync(swatchesPath, 'utf8'));

// Find the new swatches
const startingZoneSet = swatchesData.find((s: any) => s.id === '01_starting_zone_set');
if (!startingZoneSet) throw new Error('01_starting_zone_set not found in swatches.json');

const dirtSwatches = startingZoneSet.swatches.filter((s: any) => s.id.startsWith('dirt'));
const cobbleSwatches = startingZoneSet.swatches.filter((s: any) => s.id.startsWith('cobble'));

if (dirtSwatches.length === 0 || cobbleSwatches.length === 0) {
    throw new Error('Missing dirt or cobble swatches in 01_starting_zone_set');
}

// Helper to get a random swatch ID
const getRandomSwatchId = (swatches: any[]) => {
    const index = Math.floor(Math.random() * swatches.length);
    return swatches[index].id;
};

// 1. Clear existing placed swatches
mapData.placedSwatches = [];

// 2. Fill the entire map with dirt swatches (base layer)
// Since swatches are 1x1 tile (gridSize 256 maps to 1 tile), we iterate tile by tile.
// Wait, is gridSize 256 mapping to 1 tile?
// Yes, the user said "grid size maps pixel to 1 tile".
// And in WorldManager we do:
// const relX = (t.x - minTx) / swatch.gridSize;
// const worldX = placement.x / 32 + relX;
// If swatch.gridSize is 256, and t.x increments by 256, relX increments by 1.
// So 1 swatch tile = 1 world tile.
// And placement.x is in 32px units.
// So we place at x*32, y*32.

console.log('Filling map with dirt...');
for (let x = 0; x < mapData.width; x++) {
    for (let y = 0; y < mapData.height; y++) {
        mapData.placedSwatches.push({
            x: x * 32,
            y: y * 32,
            swatchId: getRandomSwatchId(dirtSwatches),
            instanceId: Math.random().toString(36).substr(2, 9)
        });
    }
}

// 3. Overlay regions with cobble swatches (walls)
console.log('Applying regions...');
for (const region of mapData.tiles.regions) {
    const { x, y, width, height } = region.area;

    // Only process WALL regions for now, maybe WATER too if we had water swatches in the set
    // But the set only has dirt and cobble.
    // Let's assume WALL = cobble.

    if (region.type === 'WALL') {
        console.log(`  - ${region.name} (WALL) -> Cobble`);
        for (let dx = 0; dx < width; dx++) {
            for (let dy = 0; dy < height; dy++) {
                const wx = x + dx;
                const wy = y + dy;

                // Find existing dirt swatch at this position and replace it?
                // Or just add on top? WorldManager renders in order, so adding on top works if we want layers.
                // But for a base map, replacing is cleaner to avoid overdraw.

                const existingIndex = mapData.placedSwatches.findIndex((p: any) => p.x === wx * 32 && p.y === wy * 32);
                if (existingIndex !== -1) {
                    mapData.placedSwatches[existingIndex] = {
                        x: wx * 32,
                        y: wy * 32,
                        swatchId: getRandomSwatchId(cobbleSwatches),
                        instanceId: Math.random().toString(36).substr(2, 9)
                    };
                } else {
                    mapData.placedSwatches.push({
                        x: wx * 32,
                        y: wy * 32,
                        swatchId: getRandomSwatchId(cobbleSwatches),
                        instanceId: Math.random().toString(36).substr(2, 9)
                    });
                }
            }
        }
    } else if (region.type === 'WATER') {
        // Keep using single_water for now as it has the blue tint we just added
        console.log(`  - ${region.name} (WATER) -> Single Water`);
        for (let dx = 0; dx < width; dx++) {
            for (let dy = 0; dy < height; dy++) {
                const wx = x + dx;
                const wy = y + dy;

                const existingIndex = mapData.placedSwatches.findIndex((p: any) => p.x === wx * 32 && p.y === wy * 32);
                const waterSwatch = {
                    x: wx * 32,
                    y: wy * 32,
                    swatchId: 'single_water',
                    instanceId: Math.random().toString(36).substr(2, 9)
                };

                if (existingIndex !== -1) {
                    mapData.placedSwatches[existingIndex] = waterSwatch;
                } else {
                    mapData.placedSwatches.push(waterSwatch);
                }
            }
        }
    }
}

// 4. Save map
fs.writeFileSync(mapPath, JSON.stringify(mapData, null, 4));
console.log('Updated 01_starting_zone.json with new swatches');
