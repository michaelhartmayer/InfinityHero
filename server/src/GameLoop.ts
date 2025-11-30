import { EVENTS, CONSTANTS, MonsterStrategyType, Monster, Player, Entity } from '@vibemaster/shared';
import { getXpForLevel } from './data/ExperienceTable.js';
import { Server } from 'socket.io';
import { EntityManager } from './managers/EntityManager.js';
import { SkillDatabase } from './managers/SkillDatabase.js';
import { WorldManager } from './managers/WorldManager.js';
import { ScriptEngine } from './managers/ScriptEngine.js';

export class GameLoop {
    private io: Server;
    private entityManager: EntityManager;
    private worldManager: WorldManager;
    private skillDatabase: SkillDatabase;
    private scriptEngine: ScriptEngine;
    private interval: NodeJS.Timeout | null = null;
    private lastUpdateTime: number = Date.now();

    constructor(io: Server, entityManager: EntityManager, worldManager: WorldManager, skillDatabase: SkillDatabase, scriptEngine: ScriptEngine) {
        this.io = io;
        this.entityManager = entityManager;
        this.worldManager = worldManager;
        this.skillDatabase = skillDatabase;
        this.scriptEngine = scriptEngine;
    }

    public start() {
        const tickMs = 1000 / CONSTANTS.TICK_RATE;
        this.lastUpdateTime = Date.now();
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
        const now = Date.now();
        const dt = Math.min((now - this.lastUpdateTime) / 1000, 0.1);
        this.lastUpdateTime = now;

        this.updatePlayers(dt);
        this.updateMonsters(dt);

        // Broadcast state
        const state = {
            players: this.entityManager.getAllPlayers(),
            items: this.entityManager.getAllItems(),
            monsters: this.entityManager.getAllMonsters()
        };

        this.io.emit(EVENTS.STATE_UPDATE, state);
    }

