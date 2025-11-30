import { Router } from 'express';
import { EffectDatabase } from '../../managers/EffectDatabase.js';

export const createEffectRoutes = (effectDatabase: EffectDatabase) => {
    const router = Router();

    router.get('/', (req, res) => {
        res.json(effectDatabase.getAllTemplates());
    });

    router.post('/', (req, res) => {
        const template = req.body;
        effectDatabase.updateTemplate(template);
        res.json({ success: true });
    });

    router.delete('/:id', (req, res) => {
        const { id } = req.params;
        effectDatabase.deleteTemplate(id);
        res.json({ success: true });
    });

    return router;
};
