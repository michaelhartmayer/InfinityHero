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
    sprite?: string;
}

export interface MonsterDatabase {
    monsters: MonsterTemplate[];
}

export class MonsterLoader {
    private static database: MonsterDatabase | null = null;
    private static monstersMap: Map<string, MonsterTemplate> = new Map();

    static loadDatabase(): void {
        if (this.database) return; // Already loaded

        const dbPath = path.join(__dirname, '..', '..', '..', 'databases', 'monsters.json');

        if (!fs.existsSync(dbPath)) {
            throw new Error('Monster database not found');
        }

        this.database = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

        // Build lookup map
        if (this.database) {
            for (const monster of this.database.monsters) {
                this.monstersMap.set(monster.id, monster);
            }
            console.log(`🐉 Loaded ${this.database.monsters.length} monster templates`);
        }
    }

    static getMonster(monsterId: string): MonsterTemplate | undefined {
        if (!this.database) {
            this.loadDatabase();
        }
        return this.monstersMap.get(monsterId);
    }

    static getAllMonsters(): MonsterTemplate[] {
        if (!this.database) {
            this.loadDatabase();
        }
        return [...this.database!.monsters];
    }

    static getMonstersByLevel(minLevel: number, maxLevel: number): MonsterTemplate[] {
        if (!this.database) {
            this.loadDatabase();
        }
        return this.database!.monsters.filter(
            m => m.baseLevel >= minLevel && m.baseLevel <= maxLevel
        );
    }
}
