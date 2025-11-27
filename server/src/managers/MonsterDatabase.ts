import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface MonsterTemplate {
    id: string;
    name: string;
    baseLevel: number;
    hp: number;
    energy: number;
    passiveStrategy: string;
    attackStrategy: string;
    fleeStrategy: string;
}

export class MonsterDatabase {
    private templates: Map<string, MonsterTemplate> = new Map();

    constructor() {
        this.loadDatabase();
    }

    private loadDatabase() {
        try {
            const dbPath = path.join(__dirname, '../../../databases/monsters.json');
            const data = fs.readFileSync(dbPath, 'utf-8');
            const parsed = JSON.parse(data);

            for (const monster of parsed.monsters) {
                this.templates.set(monster.id, monster);
            }

            console.log(`Loaded ${this.templates.size} monster templates from database`);
        } catch (error) {
            console.error('Failed to load monster database:', error);
        }
    }

    public getTemplate(id: string): MonsterTemplate | undefined {
        return this.templates.get(id);
    }

    public getAllTemplates(): MonsterTemplate[] {
        return Array.from(this.templates.values());
    }

    public getRandomTemplate(): MonsterTemplate | undefined {
        const templates = this.getAllTemplates();
        if (templates.length === 0) return undefined;
        return templates[Math.floor(Math.random() * templates.length)];
    }

    public getTemplatesByLevel(minLevel: number, maxLevel: number): MonsterTemplate[] {
        return this.getAllTemplates().filter(
            t => t.baseLevel >= minLevel && t.baseLevel <= maxLevel
        );
    }
    public updateTemplate(template: MonsterTemplate) {
        this.templates.set(template.id, template);
        this.saveDatabase();
    }

    public deleteTemplate(id: string) {
        this.templates.delete(id);
        this.saveDatabase();
    }

    private saveDatabase() {
        try {
            const dbPath = path.join(__dirname, '../../../databases/monsters.json');
            const data = {
                monsters: Array.from(this.templates.values())
            };
            fs.writeFileSync(dbPath, JSON.stringify(data, null, 4));
            console.log('Saved monster database');
        } catch (error) {
            console.error('Failed to save monster database:', error);
        }
    }
}
