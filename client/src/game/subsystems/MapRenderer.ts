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
        try {
            // Fetch list of available tilesets
            const res = await fetch('/api/tilesets');
            const tilesetIds: string[] = await res.json();

            console.log('📦 Loading tilesets:', tilesetIds);

            await Promise.all(tilesetIds.map(async (id) => {
                try {
                    // Fetch metadata to get texture filename
                    const metaRes = await fetch(`/api/tilesets/${id}`);
                    const meta = await metaRes.json();

                    await this.tilesetLoader.loadTileset(
                        id,
                        `/assets/tilesets/${id}.json`,
                        `/assets/tilesets/${meta.texture}`
                    );
                } catch (err) {
                    console.error(`Failed to load tileset ${id}:`, err);
                }
            }));

        } catch (e) {
            console.error("Failed to load tileset list:", e);
            // Fallback for dev/offline
            await Promise.all([
                this.tilesetLoader.loadTileset(
                    'dev-tileset-grass',
                    '/assets/tilesets/dev-tileset-grass.json',
                    '/assets/tilesets/dev-tileset-grass.png'
                ),
                this.tilesetLoader.loadTileset(
                    'dev-tileset-stone',
                    '/assets/tilesets/dev-tileset-stone.json',
                    '/assets/tilesets/dev-tileset-stone.png'
                )
            ]);
        }
    }

    public renderMap(map: WorldMap) {
        this.currentMapData = map;
        this.group.clear();

        console.log('🎨 Rendering map with dynamic tilesets');

        const offsetX = map.width / 2;
        const offsetY = map.height / 2;

        for (let x = 0; x < map.width; x++) {
            for (let y = 0; y < map.height; y++) {
                const tile = map.tiles[x][y];

                let texture: THREE.Texture | undefined;
                let tilesetName: string | undefined;
                let uvs: number[] | null = null;

                // 1. Try to get texture from tile.tileset
                if (tile.tileset) {
                    texture = this.tilesetLoader.getTexture(tile.tileset);
                    tilesetName = tile.tileset;

                    // Legacy Fallback: 'grass' -> 'dev-tileset-grass'
                    if (!texture) {
                        if (tile.tileset === 'grass' || tile.tileset.includes('grass')) {
                            tilesetName = 'dev-tileset-grass';
                            texture = this.tilesetLoader.getTexture(tilesetName);
                        } else if (tile.tileset === 'stone' || tile.tileset.includes('stone')) {
                            tilesetName = 'dev-tileset-stone';
                            texture = this.tilesetLoader.getTexture(tilesetName);
                        }
                    }
                }

                // 2. Calculate UVs if we have a texture and coords
                if (texture && tile.textureCoords && tilesetName) {
                    if (texture.image) {
                        const texWidth = (texture.image as HTMLImageElement).width;
                        const texHeight = (texture.image as HTMLImageElement).height;
                        const tX = tile.textureCoords.x;
                        const tY = tile.textureCoords.y;

                        let tileSize = tile.tileSize || 32;
                        // Legacy hack for stone tileset size if needed, though ideally this should be in tileset data
                        if (!tile.tileSize && tilesetName.includes('stone')) tileSize = 256;

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
                    // 3. Fallback / Default Tile Logic
                    // If no explicit tileset/coords, or texture not found, use defaults based on type
                    if (!tilesetName || !texture) {
                        switch (tile.type) {
                            case TileType.WALL:
                            case TileType.WATER:
                                tilesetName = 'dev-tileset-stone';
                                break;
                            default:
                                tilesetName = 'dev-tileset-grass';
                        }
                        texture = this.tilesetLoader.getTexture(tilesetName);
                    }

                    if (tilesetName && texture) {
                        const randomTile = this.tilesetLoader.getRandomTile(tilesetName);
                        if (randomTile) {
                            uvs = this.tilesetLoader.getTileUVs(tilesetName, randomTile.id) || null;
                        }
                    }
                }

                if (!uvs || !texture) continue;

                const geometry = new THREE.PlaneGeometry(1, 1);
                const uvAttribute = new THREE.Float32BufferAttribute(uvs, 2);
                geometry.setAttribute('uv', uvAttribute);

                const material = new THREE.MeshStandardMaterial({
                    map: texture,
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
