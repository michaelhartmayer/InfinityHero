import { Server } from 'socket.io';
import { EntityManager } from '../managers/EntityManager.js';
import { SkillDatabase } from '../managers/SkillDatabase.js';
import { EVENTS } from '@vibemaster/shared';

export class CombatSystem {
    private io: Server;
    private entityManager: EntityManager;
    private skillDatabase: SkillDatabase;

    constructor(io: Server, entityManager: EntityManager, skillDatabase: SkillDatabase) {
        this.io = io;
        this.entityManager = entityManager;
        this.skillDatabase = skillDatabase;
    }

    public performAttack(attackerId: string, targetId: string, skillId?: string) {
        const attacker = this.entityManager.getPlayer(attackerId) || this.entityManager.getMonster(attackerId);
        const target = this.entityManager.getPlayer(targetId) || this.entityManager.getMonster(targetId);

        if (!attacker || !target) return;

        // TODO: Calculate damage based on stats/skill
        let damage = 10;

        if (attacker.type === 'monster') {
            damage = Math.floor(attacker.level * 5);
        }

        const isDead = this.entityManager.applyDamage(targetId, damage, attackerId);

        this.io.emit(EVENTS.ATTACK, {
            attackerId,
            targetId,
            damage
        });

        if (isDead) {
            this.io.emit(EVENTS.PLAYER_DEATH, { playerId: targetId });
            if (target.type === 'player') {
                this.entityManager.respawnPlayer(targetId);
                // Reset monster aggro if they killed the player
                if (attacker.type === 'monster') {
                    attacker.strategy = 'passive' as any; // Using cast to avoid import issues if enum not available
                    attacker.targetId = null;
                }
            } else {
                this.entityManager.removeMonster(targetId);
                // Clear target from attacker if they killed the monster
                if (attacker.type === 'player') {
                    // attacker.pendingAttack = null; // Removed as property does not exist
                }
            }
        }
    }
}
