import { Router } from 'express';
import { SkillDatabase } from '../../managers/SkillDatabase.js';

export const createSkillRoutes = (skillDatabase: SkillDatabase) => {
    const router = Router();

    router.get('/', (req, res) => {
        res.json(skillDatabase.getAllTemplates());
    });

    router.post('/', (req, res) => {
        const template = req.body;
        skillDatabase.updateTemplate(template);
        res.json({ success: true });
    });

    router.delete('/:id', (req, res) => {
        const { id } = req.params;
        skillDatabase.deleteTemplate(id);
        res.json({ success: true });
    });

    return router;
};
