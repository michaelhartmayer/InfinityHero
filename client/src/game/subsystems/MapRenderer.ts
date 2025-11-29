import * as THREE from 'three';
import { type WorldMap, TileType } from '@vibemaster/shared';
import { TilesetLoader } from '../TilesetLoader';

export class MapRenderer {
    public group: THREE.Group;
    private tilesetLoader: TilesetLoader;
    private currentMapData: WorldMap | null = null;

    constructor() {
        this.group = new THREE.Group();
        this.tilesetLoader = new TilesetLoader();
    }

    public async loadAssets() {
        await Promise.all([
            this.tilesetLoader.loadTileset(
                'grass',
                '/assets/tilesets/dev-tileset-grass.json',
                '/assets/tilesets/dev-tileset-grass.png'
            ),
            this.tilesetLoader.loadTileset(
                'stone',
                '/assets/tilesets/dev-tileset-stone.json',
                '/assets/tilesets/dev-tileset-stone.png'
            )
        ]);
    }

    public renderMap(map: WorldMap) {
        this.currentMapData = map;
        this.group.clear();

        const grassTexture = this.tilesetLoader.getTexture('grass');
        const stoneTexture = this.tilesetLoader.getTexture('stone');

        if (!grassTexture || !stoneTexture) {
            console.log('⏳ Tilesets loading, using fallback colors...');
            this.renderMapFallback(map);
            return;
        }

        console.log('🎨 Rendering map with textured tilesets');

        const offsetX = map.width / 2;
        const offsetY = map.height / 2;

        for (let x = 0; x < map.width; x++) {
            for (let y = 0; y < map.height; y++) {
                const tile = map.tiles[x][y];

                let texture: THREE.Texture;
                let tilesetName: string;
                let uvs: number[] | null = null;

                if (tile.tileset && tile.textureCoords) {
                    if (tile.tileset.includes('grass')) {
                        texture = grassTexture;
                        tilesetName = 'grass';
                    } else if (tile.tileset.includes('stone')) {
                        texture = stoneTexture;
                        tilesetName = 'stone';
                    } else {
                        texture = grassTexture;
                        tilesetName = 'grass';
                    }

                    if (texture.image) {
                        const texWidth = (texture.image as HTMLImageElement).width;
                        const texHeight = (texture.image as HTMLImageElement).height;
                        const tX = tile.textureCoords.x;
                        const tY = tile.textureCoords.y;

                        let tileSize = tile.tileSize || 32;
                        if (!tile.tileSize && tilesetName === 'stone') tileSize = 256;

                        const u0 = tX / texWidth;
                        const v1 = 1 - (tY / texHeight);
                        const u1 = (tX + tileSize) / texWidth;
                        const v0 = 1 - ((tY + tileSize) / texHeight);

                        uvs = [
                            u0, v1, // Top Left
                            u1, v1, // Top Right
                            u0, v0, // Bottom Left
                            u1, v0  // Bottom Right
                        ];
                    }

                } else {
                    switch (tile.type) {
                        case TileType.GRASS:
                        case TileType.FLOOR:
                            texture = grassTexture;
                            tilesetName = 'grass';
                            break;
                        case TileType.WALL:
                        case TileType.WATER:
                            texture = stoneTexture;
                            tilesetName = 'stone';
                            break;
                        default:
                            texture = grassTexture;
                            tilesetName = 'grass';
                    }

                    const randomTile = this.tilesetLoader.getRandomTile(tilesetName);
                    if (randomTile) {
                        uvs = this.tilesetLoader.getTileUVs(tilesetName, randomTile.id) || null;
                    }
                }

                if (!uvs) continue;

                const geometry = new THREE.PlaneGeometry(1, 1);
                const uvAttribute = new THREE.Float32BufferAttribute(uvs, 2);
                geometry.setAttribute('uv', uvAttribute);

                const material = new THREE.MeshStandardMaterial({
                    map: texture!,
                    side: THREE.FrontSide,
                    transparent: true,
                    alphaTest: 0.5,
                    color: tile.color !== undefined ? tile.color : 0xffffff
                });

                const mesh = new THREE.Mesh(geometry, material);
                // Invert Y axis: map[0][0] should be at top-left
                mesh.position.set(x - offsetX, (map.height - 1 - y) - offsetY, 0);
                this.group.add(mesh);
            }
        }
    }

    private renderMapFallback(map: WorldMap) {
        const geometry = new THREE.PlaneGeometry(1, 1);
        const materials = {
            [TileType.GRASS]: new THREE.MeshStandardMaterial({ color: 0x4caf50 }),
            [TileType.WALL]: new THREE.MeshStandardMaterial({ color: 0x607d8b }),
            [TileType.WATER]: new THREE.MeshStandardMaterial({ color: 0x2196f3 }),
            [TileType.FLOOR]: new THREE.MeshStandardMaterial({ color: 0x795548 }),
        };

        const offsetX = map.width / 2;
        const offsetY = map.height / 2;

        for (let x = 0; x < map.width; x++) {
            for (let y = 0; y < map.height; y++) {
                const tile = map.tiles[x][y];
                const mesh = new THREE.Mesh(geometry, materials[tile.type]);
                // Invert Y axis
                mesh.position.set(x - offsetX, (map.height - 1 - y) - offsetY, 0);
                this.group.add(mesh);
            }
        }
    }

    public getTilesetLoader(): TilesetLoader {
        return this.tilesetLoader;
    }

    public reRender() {
        if (this.currentMapData) {
            console.log('🔄 Re-rendering map with loaded assets');
            this.renderMap(this.currentMapData);
        }
    }
}
