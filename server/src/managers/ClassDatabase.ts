import fs from 'fs';
import path from 'path';

export interface ClassTemplate {
    id: string;
    name: string;
    description: string;
    icon: string;
    baseHp: number;
    baseEnergy: number;
    startingSkills: string[];
}

export class ClassDatabase {
    private templates: Map<string, ClassTemplate> = new Map();
    private readonly DB_PATH = path.join(process.cwd(), '../databases/classes.json');

    constructor() {
        this.loadTemplates();
    }

    private loadTemplates() {
        try {
            if (!fs.existsSync(this.DB_PATH)) {
                // Create default file if it doesn't exist
                this.saveToDisk();
                return;
            }

            const data = fs.readFileSync(this.DB_PATH, 'utf-8');
            const json = JSON.parse(data);

            if (json.classes && Array.isArray(json.classes)) {
                for (const template of json.classes) {
                    this.templates.set(template.id, template);
                }
            }
            console.log(`Loaded ${this.templates.size} class templates`);
        } catch (error) {
            console.error('Error loading class templates:', error);
        }
    }

    private saveToDisk() {
        try {
            const data = {
                classes: Array.from(this.templates.values())
            };
            fs.writeFileSync(this.DB_PATH, JSON.stringify(data, null, 4));
        } catch (error) {
            console.error('Error saving class templates:', error);
        }
    }

    public getAllTemplates(): ClassTemplate[] {
        return Array.from(this.templates.values());
    }

    public getTemplate(id: string): ClassTemplate | undefined {
        return this.templates.get(id);
    }

    public updateTemplate(template: ClassTemplate) {
        this.templates.set(template.id, template);
        this.saveToDisk();
    }

    public deleteTemplate(id: string) {
        this.templates.delete(id);
        this.saveToDisk();
    }
}
