import { Router } from 'express';
import { SpriteDatabase } from '../../managers/SpriteDatabase.js';
import fs from 'fs';
import path from 'path';

export const createSpriteRoutes = (spriteDatabase: SpriteDatabase) => {
    const router = Router();

    router.get('/', (req, res) => {
        res.json(spriteDatabase.getAllTemplates());
    });

    router.post('/', (req, res) => {
        const template = req.body;
        spriteDatabase.updateTemplate(template);
        res.json({ success: true });
    });

    router.delete('/:id', (req, res) => {
        const { id } = req.params;
        spriteDatabase.deleteTemplate(id);
        res.json({ success: true });
    });

    return router;
};

export const createSpriteTextureRoutes = () => {
    const router = Router();

    router.get('/', (req, res) => {
        try {
            const spritesDir = path.join(process.cwd(), '../client/public/assets/sprites');
            if (!fs.existsSync(spritesDir)) {
                return res.json([]);
            }
            const files = fs.readdirSync(spritesDir);
            const textures = files.filter(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.gif'));
            res.json(textures);
        } catch (error) {
            console.error('Error listing sprite textures:', error);
            res.status(500).json({ error: 'Failed to list sprite textures' });
        }
    });

    return router;
};
