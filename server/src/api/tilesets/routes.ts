import { Router } from 'express';
import fs from 'fs';
import path from 'path';

export const createTilesetRoutes = () => {
    const router = Router();
    const TILESETS_DIR = path.join(process.cwd(), '../client/public/assets/tilesets');

    router.get('/', (req, res) => {
        try {
            if (!fs.existsSync(TILESETS_DIR)) {
                return res.json([]);
            }
            const files = fs.readdirSync(TILESETS_DIR);
            const tilesets = files
                .filter(f => f.endsWith('.json'))
                .map(f => f.replace('.json', ''));
            res.json(tilesets);
        } catch (error) {
            console.error('Error listing tilesets:', error);
            res.status(500).json({ error: 'Failed to list tilesets' });
        }
    });

    router.get('/:name', (req, res) => {
        try {
            const { name } = req.params;
            const filePath = path.join(TILESETS_DIR, `${name}.json`);
            if (!fs.existsSync(filePath)) {
                return res.status(404).json({ error: 'Tileset not found' });
            }
            const content = fs.readFileSync(filePath, 'utf-8');
            res.json(JSON.parse(content));
        } catch (error) {
            console.error('Error reading tileset:', error);
            res.status(500).json({ error: 'Failed to read tileset' });
        }
    });

    router.post('/:name', (req, res) => {
        try {
            const { name } = req.params;
            const filePath = path.join(TILESETS_DIR, `${name}.json`);
            // Basic validation
            JSON.parse(JSON.stringify(req.body)); // Ensure valid JSON
            fs.writeFileSync(filePath, JSON.stringify(req.body, null, 2));
            res.json({ success: true });
        } catch (error) {
            console.error('Error saving tileset:', error);
            res.status(500).json({ error: 'Failed to save tileset' });
        }
    });

    return router;
};
