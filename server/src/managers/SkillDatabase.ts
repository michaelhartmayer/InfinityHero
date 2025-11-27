import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface SkillTemplate {
    id: string;
    name: string;
    description: string;
    range: number;
    icon: string;
    target: 'target' | 'self' | 'passive';
}

export class SkillDatabase {
    private templates: Map<string, SkillTemplate> = new Map();

    constructor() {
        this.loadDatabase();
    }

    private loadDatabase() {
        try {
            const dbPath = path.join(__dirname, '../../../databases/skills.json');
            const data = fs.readFileSync(dbPath, 'utf-8');
            const parsed = JSON.parse(data);

            for (const skill of parsed.skills) {
                this.templates.set(skill.id, skill);
            }

            console.log(`Loaded ${this.templates.size} skill templates from database`);
        } catch (error) {
            console.error('Failed to load skill database:', error);
        }
    }

    public getTemplate(id: string): SkillTemplate | undefined {
        return this.templates.get(id);
    }

    public getAllTemplates(): SkillTemplate[] {
        return Array.from(this.templates.values());
    }
}
