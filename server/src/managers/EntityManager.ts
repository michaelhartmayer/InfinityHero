import { Player, Position, CONSTANTS, Item, Monster, MonsterStrategyType } from '@vibemaster/shared';
import { MonsterDatabase } from './MonsterDatabase.js';
import { ClassDatabase } from './ClassDatabase.js';
import { getXpForLevel } from '../data/ExperienceTable.js';

export class EntityManager {
    private players: Record<string, Player> = {};
    private items: Record<string, Item> = {};
    private monsters: Record<string, Monster> = {};

    private classDatabase: ClassDatabase;
    private monsterDatabase: MonsterDatabase;

    private spatialMap: Map<string, string> = new Map(); // "x,y" -> entityId

    constructor(classDatabase: ClassDatabase, monsterDatabase: MonsterDatabase) {
        this.classDatabase = classDatabase;
        this.monsterDatabase = monsterDatabase;
    }

    private getSpatialKey(x: number, y: number): string {
        return `${Math.round(x)},${Math.round(y)}`;
    }

    private updateSpatialMap(id: string, oldPos: Position | null, newPos: Position) {
        const newKey = this.getSpatialKey(newPos.x, newPos.y);

        if (oldPos) {
            const oldKey = this.getSpatialKey(oldPos.x, oldPos.y);

            // Optimization: If key hasn't changed, do nothing
            if (oldKey === newKey) {
                // Ensure the map has this entity (in case of initialization or weird state)
                // But generally we can just return
                if (this.spatialMap.get(newKey) === id) {
                    return;
                }
            }

            if (this.spatialMap.get(oldKey) === id) {
                this.spatialMap.delete(oldKey);
            }
        }
        this.spatialMap.set(newKey, id);
    }

    public addPlayer(id: string, name: string, spawnPosition?: Position): Player {
        // Select a random class or default to warrior
        const classes = this.classDatabase.getAllTemplates();
        const randomClass = classes.length > 0
            ? classes[Math.floor(Math.random() * classes.length)]
            : null;

        const className = randomClass ? randomClass.id : 'warrior';
        const hp = randomClass ? randomClass.baseHp : 100;
        const energy = randomClass ? randomClass.baseEnergy : 50;

        const position = spawnPosition || {
            x: Math.floor(Math.random() * 40) + 5,
            y: Math.floor(Math.random() * 40) + 5
        };

        const player: Player = {
            id,
            type: 'player',
            name,
            position,
            hp,
            maxHp: hp,
            energy,
            maxEnergy: energy,
            level: 1,
            xp: 0,
            maxXp: getXpForLevel(1),
            class: className,
            inventory: [],
            moveTarget: null,
            movePath: [],
            skills: randomClass ? randomClass.startingSkills : ['melee'],
            activeSkill: 'melee',
            targetId: null,
            lastAttackTime: 0
        };
        this.players[id] = player;
        this.updateSpatialMap(id, null, position);
        return player;
    }

    public setMoveTarget(id: string, target: Position) {
        if (this.players[id]) {
            this.players[id].moveTarget = target;
        }
    }

    public setMovePath(id: string, path: Position[]) {
        if (this.players[id]) {
            this.players[id].movePath = path;
            if (path.length > 0) {
                this.players[id].moveTarget = path[0];
            } else {
                this.players[id].moveTarget = null;
            }
        }
    }

    public removePlayer(id: string) {
        const player = this.players[id];
        if (player) {
            const key = this.getSpatialKey(player.position.x, player.position.y);
            if (this.spatialMap.get(key) === id) {
                this.spatialMap.delete(key);
            }
            delete this.players[id];
        }
    }

    public getPlayer(id: string): Player | undefined {
        return this.players[id];
    }

    public getAllPlayers(): Record<string, Player> {
        return this.players;
    }

    public updatePlayerPosition(id: string, position: Position) {
        if (this.players[id]) {
            const oldPos = this.players[id].position;
            this.players[id].position = position;
            this.updateSpatialMap(id, oldPos, position);
        }
    }

    public setPlayerName(id: string, name: string): boolean {
        if (this.players[id]) {
            this.players[id].name = name;
            return true;
        }
        return false;
    }

