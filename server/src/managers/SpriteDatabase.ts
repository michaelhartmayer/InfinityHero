import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface SpriteTemplate {
    id: string;
    name: string;
    type: 'character' | 'prop' | 'effect' | 'ui';
    texture: string;
    frameWidth: number;
    frameHeight: number;
    animations: Record<string, {
        frames: number[];
        frameRate: number;
        loop: boolean;
    }>;
}

export class SpriteDatabase {
    private templates: Map<string, SpriteTemplate> = new Map();

    constructor() {
        this.loadDatabase();
    }

    private loadDatabase() {
        try {
            const dbPath = path.join(__dirname, '../../../databases/sprites.json');
            if (!fs.existsSync(dbPath)) {
                console.log('No sprite database found, starting empty.');
                return;
            }
            const data = fs.readFileSync(dbPath, 'utf-8');
            const parsed = JSON.parse(data);

            for (const sprite of parsed.sprites) {
                this.templates.set(sprite.id, sprite);
            }

            console.log(`Loaded ${this.templates.size} sprite templates from database`);
        } catch (error) {
            console.error('Failed to load sprite database:', error);
        }
    }

    public getTemplate(id: string): SpriteTemplate | undefined {
        return this.templates.get(id);
    }

    public getAllTemplates(): SpriteTemplate[] {
        return Array.from(this.templates.values());
    }

    public updateTemplate(template: SpriteTemplate) {
        this.templates.set(template.id, template);
        this.saveDatabase();
    }

    public deleteTemplate(id: string) {
        this.templates.delete(id);
        this.saveDatabase();
    }

    private saveDatabase() {
        try {
            const dbPath = path.join(__dirname, '../../../databases/sprites.json');
            const data = {
                sprites: Array.from(this.templates.values())
            };
            fs.writeFileSync(dbPath, JSON.stringify(data, null, 4));
            console.log('Saved sprite database');
        } catch (error) {
            console.error('Failed to save sprite database:', error);
        }
    }
}
