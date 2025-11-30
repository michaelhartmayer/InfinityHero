import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { SwatchLoader } from '../../utils/SwatchLoader.js';

export const createSwatchRoutes = () => {
    const router = Router();
    const SWATCHES_FILE = path.join(process.cwd(), '../databases/swatches.json');

    router.get('/', (req, res) => {
        try {
            if (!fs.existsSync(SWATCHES_FILE)) {
                return res.json([]);
            }
            const content = fs.readFileSync(SWATCHES_FILE, 'utf-8');
            res.json(JSON.parse(content));
        } catch (error) {
            console.error('Error reading swatches:', error);
            res.status(500).json({ error: 'Failed to read swatches' });
        }
    });

    router.post('/', (req, res) => {
        try {
            const swatches = req.body;
            fs.writeFileSync(SWATCHES_FILE, JSON.stringify(swatches, null, 4));
            SwatchLoader.loadSwatches();
            res.json({ success: true });
        } catch (error) {
            console.error('Error saving swatches:', error);
            res.status(500).json({ error: 'Failed to save swatches' });
        }
    });

    return router;
};
