import { Router } from 'express';
import { ClassDatabase } from '../../managers/ClassDatabase.js';

export const createClassRoutes = (classDatabase: ClassDatabase) => {
    const router = Router();

    router.get('/', (req, res) => {
        classDatabase.reload();
        res.json(classDatabase.getAllTemplates());
    });

    router.post('/', (req, res) => {
        const template = req.body;
        classDatabase.updateTemplate(template);
        res.json({ success: true });
    });

    router.delete('/:id', (req, res) => {
        const { id } = req.params;
        classDatabase.deleteTemplate(id);
        res.json({ success: true });
    });

    return router;
};
