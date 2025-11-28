import { Player, Position, CONSTANTS, Item, Monster, MonsterStrategyType } from '@vibemaster/shared';
import { MonsterLoader } from '../utils/MonsterLoader.js';
import { ClassDatabase } from './ClassDatabase.js';

export class EntityManager {
    private players: Record<string, Player> = {};
    private items: Record<string, Item> = {};
    private monsters: Record<string, Monster> = {};

    private classDatabase: ClassDatabase;

    constructor(classDatabase: ClassDatabase) {
        this.classDatabase = classDatabase;
        // Load monster database on initialization
        MonsterLoader.loadDatabase();
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

        const player: Player = {
            id,
            type: 'player',
            name,
            position: spawnPosition || {
                x: Math.floor(Math.random() * 40) + 5,
                y: Math.floor(Math.random() * 40) + 5
            },
            hp,
            maxHp: hp,
            energy,
            maxEnergy: energy,
            level: 1,
            xp: 0,
            class: className,
            inventory: [],
            moveTarget: null,
            movePath: [],
            skills: randomClass ? randomClass.startingSkills : ['melee']
        };
        this.players[id] = player;
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
        delete this.players[id];
    }

    public getPlayer(id: string): Player | undefined {
        return this.players[id];
    }

    public getAllPlayers(): Record<string, Player> {
        return this.players;
    }

    public updatePlayerPosition(id: string, position: Position) {
        if (this.players[id]) {
            this.players[id].position = position;
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
        const template = MonsterLoader.getMonster(monsterId);
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
            movePath: []
        };

        this.monsters[id] = monster;
        console.log(`🐉 Spawned ${template.name} at (${position.x}, ${position.y})`);
        return monster;
    }

    public addMonster(
        id: string,
        name: string,
        x: number,
        y: number,
        template?: { hp?: number, level?: number, strategy?: MonsterStrategyType }
    ): Monster {
        const hp = template?.hp || 50;
        const monster: Monster = {
            id,
            type: 'monster',
            name,
            position: { x, y },
            hp,
            maxHp: hp,
            level: template?.level || 1,
            targetId: null,
            strategy: template?.strategy || MonsterStrategyType.PASSIVE,
            lastActionTime: Date.now(),
            moveTarget: null,
            movePath: []
        };
        this.monsters[id] = monster;
        return monster;
    }

    public removeMonster(id: string) {
        delete this.monsters[id];
    }

    public getMonster(id: string): Monster | undefined {
        return this.monsters[id];
    }

    public getAllMonsters(): Record<string, Monster> {
        return this.monsters;
    }

    public updateMonsterPosition(id: string, position: Position) {
        if (this.monsters[id]) {
            this.monsters[id].position = position;
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
        }

        if (target.hp <= 0) {
            target.hp = 0;
            return true;
        }
        return false;
    }

    public respawnPlayer(id: string) {
        const player = this.players[id];
        if (player) {
            player.hp = player.maxHp;
            player.position = { x: 5, y: 5 };
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

    public getOccupiedPositions(excludeId?: string): Set<string> {
        const occupied = new Set<string>();
        for (const p of Object.values(this.players)) {
            if (p.id !== excludeId) {
                occupied.add(`${Math.round(p.position.x)},${Math.round(p.position.y)}`);
            }
        }
        for (const m of Object.values(this.monsters)) {
            if (m.id !== excludeId) {
                occupied.add(`${Math.round(m.position.x)},${Math.round(m.position.y)}`);
            }
        }
        return occupied;
    }
    public clearMonsters() {
        this.monsters = {};
    }

    public clearItems() {
        this.items = {};
    }
}
