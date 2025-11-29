import { EntityManager } from './EntityManager.js';
import { Server } from 'socket.io';
import { EVENTS, Player, Monster, Position } from '@vibemaster/shared';

export interface ScriptContext {
    self: Player | Monster;
    target?: Player | Monster;
    trigger: string;
}

export class ScriptEngine {
    private entityManager: EntityManager;
    private io: Server;

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
        // Parse: effect effectId,position,durationMs
        const effectId = args[0];
        const positionArg = args[1];
        const durationMs = parseInt(args[2]);

        const position = this.resolvePosition(positionArg, context);

        if (position && effectId && !isNaN(durationMs)) {
            this.io.emit(EVENTS.EFFECT, {
                effectId,
                position,
                durationMs
            });
            console.log(`✨ Effect ${effectId} triggered at (${position.x}, ${position.y}) for ${durationMs}ms`);
        } else {
            console.warn(`Failed to trigger effect: ${args.join(', ')}`);
        }
    }
}
