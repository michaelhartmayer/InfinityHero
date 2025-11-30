import { Router } from 'express';
import { MonsterDatabase } from '../../managers/MonsterDatabase.js';
import { EntityManager } from '../../managers/EntityManager.js';

export const createMonsterRoutes = (monsterDatabase: MonsterDatabase, entityManager: EntityManager) => {
    const router = Router();

    router.get('/', (req, res) => {
        res.json(monsterDatabase.getAllTemplates());
    });

    router.post('/', (req, res) => {
        const template = req.body;
        monsterDatabase.updateTemplate(template);
        entityManager.updateActiveMonsters(template);
        res.json({ success: true });
    });

    router.delete('/:id', (req, res) => {
        const { id } = req.params;
        monsterDatabase.deleteTemplate(id);
        res.json({ success: true });
    });

    return router;
};