    private updatePlayers(dt: number) {
        const players = this.entityManager.getAllPlayers();

        for (const player of Object.values(players)) {
            // Handle auto-attack / chasing
            if (player.targetId) {
                let target: any = this.entityManager.getPlayer(player.targetId);
                if (!target) {
                    target = this.entityManager.getMonster(player.targetId);
                }

                if (target) {
                    const dx = player.position.x - target.position.x;
                    const dy = player.position.y - target.position.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    // Get active skill range
                    const skillId = player.activeSkill || 'melee';
                    const skillTemplate = this.skillDatabase.getTemplate(skillId);
                    const range = skillTemplate ? skillTemplate.range : 0;

                    // Range 0 = adjacent (dist <= 1.5)
                    // Range 1 = 1 tile between (dist <= 2.5)
                    // Formula: range + 1.5
                    const attackRange = range + 1.5;

                    if (dist <= attackRange) {
                        // In range! Stop moving and attack
                        player.moveTarget = null;
                        player.movePath = [];

                        const now = Date.now();
                        const attackCooldown = 1000; // 1 second cooldown

                        if (now - player.lastAttackTime >= attackCooldown) {
                            if (skillTemplate && skillTemplate.script) {
                                // Check if skill is on cooldown
                                if (!this.scriptEngine.isOnCooldown(player.id, skillId)) {
                                    this.scriptEngine.execute(skillTemplate.script, {
                                        self: player,
                                        target: target,
                                        trigger: 'ACTIVATE',
                                        skillId: skillId  // Pass skill ID for cooldown tracking
                                    });
                                }
                            } else {
                                const damage = 10; // Base damage
                                const isDead = this.entityManager.applyDamage(target.id, damage, player.id);

                                this.io.emit(EVENTS.ATTACK, {
                                    attackerId: player.id,
                                    targetId: target.id,
                                    damage
                                });

                                if (isDead) {
                                    this.io.emit(EVENTS.PLAYER_DEATH, { playerId: target.id });
                                    if (target.type === 'player') {
                                        this.entityManager.respawnPlayer(target.id);
                                    } else {
                                        // Award XP to all attackers
                                        const monster = target as Monster;
                                        const xpReward = monster.xpReward || (monster.level * 50); // Use defined XP or fallback

                                        console.log(`[GameLoop] Monster ${monster.name} (${monster.id}) died. XP Reward: ${xpReward}`);

                                        // DEBUG: Send to all for visibility
                                        this.io.emit(EVENTS.CHAT_MESSAGE, {
                                            id: Math.random().toString(36).substr(2, 9),
                                            playerId: 'system',
                                            playerName: 'Debug',
                                            message: `Monster died. Reward: ${xpReward}. Attackers: ${(monster.attackers || []).join(', ')}`,
                                            timestamp: Date.now()
                                        });

                                        // Distribute XP to all players who attacked
                                        // Note: Currently giving full XP to everyone. Could split it if desired.
                                        // User request: "kill a monster awards xp to anyone that attacked it at least once"
                                        // This implies full XP or shared XP. Usually "awards xp" means they get credit.
                                        // Let's give full XP for now as it's more fun/cooperative-friendly.

                                        const attackers = monster.attackers || [];
                                        // Ensure the killer is in the list (should be handled by applyDamage but just in case)
                                        if (!attackers.includes(player.id)) {
                                            attackers.push(player.id);
                                        }

                                        console.log(`[GameLoop] Awarding XP to ${attackers.length} attackers: ${attackers.join(', ')}`);

                                        for (const attackerId of attackers) {
                                            const attacker = this.entityManager.getPlayer(attackerId);
                                            if (attacker) {
                                                const oldXp = attacker.xp;
                                                attacker.xp += xpReward;
                                                console.log(`[GameLoop] Player ${attacker.name} XP: ${oldXp} -> ${attacker.xp}`);

                                                // Check for Level Up
                                                const xpNeeded = getXpForLevel(attacker.level);
                                                if (attacker.xp >= xpNeeded) {
                                                    console.log(`[GameLoop] Player ${attacker.name} Leveled Up! ${attacker.level} -> ${attacker.level + 1}`);
                                                    attacker.level++;
                                                    attacker.xp -= xpNeeded; // Carry over excess XP
                                                    attacker.maxXp = getXpForLevel(attacker.level);

                                                    // Stat increase
                                                    attacker.maxHp += 20;
                                                    attacker.hp = attacker.maxHp;
                                                    attacker.maxEnergy += 10;
                                                    attacker.energy = attacker.maxEnergy;

                                                    this.io.emit(EVENTS.CHAT_MESSAGE, {
                                                        id: Math.random().toString(36).substr(2, 9),
                                                        playerId: 'system',
                                                        playerName: 'System',
                                                        message: `🎉 Level Up! ${attacker.name} is now level ${attacker.level}!`,
                                                        timestamp: Date.now()
                                                    });

                                                    this.io.emit(EVENTS.EFFECT, {
                                                        effectId: 'level_up',
                                                        entityId: attacker.id,
                                                        durationMs: 2000
                                                    });
                                                }

                                                // Only send XP message to the specific player
                                                // But we don't have individual sockets here easily without looking them up
                                                // So we'll broadcast a system message or just rely on the bar updating.
                                                // Let's send a chat message to everyone for now or just log it.
                                                // Ideally we send to specific socket.
                                                const socket = this.io.sockets.sockets.get(attackerId);
                                                if (socket) {
                                                    socket.emit(EVENTS.CHAT_MESSAGE, {
                                                        id: Math.random().toString(36).substr(2, 9),
                                                        playerId: 'system',
                                                        playerName: 'System',
                                                        message: `You gained ${xpReward} XP`,
                                                        timestamp: Date.now()
                                                    });
                                                }
                                            } else {
                                                console.log(`[GameLoop] Attacker ${attackerId} not found`);
                                            }
                                        }

                                        this.entityManager.removeMonster(target.id);
                                    }
                                }
                            }

                            player.lastAttackTime = now;

                            if (target.hp <= 0) {
                                // Clear target since they are dead
                                player.targetId = null;
                            }
                        }
                    } else {
                        // Out of range, chase!
                        // Re-calculate path if we have no path or target moved far?
                        // For now, let's just re-path if we aren't moving or every so often?
                        // Simpler: If no moveTarget, find path.
                        if (!player.moveTarget) {
                            // Find nearest walkable tile to target
                            const dest = this.worldManager.findNearestWalkableTile(
                                target.position.x,
                                target.position.y,
                                player.position.x,
                                player.position.y,
                                (x, y) => this.entityManager.isPositionOccupied(x, y, player.id)
                            );

                            if (dest) {
                                const path = this.worldManager.findPath(
                                    player.position.x,
                                    player.position.y,
                                    dest.x,
                                    dest.y,
                                    (x, y) => this.entityManager.isPositionOccupied(x, y, player.id)
                                );
                                if (path.length > 0) {
                                    this.entityManager.setMovePath(player.id, path);
                                }
                            }
                        }
                    }
                } else {
                    // Target lost
                    player.targetId = null;
                }
            }

            this.handleEntityMovement(player, dt);
            this.entityManager.checkItemPickup(player.id);
        }
    }

