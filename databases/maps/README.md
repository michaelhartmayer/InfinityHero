# Map Database Format

## Overview
Maps are stored as JSON files in the `databases/maps/` directory. Each map defines the layout, walkable areas, spawn points, and metadata for a game zone.

## File Structure

### Basic Properties
- **`id`**: Unique identifier for the map (string)
- **`name`**: Human-readable name (string)
- **`width`**: Map width in tiles (number)
- **`height`**: Map height in tiles (number)
- **`description`**: Brief description of the map (string)

### Spawn Points
Array of spawn locations for players:
```json
"spawnPoints": [
  { "x": 25, "y": 25, "type": "player" }
]
```

### Tiles Configuration

#### Default Tile
Defines the base tile type that fills the entire map:
```json
"default": {
  "type": "GRASS",
  "walkable": true,
  "tileset": "grass"
}
```

#### Regions
Array of rectangular areas that override the default tile:
```json
"regions": [
  {
    "name": "North Wall",
    "type": "WALL",
    "walkable": false,
    "tileset": "stone",
    "area": {
      "x": 0,
      "y": 0,
      "width": 50,
      "height": 3
    }
  }
]
```

**Tile Types:**
- `GRASS` - Walkable grass terrain
- `WALL` - Non-walkable stone walls
- `WATER` - Non-walkable water
- `FLOOR` - Walkable floor tiles

**Tileset Values:**
- `grass` - Uses the grass tileset
- `stone` - Uses the stone tileset

### Monster Spawns
Defines where monsters should spawn:
```json
"monsterSpawns": [
  {
    "monsterId": "slime",
    "position": { "x": 15, "y": 20 },
    "respawnTime": 30000
  }
]
```
- `monsterId`: References a monster from `databases/monsters.json`
- `position`: Spawn coordinates
- `respawnTime`: Time in milliseconds before respawn

### Item Spawns
Defines where items should spawn:
```json
"itemSpawns": [
  {
    "itemId": "health_potion",
    "position": { "x": 10, "y": 25 },
    "respawnTime": 60000
  }
]
```

### Metadata
Additional map information:
```json
"metadata": {
  "difficulty": "easy",
  "recommendedLevel": 1,
  "maxPlayers": 20,
  "theme": "grassland",
  "music": "peaceful_meadow",
  "ambientSound": "birds_chirping"
}
```

## Map Coordinate System
- Origin (0, 0) is at the **top-left** corner
- X increases to the **right**
- Y increases **downward**
- All coordinates are in tile units (not pixels)

## Creating a New Map

### 1. Design the Layout
Plan your map on paper or in a spreadsheet:
- Decide on dimensions (width × height)
- Mark walkable vs non-walkable areas
- Place spawn points, monsters, and items

### 2. Create the JSON File
```bash
# Create a new map file
touch databases/maps/02_forest_clearing.json
```

### 3. Define the Structure
Start with the template:
```json
{
  "id": "02_forest_clearing",
  "name": "Forest Clearing",
  "width": 40,
  "height": 40,
  "description": "A small clearing in the forest.",
  "spawnPoints": [
    { "x": 20, "y": 20, "type": "player" }
  ],
  "tiles": {
    "default": {
      "type": "GRASS",
      "walkable": true,
      "tileset": "grass"
    },
    "regions": []
  },
  "monsterSpawns": [],
  "itemSpawns": [],
  "metadata": {
    "difficulty": "medium",
    "recommendedLevel": 5,
    "maxPlayers": 10,
    "theme": "forest"
  }
}
```

### 4. Add Regions
Define non-walkable areas:
```json
"regions": [
  {
    "name": "Tree Line",
    "type": "WALL",
    "walkable": false,
    "tileset": "stone",
    "area": { "x": 0, "y": 0, "width": 40, "height": 2 }
  }
]
```

### 5. Add Spawns
Place monsters and items strategically.

## Example Maps

### 01_starting_zone.json
- **Size**: 50×50
- **Features**:
  - Stone walls around perimeter
  - Central pond (6×6)
  - Rock formations in corners
  - 5 player spawn points
  - 4 slime monster spawns
  - 2 health potion spawns
- **Difficulty**: Easy
- **Recommended Level**: 1

## Server Integration

The server should:
1. Load map files from `databases/maps/`
2. Parse the JSON structure
3. Generate the tile grid based on default + regions
4. Spawn monsters and items at defined positions
5. Use spawn points for player initialization

## Future Enhancements
- [ ] Support for multiple layers (ground, decorations, overhead)
- [ ] Animated tiles
- [ ] Tile rotation and flipping
- [ ] Trigger zones (events, teleports)
- [ ] Dynamic weather/time-of-day effects
- [ ] Procedurally generated regions
- [ ] Map transitions and portals
