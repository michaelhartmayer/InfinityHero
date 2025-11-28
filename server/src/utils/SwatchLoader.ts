import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface SwatchTile {
    x: number;
    y: number;
}

export interface Swatch {
    id: string;
    name: string;
    tileset: string;
    gridSize: number;
    color?: number;
    properties: {
        walkable: boolean;
    };
    tiles: SwatchTile[];
}

export interface SwatchSet {
    id: string;
    name: string;
    swatches: Swatch[];
}

export class SwatchLoader {
    private static swatchesCache: Map<string, Swatch> = new Map();
    private static loaded = false;

    static loadSwatches(): void {
        const swatchesPath = path.join(__dirname, '..', '..', '..', 'databases', 'swatches.json');

        if (!fs.existsSync(swatchesPath)) {
            console.warn('Swatches file not found:', swatchesPath);
            return;
        }

        try {
            const content = fs.readFileSync(swatchesPath, 'utf-8');
            const swatchSets: SwatchSet[] = JSON.parse(content);

            this.swatchesCache.clear();
            for (const set of swatchSets) {
                for (const swatch of set.swatches) {
                    this.swatchesCache.set(swatch.id, swatch);
                }
            }
            this.loaded = true;
            console.log(`🎨 Loaded ${this.swatchesCache.size} swatches`);
        } catch (error) {
            console.error('Failed to load swatches:', error);
        }
    }

    static getSwatch(id: string): Swatch | undefined {
        if (!this.loaded) {
            this.loadSwatches();
        }
        return this.swatchesCache.get(id);
    }
}
