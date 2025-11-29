import { EVENTS, CONSTANTS, MonsterStrategyType, Monster, Player, Entity } from '@vibemaster/shared';
import { Server } from 'socket.io';
import { EntityManager } from './managers/EntityManager.js';
import { WorldManager } from './managers/WorldManager.js';

export class GameLoop {
    private io: Server;
    private entityManager: EntityManager;
    private worldManager: WorldManager;
    private interval: NodeJS.Timeout | null = null;

    constructor(io: Server, entityManager: EntityManager, worldManager: WorldManager) {
        this.io = io;
        this.entityManager = entityManager;
        this.worldManager = worldManager;
    }

    public start() {
        const tickMs = 1000 / CONSTANTS.TICK_RATE;
        this.interval = setInterval(() => {
            this.update();
        }, tickMs);
    }

    public stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    private update() {
        this.updatePlayers();
        this.updateMonsters();

        // Broadcast state
        const state = {
            players: this.entityManager.getAllPlayers(),
            items: this.entityManager.getAllItems(),
            monsters: this.entityManager.getAllMonsters()
        };

        this.io.emit(EVENTS.STATE_UPDATE, state);
    }

    private updatePlayers() {
        const players = this.entityManager.getAllPlayers();

        for (const player of Object.values(players)) {
            const obstacles = this.entityManager.getOccupiedPositions(player.id);
            this.handleEntityMovement(player, obstacles);
            this.entityManager.checkItemPickup(player.id);
        }
    }

    private updateMonsters() {
        const monsters = this.entityManager.getAllMonsters();
        const now = Date.now();

        for (const monster of Object.values(monsters)) {
            const obstacles = this.entityManager.getOccupiedPositions(monster.id);
            this.handleEntityMovement(monster, obstacles);

            switch (monster.strategy) {
                case MonsterStrategyType.PASSIVE:
                    // Move every 6-12 seconds
                    if (now - monster.lastActionTime > 6000 + Math.random() * 6000) {
                        // Pick a random nearby point
                        const range = 5;
                        const targetX = Math.max(1, Math.min(CONSTANTS.MAP_WIDTH - 2, Math.round(monster.position.x + (Math.random() * range * 2 - range))));
                        const targetY = Math.max(1, Math.min(CONSTANTS.MAP_HEIGHT - 2, Math.round(monster.position.y + (Math.random() * range * 2 - range))));

                        const obstacles = this.entityManager.getOccupiedPositions(monster.id);
                        const path = this.worldManager.findPath(monster.position.x, monster.position.y, targetX, targetY, obstacles);
                        if (path.length > 0) {
                            monster.movePath = path;
                            monster.moveTarget = path[0];
                        }
                        monster.lastActionTime = now;
                    }
                    break;

                case MonsterStrategyType.SLEEPING:
                    // Do nothing
                    break;

                case MonsterStrategyType.AGGRESSIVE:
                    if (monster.targetId) {
                        const targetPlayer = this.entityManager.getPlayer(monster.targetId);
                        if (targetPlayer) {
                            // Re-calculate path to player every 1 second or if no path
                            if (now - monster.lastActionTime > 1000 || !monster.moveTarget) {
                                const obstacles = this.entityManager.getOccupiedPositions(monster.id);
                                const path = this.worldManager.findPath(
                                    monster.position.x,
                                    monster.position.y,
                                    targetPlayer.position.x,
                                    targetPlayer.position.y,
                                    obstacles
                                );
                                if (path.length > 0) {
                                    monster.movePath = path;
                                    monster.moveTarget = path[0];
                                }
                                monster.lastActionTime = now;
                            }

                            // Check if close enough to attack
                            const dx = monster.position.x - targetPlayer.position.x;
                            const dy = monster.position.y - targetPlayer.position.y;
                            const dist = Math.sqrt(dx * dx + dy * dy);

                            if (dist < 1.5) {
                                // Attack!
                                if (!monster.lastAttackTime || now - monster.lastAttackTime > 2000) {
                                    const damage = Math.floor(monster.level * 5); // Simple damage formula
                                    const isDead = this.entityManager.applyDamage(targetPlayer.id, damage);

                                    this.io.emit(EVENTS.ATTACK, {
                                        attackerId: monster.id,
                                        targetId: targetPlayer.id,
                                        damage
                                    });

                                    monster.lastAttackTime = now;

                                    if (isDead) {
                                        this.io.emit(EVENTS.PLAYER_DEATH, { playerId: targetPlayer.id });
                                        this.entityManager.respawnPlayer(targetPlayer.id);
                                        // Reset monster aggro
                                        monster.strategy = MonsterStrategyType.PASSIVE;
                                        monster.targetId = null;
                                    }
                                }
                            }
                        } else {
                            // Target gone
                            monster.strategy = MonsterStrategyType.PASSIVE;
                            monster.targetId = null;
                        }
                    }
                    break;
            }
        }
    }

    private handleEntityMovement(entity: Player | Monster, obstacles?: Set<string>) {
        const deltaTime = 1 / CONSTANTS.TICK_RATE;
        const moveSpeed = entity.type === 'player' ? CONSTANTS.MOVE_SPEED : CONSTANTS.MOVE_SPEED * 0.5; // Monsters slower

        if (entity.moveTarget) {
            // Check if target is blocked (dynamic collision)
            if (obstacles && obstacles.has(`${entity.moveTarget.x},${entity.moveTarget.y}`)) {
                // Target is occupied, stop moving
                entity.moveTarget = null;
                entity.movePath = [];
                return;
            }

            const dx = entity.moveTarget.x - entity.position.x;
            const dy = entity.moveTarget.y - entity.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < 0.1) {
                // Reached current target node
                entity.position.x = entity.moveTarget.x;
                entity.position.y = entity.moveTarget.y;

                // Check if there are more nodes in the path
                if (entity.movePath && entity.movePath.length > 0) {
                    // Remove the node we just reached if it matches target
                    if (Math.abs(entity.movePath[0].x - entity.moveTarget.x) < 0.1 &&
                        Math.abs(entity.movePath[0].y - entity.moveTarget.y) < 0.1) {
                        entity.movePath.shift();
                    }

                    // Set next target
                    if (entity.movePath.length > 0) {
                        const nextNode = entity.movePath[0];
                        // Check collision for next node
                        if (obstacles && obstacles.has(`${nextNode.x},${nextNode.y}`)) {
                            // Blocked! Stop here.
                            entity.moveTarget = null;
                            entity.movePath = [];
                        } else {
                            entity.moveTarget = nextNode;
                        }
                    } else {
                        entity.moveTarget = null;
                    }
                } else {
                    entity.moveTarget = null;
                }
            } else {
                // Move toward target
                const moveDistance = Math.min(moveSpeed * deltaTime, distance);
                const normalizedX = dx / distance;
                const normalizedY = dy / distance;

                entity.position.x += normalizedX * moveDistance;
                entity.position.y += normalizedY * moveDistance;
            }
        }
    }
}
