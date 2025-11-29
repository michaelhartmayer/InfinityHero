import fs from 'fs';
import path from 'path';

export interface EffectLayer {
    id: string;
    name: string;
    type: 'points' | 'line' | 'mesh';
    geometryType: 'box' | 'sphere' | 'ring';
    vertexShader: string;
    fragmentShader: string;
    count: number;
    blending: string;
    attributeConfig?: {
        sizeStart: number;
        sizeEnd: number;
        kindPattern?: string;
    };
}

export interface EffectUniform {
    name: string;
    type: 'float' | 'vec2' | 'vec3' | 'color';
    value: any;
    min?: number;
    max?: number;
}

export interface EffectTemplate {
    id: string;
    name: string;
    layers: EffectLayer[];
    uniforms: EffectUniform[];
}

export class EffectDatabase {
    private templates: Map<string, EffectTemplate> = new Map();
    private dbPath: string;

    constructor() {
        this.dbPath = path.join(process.cwd(), '../databases/effects.json');
        this.load();

        // Watch for external changes (e.g. manual edits or git pulls)
        try {
            fs.watch(this.dbPath, (eventType) => {
                if (eventType === 'change') {
                    console.log('Effects database changed, reloading...');
                    this.load();
                }
            });
        } catch (err) {
            console.error('Failed to setup file watcher for effects:', err);
        }
    }

    private load() {
        try {
            if (fs.existsSync(this.dbPath)) {
                const data = fs.readFileSync(this.dbPath, 'utf-8');
                const templates: EffectTemplate[] = JSON.parse(data);
                templates.forEach(t => this.templates.set(t.id, t));
                console.log(`Loaded ${this.templates.size} effects.`);
            } else {
                console.log('No effects database found, starting empty.');
                this.save();
            }
        } catch (error) {
            console.error('Failed to load effects database:', error);
        }
    }

    private save() {
        try {
            const data = Array.from(this.templates.values());
            fs.writeFileSync(this.dbPath, JSON.stringify(data, null, 4));
        } catch (error) {
            console.error('Failed to save effects database:', error);
        }
    }

    public getAllTemplates(): EffectTemplate[] {
        return Array.from(this.templates.values());
    }

    public getTemplate(id: string): EffectTemplate | undefined {
        return this.templates.get(id);
    }

    public updateTemplate(template: EffectTemplate) {
        this.templates.set(template.id, template);
        this.save();
    }

    public deleteTemplate(id: string) {
        this.templates.delete(id);
        this.save();
    }
}
