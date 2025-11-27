# Tileset System

## Overview
The VibeMaster client now uses a tileset-based rendering system for the game map. This replaces the previous solid-color tile rendering with textured tiles from sprite sheets.

## File Structure
```
client/
├── public/
│   └── assets/
│       └── tilesets/
│           ├── dev-tileset-grass.png      # 256x256 grass texture atlas
│           ├── dev-tileset-grass.json     # Grass tileset metadata
│           ├── dev-tileset-stone.png      # 256x256 stone texture atlas
│           └── dev-tileset-stone.json     # Stone tileset metadata
└── src/
    └── game/
        ├── TilesetLoader.ts               # Tileset loading and management
        └── GameRenderer.ts                # Updated to use tilesets
```

## Tileset JSON Format
Each tileset JSON file contains:
- `texture`: Filename of the PNG image
- `imageWidth` / `imageHeight`: Dimensions of the texture atlas (256x256)
- `tileSize`: Size of each tile in pixels (32x32)
- `tiles`: Array of 64 tile definitions (8x8 grid)

Each tile entry includes:
- `id`: Unique identifier (0-63)
- `x`, `y`: Position in the texture atlas
- `width`, `height`: Tile dimensions (32x32)
- `type`: Tile type ("grass" or "stone")
- `properties`:
  - `walkable`: Boolean indicating if the tile is walkable
  - `variant`: Unique variant identifier (e.g., "grass_0_0")

## How It Works

### 1. TilesetLoader
The `TilesetLoader` class handles:
- Loading tileset JSON metadata
- Loading texture atlas images
- Providing UV coordinates for specific tiles
- Getting random tile variants for variety

### 2. GameRenderer Integration
The `GameRenderer` class:
- Initializes the `TilesetLoader` on construction
- Loads both grass and stone tilesets asynchronously
- Uses textured tiles when rendering the map
- Falls back to solid colors if tilesets aren't loaded yet

### 3. Rendering Process
For each tile in the map:
1. Determine which tileset to use based on tile type
2. Select a random tile variant from that tileset
3. Calculate UV coordinates for the selected tile
4. Create a textured mesh with the appropriate material
5. Position the mesh in the 3D scene

## Tile Type Mapping
- `GRASS` → grass tileset
- `FLOOR` → grass tileset
- `WALL` → stone tileset
- `WATER` → stone tileset

## Adding New Tilesets

### 1. Create the Tileset Image
- Create a 256x256 PNG image
- Organize tiles in an 8x8 grid (32x32 pixels each)

### 2. Generate the JSON
Use the tileset generator script:
```javascript
const fs = require('fs');
const path = require('path');

const TILE_SIZE = 32;
const IMG_SIZE = 256;
const COLS = IMG_SIZE / TILE_SIZE;
const ROWS = IMG_SIZE / TILE_SIZE;

function generateJson(filename, type, walkable) {
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
                    walkable: walkable,
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

// Example usage:
generateJson('my-tileset.png', 'custom', true);
```

### 3. Load the Tileset
Add to `GameRenderer.loadTilesets()`:
```typescript
await this.tilesetLoader.loadTileset(
    'custom',
    '/assets/tilesets/my-tileset.json',
    '/assets/tilesets/my-tileset.png'
);
```

### 4. Use in Rendering
Update the tile type mapping in `GameRenderer.renderMap()`:
```typescript
case TileType.CUSTOM:
    texture = this.tilesetLoader.getTexture('custom');
    tilesetName = 'custom';
    break;
```

## Performance Considerations
- Tilesets use `THREE.NearestFilter` for crisp pixel art rendering
- Random tile selection happens once per map render
- UV coordinates are calculated on-the-fly (could be cached if needed)
- Fallback rendering ensures the game works even if tilesets fail to load

## Future Enhancements
- [ ] Tile caching to avoid recreating geometries
- [ ] Animated tiles support
- [ ] Tile rotation and flipping
- [ ] Multi-layer tile rendering (ground, decorations, etc.)
- [ ] Tileset preloading screen
- [ ] Procedural tile selection based on neighboring tiles (autotiling)
