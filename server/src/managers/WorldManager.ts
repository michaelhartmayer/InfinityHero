import { WorldMap, Tile, TileType, CONSTANTS } from '@vibemaster/shared';

export class WorldManager {
    private map: WorldMap;

    constructor() {
        this.map = this.generateMap();
    }

    private generateMap(): WorldMap {
        const width = CONSTANTS.MAP_WIDTH;
        const height = CONSTANTS.MAP_HEIGHT;
        const tiles: Tile[][] = [];

        for (let x = 0; x < width; x++) {
            tiles[x] = [];
            for (let y = 0; y < height; y++) {
                // Simple generation: Borders are walls, rest is grass
                let type = TileType.GRASS;
                let walkable = true;

                if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
                    type = TileType.WALL;
                    walkable = false;
                } else {
                    // Random obstacles
                    if (Math.random() < 0.1) {
                        type = TileType.WALL;
                        walkable = false;
                    }
                }

                tiles[x][y] = {
                    x,
                    y,
                    type,
                    walkable
                };
            }
        }

        return {
            width,
            height,
            tiles
        };
    }

    public getMap(): WorldMap {
        return this.map;
    }

    public isWalkable(x: number, y: number, obstacles?: Set<string>): boolean {
        const rx = Math.round(x);
        const ry = Math.round(y);
        if (rx < 0 || rx >= this.map.width || ry < 0 || ry >= this.map.height) {
            return false;
        }
        const tile = this.map.tiles[rx][ry];
        if (tile.type === TileType.WALL || tile.type === TileType.WATER) return false;

        if (obstacles && obstacles.has(`${rx},${ry}`)) {
            return false;
        }
        return true;
    }

    public findPath(startX: number, startY: number, endX: number, endY: number, obstacles?: Set<string>): { x: number, y: number }[] {
        const rEndX = Math.round(endX);
        const rEndY = Math.round(endY);

        // Simple BFS for pathfinding
        if (!this.isWalkable(rEndX, rEndY, obstacles)) return [];

        const startNode = { x: Math.round(startX), y: Math.round(startY), parent: null as any };
        const queue = [startNode];
        const visited = new Set<string>();
        visited.add(`${startNode.x},${startNode.y}`);

        let foundNode = null;
        let iterations = 0;

        while (queue.length > 0 && iterations < 1000) {
            iterations++;
            const current = queue.shift()!;

            if (current.x === rEndX && current.y === rEndY) {
                foundNode = current;
                break;
            }

            const neighbors = [
                { x: current.x + 1, y: current.y },
                { x: current.x - 1, y: current.y },
                { x: current.x, y: current.y + 1 },
                { x: current.x, y: current.y - 1 },
                // Diagonals
                { x: current.x + 1, y: current.y + 1 },
                { x: current.x - 1, y: current.y - 1 },
                { x: current.x + 1, y: current.y - 1 },
                { x: current.x - 1, y: current.y + 1 }
            ];

            for (const neighbor of neighbors) {
                const key = `${neighbor.x},${neighbor.y}`;

                // Check bounds and walkability
                if (!visited.has(key) && this.isWalkable(neighbor.x, neighbor.y, obstacles)) {
                    // Prevent corner cutting for diagonals
                    // If moving diagonally, check if the two adjacent cardinal tiles are walkable
                    const dx = neighbor.x - current.x;
                    const dy = neighbor.y - current.y;

                    if (Math.abs(dx) === 1 && Math.abs(dy) === 1) {
                        if (!this.isWalkable(current.x + dx, current.y, obstacles) || !this.isWalkable(current.x, current.y + dy, obstacles)) {
                            continue; // Corner is blocked
                        }
                    }

                    visited.add(key);
                    queue.push({ x: neighbor.x, y: neighbor.y, parent: current });
                }
            }
        }

        if (foundNode) {
            const path = [];
            let curr = foundNode;
            while (curr.parent) {
                path.unshift({ x: curr.x, y: curr.y });
                curr = curr.parent;
            }
            return path;
        }

        return [];
    }
}
