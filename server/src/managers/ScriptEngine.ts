import { EntityManager } from './EntityManager.js';
import { Server } from 'socket.io';
import { EVENTS, Player, Monster, Position } from '@vibemaster/shared';
import { getXpForLevel } from '../data/ExperienceTable.js';

export interface ScriptContext {
    self: Player | Monster;
    target?: Player | Monster;
    trigger: string;
    skillId?: string; // The skill that triggered this script
}

export class ScriptEngine {
    private entityManager: EntityManager;
    private io: Server;
    // Map: playerId -> skillId -> expirationTimestamp
    private cooldowns: Map<string, Map<string, number>> = new Map();

    constructor(entityManager: EntityManager, io: Server) {
        this.entityManager = entityManager;
        this.io = io;
    }

    public execute(script: string, context: ScriptContext) {
        const lines = script.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;

            // Parse: TRIGGER FUNCTION Arg1,Arg2,...;
            // Remove trailing ;
            const cleanLine = trimmed.replace(/;$/, '');
            const parts = cleanLine.split(' ');
            if (parts.length < 2) continue;

            const trigger = parts[0];
            const functionName = parts[1];
            const argsStr = parts.slice(2).join(' ');
            const args = argsStr ? argsStr.split(',') : [];

            if (trigger === context.trigger) {
                this.runFunction(functionName, args, context);
            }
        }
    }

    private runFunction(name: string, args: string[], context: ScriptContext) {
        switch (name) {
            case 'damage_target':
                this.damage_target(args, context);
                break;
            case 'heal_target':
                this.heal_target(args, context);
                break;
            case 'effect':
                this.effect(args, context);
                break;
            case 'cooldown':
                this.cooldown(args, context);
                break;
            case 'energy_cost':
                this.energy_cost(args, context);
                break;
            default:
                console.warn(`Unknown script function: ${name}`);
        }
    }

    private resolveEntity(arg: string, context: ScriptContext): Player | Monster | undefined {
        if (arg === '$_self') return context.self;
        if (arg === '$_target') return context.target;
        return undefined;
    }

    private resolvePosition(arg: string, context: ScriptContext): Position | undefined {
        if (arg === '@$_self') return context.self.position;
        if (arg === '@$_target') return context.target?.position;
        return undefined;
    }

    // Functions

    private damage_target(args: string[], context: ScriptContext) {
        const amount = parseInt(args[0]);
        const targetArg = args[1];
        const target = this.resolveEntity(targetArg, context);

        if (target && !isNaN(amount)) {
            const isDead = this.entityManager.applyDamage(target.id, amount, context.self.id);
            this.io.emit(EVENTS.ATTACK, {
                attackerId: context.self.id,
                targetId: target.id,
                damage: amount
            });

            if (isDead) {
                this.io.emit(EVENTS.PLAYER_DEATH, { playerId: target.id });
                if (target.type === 'player') {
                    this.entityManager.respawnPlayer(target.id);
                } else {
                    // Award XP to all attackers
                    const monster = target as Monster;
                    const xpReward = monster.xpReward || (monster.level * 50);

                    console.log(`[ScriptEngine] Monster ${monster.name} (${monster.id}) died. XP Reward: ${xpReward}`);

                    this.io.emit(EVENTS.CHAT_MESSAGE, {
                        id: Math.random().toString(36).substr(2, 9),
                        playerId: 'system',
                        playerName: 'Debug',
                        message: `Monster died. Reward: ${xpReward}. Attackers: ${(monster.attackers || []).join(', ')}`,
                        timestamp: Date.now()
                    });

                    const attackers = monster.attackers || [];
                    // Ensure the killer is in the list
                    if (!attackers.includes(context.self.id)) {
                        attackers.push(context.self.id);
                    }

                    console.log(`[ScriptEngine] Awarding XP to ${attackers.length} attackers: ${attackers.join(', ')}`);

                    for (const attackerId of attackers) {
                        const attacker = this.entityManager.getPlayer(attackerId);
                        if (attacker) {
                            const oldXp = attacker.xp;
                            attacker.xp += xpReward;
                            console.log(`[ScriptEngine] Player ${attacker.name} XP: ${oldXp} -> ${attacker.xp}`);

                            // Check for Level Up
                            const xpNeeded = getXpForLevel(attacker.level);
                            if (attacker.xp >= xpNeeded) {
                                console.log(`[ScriptEngine] Player ${attacker.name} Leveled Up! ${attacker.level} -> ${attacker.level + 1}`);
                                attacker.level++;
                                attacker.xp -= xpNeeded;
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
                        }
                    }

                    this.entityManager.removeMonster(target.id);
                }
            }
        }
    }

    private heal_target(args: string[], context: ScriptContext) {
        const amount = parseInt(args[0]);
        const targetArg = args[1];
        const target = this.resolveEntity(targetArg, context);

        if (target && !isNaN(amount)) {
            target.hp = Math.min(target.hp + amount, target.maxHp);

            this.io.emit(EVENTS.ATTACK, {
                attackerId: context.self.id,
                targetId: target.id,
                damage: -amount
            });
        }
    }

    private effect(args: string[], context: ScriptContext) {
        // Parse: effect effectId,target,durationMs
        // target can be: $_self, $_target (entity) or @$_self, @$_target (position)
        const effectId = args[0];
        const targetArg = args[1];
        const durationMs = parseInt(args[2]);

        if (!effectId || !targetArg || isNaN(durationMs)) {
            console.warn(`Failed to trigger effect: invalid args ${args.join(', ')}`);
            return;
        }

        // Check if it's an entity reference (starts with $ but not @)
        if (targetArg.startsWith('$') && !targetArg.startsWith('@')) {
            const entity = this.resolveEntity(targetArg, context);
            if (entity) {
                this.io.emit(EVENTS.EFFECT, {
                    effectId,
                    entityId: entity.id,
                    durationMs
                });
                console.log(`✨ Effect ${effectId} attached to entity ${entity.id} for ${durationMs}ms`);
            } else {
                console.warn(`Failed to trigger effect: entity not found for ${targetArg}`);
            }
        } else {
            // Position reference (starts with @)
            const position = this.resolvePosition(targetArg, context);
            if (position) {
                this.io.emit(EVENTS.EFFECT, {
                    effectId,
                    position,
                    durationMs
                });
                console.log(`✨ Effect ${effectId} triggered at (${position.x}, ${position.y}) for ${durationMs}ms`);
            } else {
                console.warn(`Failed to trigger effect: position not found for ${targetArg}`);
            }
        }
    }

    private cooldown(args: string[], context: ScriptContext) {
        // Parse: cooldown durationMs
        const durationMs = parseInt(args[0]);

        if (isNaN(durationMs) || durationMs <= 0) {
            console.warn(`Invalid cooldown duration: ${args[0]}`);
            return;
        }

        // Only players have cooldowns (not monsters)
        if (context.self.type !== 'player' || !context.skillId) {
            return;
        }

        const playerId = context.self.id;
        const skillId = context.skillId;
        const expirationTime = Date.now() + durationMs;

        // Get or create player's cooldown map
        if (!this.cooldowns.has(playerId)) {
            this.cooldowns.set(playerId, new Map());
        }

        this.cooldowns.get(playerId)!.set(skillId, expirationTime);

        // Emit cooldown to client
        this.io.to(playerId).emit(EVENTS.SKILL_COOLDOWN, {
            skillId,
            expirationTime,
            duration: durationMs
        });

        console.log(`⏱️ Cooldown set for player ${playerId}, skill ${skillId}: ${durationMs}ms`);
    }

    public isOnCooldown(playerId: string, skillId: string): boolean {
        const playerCooldowns = this.cooldowns.get(playerId);
        if (!playerCooldowns) return false;

        const expirationTime = playerCooldowns.get(skillId);
        if (!expirationTime) return false;

        const now = Date.now();
        if (now >= expirationTime) {
            // Cooldown expired, clean up
            playerCooldowns.delete(skillId);
            if (playerCooldowns.size === 0) {
                this.cooldowns.delete(playerId);
            }
            return false;
        }

        return true;
    }

    private energy_cost(args: string[], context: ScriptContext) {
        // Parse: energy_cost amount
        const amount = parseInt(args[0]);

        if (isNaN(amount) || amount < 0) {
            console.warn(`Invalid energy cost amount: ${args[0]}`);
            return;
        }

        // Only players have energy costs
        if (context.self.type !== 'player') {
            return;
        }

        // Deduct energy
        context.self.energy = Math.max(0, context.self.energy - amount);
        console.log(`⚡ Player ${context.self.id} spent ${amount} energy (${context.self.energy} remaining)`);
    }
}