    private updateMonsters(dt: number) {
        const monsters = this.entityManager.getAllMonsters();
        const now = Date.now();

        for (const monster of Object.values(monsters)) {
            this.handleEntityMovement(monster, dt);

            switch (monster.strategy) {
                case MonsterStrategyType.PASSIVE:
                    // Move every 6-12 seconds
                    if (now - monster.lastActionTime > 6000 + Math.random() * 6000) {
                        // Pick a random nearby point
                        const range = 5;
                        const targetX = Math.max(1, Math.min(CONSTANTS.MAP_WIDTH - 2, Math.round(monster.position.x + (Math.random() * range * 2 - range))));
                        const targetY = Math.max(1, Math.min(CONSTANTS.MAP_HEIGHT - 2, Math.round(monster.position.y + (Math.random() * range * 2 - range))));

                        const path = this.worldManager.findPath(
                            monster.position.x,
                            monster.position.y,
                            targetX,
                            targetY,
                            (x, y) => this.entityManager.isPositionOccupied(x, y, monster.id)
                        );
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
                                const path = this.worldManager.findPath(
                                    monster.position.x,
                                    monster.position.y,
                                    targetPlayer.position.x,
                                    targetPlayer.position.y,
                                    (x, y) => this.entityManager.isPositionOccupied(x, y, monster.id)
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

    private handleEntityMovement(entity: Player | Monster, dt: number) {
        // const deltaTime = 1 / CONSTANTS.TICK_RATE; // Removed fixed delta time
        const moveSpeed = entity.type === 'player' ? CONSTANTS.MOVE_SPEED : CONSTANTS.MOVE_SPEED * 0.5; // Monsters slower

        if (entity.moveTarget) {
            // Check if target is blocked (dynamic collision)
            if (this.entityManager.isPositionOccupied(entity.moveTarget.x, entity.moveTarget.y, entity.id)) {
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
                this.entityManager.updatePlayerPosition(entity.id, entity.moveTarget); // Or generic updatePosition
                // Note: updatePlayerPosition works for players, need generic or check type
                if (entity.type === 'player') {
                    this.entityManager.updatePlayerPosition(entity.id, entity.moveTarget);
                } else {
                    this.entityManager.updateMonsterPosition(entity.id, entity.moveTarget);
                }

                // entity.position is updated by entityManager methods now? 
                // Wait, updatePlayerPosition updates the position in the object AND the spatial map.
                // But here we are modifying entity.position directly in the original code.
                // We should use the entityManager methods to keep spatial map in sync.

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
                        if (this.entityManager.isPositionOccupied(nextNode.x, nextNode.y, entity.id)) {
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
                const moveDistance = Math.min(moveSpeed * dt, distance);
                const normalizedX = dx / distance;
                const normalizedY = dy / distance;

                const newX = entity.position.x + normalizedX * moveDistance;
                const newY = entity.position.y + normalizedY * moveDistance;

                // Update position through manager to ensure spatial map is updated correctly
                // We do this every tick now because updateSpatialMap is optimized to handle same-key updates cheaply
                if (entity.type === 'player') {
                    this.entityManager.updatePlayerPosition(entity.id, { x: newX, y: newY });
                } else {
                    this.entityManager.updateMonsterPosition(entity.id, { x: newX, y: newY });
                }
            }
        }
    }
}
