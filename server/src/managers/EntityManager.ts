import { Player, Position, CONSTANTS, Item, Monster, MonsterStrategyType } from '@vibemaster/shared';

export class EntityManager {
    private players: Record<string, Player> = {};
    private items: Record<string, Item> = {};
    private monsters: Record<string, Monster> = {};

    public addPlayer(id: string, name: string): Player {
        const player: Player = {
            id,
            type: 'player',
            name,
            position: {
                x: Math.floor(Math.random() * 40) + 5,
                y: Math.floor(Math.random() * 40) + 5
            },
            hp: 100,
            maxHp: 100,
            energy: 50,
            maxEnergy: 50,
            level: 1,
            xp: 0,
            class: ['WARRIOR', 'MAGE', 'ROGUE'][Math.floor(Math.random() * 3)] as any,
            inventory: [],
            moveTarget: null,
            movePath: []
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
}