    public spawnMonsterFromTemplate(monsterId: string, position: Position): Monster | null {
        const template = this.monsterDatabase.getTemplate(monsterId);
        if (!template) {
            console.error(`Monster template not found: ${monsterId}`);
            return null;
        }

        const id = `monster_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const monster: Monster = {
            id,
            type: 'monster',
            name: template.name,
            position,
            hp: template.hp,
            maxHp: template.hp,
            level: template.baseLevel,
            targetId: null,
            strategy: MonsterStrategyType.PASSIVE, // Default, can be changed based on template
            lastActionTime: Date.now(),
            moveTarget: null,
            movePath: [],
            sprite: template.sprite,
            spawnEffect: template.spawnEffect,
            lastAttackTime: 0,
            xpReward: template.xpReward || (template.baseLevel * 50),
            attackers: [],
            templateId: monsterId
        };

        this.monsters[id] = monster;
        this.updateSpatialMap(id, null, position);
        console.log(`🐉 Spawned ${template.name} at (${position.x}, ${position.y})`);
        return monster;
    }

    public updateActiveMonsters(template: any) {
        let count = 0;
        for (const monster of Object.values(this.monsters)) {
            if (monster.templateId === template.id) {
                // Update properties
                if (template.xpReward !== undefined) {
                    monster.xpReward = template.xpReward;
                }
                // We could update other stats here too, but XP is the request
                count++;
            }
        }
        if (count > 0) {
            console.log(`Updated ${count} active monsters of type ${template.id}`);
        }
    }

    public addMonster(
        id: string,
        name: string,
        x: number,
        y: number,
        template?: { hp?: number, level?: number, strategy?: MonsterStrategyType, sprite?: string, spawnEffect?: string, xpReward?: number }
    ): Monster {
        const hp = template?.hp || 50;
        const position = { x, y };
        const monster: Monster = {
            id,
            type: 'monster',
            name,
            position,
            hp,
            maxHp: hp,
            level: template?.level || 1,
            targetId: null,
            strategy: template?.strategy || MonsterStrategyType.PASSIVE,
            lastActionTime: Date.now(),
            moveTarget: null,
            movePath: [],
            sprite: template?.sprite,
            spawnEffect: template?.spawnEffect,
            lastAttackTime: 0,
            xpReward: template?.xpReward || ((template?.level || 1) * 50),
            attackers: []
        };
        this.monsters[id] = monster;
        this.updateSpatialMap(id, null, position);
        return monster;
    }

    public removeMonster(id: string) {
        const monster = this.monsters[id];
        if (monster) {
            const key = this.getSpatialKey(monster.position.x, monster.position.y);
            if (this.spatialMap.get(key) === id) {
                this.spatialMap.delete(key);
            }
            delete this.monsters[id];
        }
    }

    public getMonster(id: string): Monster | undefined {
        return this.monsters[id];
    }

    public getAllMonsters(): Record<string, Monster> {
        return this.monsters;
    }

    public updateMonsterPosition(id: string, position: Position) {
        if (this.monsters[id]) {
            const oldPos = this.monsters[id].position;
            this.monsters[id].position = position;
            this.updateSpatialMap(id, oldPos, position);
        }
    }

    public applyDamage(targetId: string, damage: number, attackerId?: string): boolean {
        let target: Player | Monster | undefined = this.players[targetId];

        if (!target) {
            target = this.monsters[targetId];
        }

        if (!target) return false;

        target.hp -= damage;

        if (target.type === 'monster' && attackerId) {
            const monster = target as Monster;
            monster.strategy = MonsterStrategyType.AGGRESSIVE;
            monster.targetId = attackerId;
            if (!monster.attackers) monster.attackers = [];
            if (!monster.attackers.includes(attackerId)) {
                monster.attackers.push(attackerId);
            }
        }

        if (target.hp <= 0) {
            console.log(`[EntityManager] ${target.id} took ${damage} damage and DIED.`);
            target.hp = 0;
            return true;
        } else {
            console.log(`[EntityManager] ${target.id} took ${damage} damage. HP: ${target.hp}/${target.maxHp}`);
        }
        return false;
    }

    public respawnPlayer(id: string) {
        const player = this.players[id];
        if (player) {
            player.hp = player.maxHp;
            const oldPos = player.position;
            player.position = { x: 5, y: 5 };
            this.updateSpatialMap(id, oldPos, player.position);
        }
    }

    public addItem(item: Item) {
        this.items[item.id] = item;
    }

    public removeItem(id: string) {
        delete this.items[id];
    }

    public getItem(id: string): Item | undefined {
        return this.items[id];
    }

    public getAllItems(): Record<string, Item> {
        return this.items;
    }

    public checkItemPickup(playerId: string): Item | null {
        const player = this.players[playerId];
        if (!player) return null;

        for (const item of Object.values(this.items)) {
            // Simple distance check (assuming integer coordinates mostly, but allowing small float diff)
            if (Math.abs(player.position.x - item.position.x) < 0.5 &&
                Math.abs(player.position.y - item.position.y) < 0.5) {

                // Pickup!
                delete this.items[item.id];
                player.inventory.push(item);
                return item;
            }
        }
        return null;
    }

    public isPositionOccupied(x: number, y: number, excludeId?: string): boolean {
        const key = this.getSpatialKey(x, y);
        const occupierId = this.spatialMap.get(key);
        return occupierId !== undefined && occupierId !== excludeId;
    }

    public clearMonsters() {
        for (const id of Object.keys(this.monsters)) {
            this.removeMonster(id);
        }
        this.monsters = {};
    }

    public clearItems() {
        this.items = {};
    }

    public changePlayerClass(playerId: string, classId: string): boolean {
        const player = this.players[playerId];
        if (!player) return false;

        const classTemplate = this.classDatabase.getTemplate(classId);
        if (!classTemplate) return false;

        player.class = classId;
        player.maxHp = classTemplate.baseHp;
        player.hp = player.maxHp;
        player.maxEnergy = classTemplate.baseEnergy;
        player.energy = player.maxEnergy;
        player.skills = classTemplate.startingSkills;
        player.activeSkill = player.skills[0] || 'melee';

        return true;
    }
}
