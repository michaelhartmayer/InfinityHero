import { useEffect, useRef, useState } from 'react';
import { GameRenderer, CursorState } from '../game/GameRenderer';
import { AudioManager } from '../game/AudioManager';
import type { WorldMap, Player, Item, Monster, ChatMessage } from '@vibemaster/shared';

interface GameCanvasProps {
    mapData: WorldMap | null;
    players: Record<string, Player>;
    items: Record<string, Item>;
    monsters: Record<string, Monster>;
    localPlayerId: string | null;
    lastMessage: ChatMessage | null;
    lastAttackEvent: { attackerId: string, targetId: string, damage: number } | null;
    lastEffectEvent: { effectId: string, position?: { x: number, y: number }, entityId?: string, durationMs: number } | null;
    onMove: (x: number, y: number) => void;
    onAttack: (targetId: string) => void;
    onDebugUpdate?: (info: string) => void;
    showCollision?: boolean;
}

export function GameCanvas({ mapData, players, items, monsters, localPlayerId, lastMessage, lastAttackEvent, lastEffectEvent, onMove, onAttack, onDebugUpdate, showCollision }: GameCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rendererRef = useRef<GameRenderer | null>(null);
    const [selectedMonsterId, setSelectedMonsterId] = useState<string | null>(null);
    const lastMonsterPos = useRef<{ x: number, y: number } | null>(null);
    const lastMousePos = useRef<{ x: number, y: number } | null>(null);
    const lastAttackTime = useRef<number>(0);

    useEffect(() => {
        if (!canvasRef.current) return;

        // Initialize renderer
        rendererRef.current = new GameRenderer(canvasRef.current, localPlayerId);
        if (onDebugUpdate) {
            rendererRef.current.onDebugUpdate = onDebugUpdate;
        }

        // Handle resize
        const handleResize = () => {
            if (canvasRef.current && rendererRef.current) {
                const parent = canvasRef.current.parentElement;
                if (parent) {
                    rendererRef.current.resize(parent.clientWidth, parent.clientHeight);
                }
            }
        };

        const handleClick = (e: MouseEvent) => {
            if (!rendererRef.current || !mapData || !canvasRef.current) return;

            const rect = canvasRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // Check for monster click
            const monsterId = rendererRef.current.pickMonster(x, y, rect.width, rect.height);

            if (monsterId) {
                console.log('Selected monster:', monsterId);
                setSelectedMonsterId(monsterId);
                rendererRef.current.selectMonster(monsterId, monsters, mapData);
                return; // Don't move to tile if clicking monster
            }

            // If clicked ground, clear selection
            setSelectedMonsterId(null);
            rendererRef.current.selectMonster(null, monsters, mapData);

            const target = rendererRef.current.screenToWorld(x, y, rect.width, rect.height, mapData);
            if (target) {
                onMove(target.x, target.y);
            }
        };

        const handleMouseMove = (e: MouseEvent) => {
            if (!rendererRef.current || !mapData || !canvasRef.current) return;

            const rect = canvasRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            lastMousePos.current = { x, y };

            const target = rendererRef.current.screenToWorld(x, y, rect.width, rect.height, mapData);

            // Check for monster hover
            const hoveredMonsterId = rendererRef.current.pickMonster(x, y, rect.width, rect.height);
            if (hoveredMonsterId) {
                rendererRef.current.setCursorState(CursorState.SELECT_TARGET);
            } else {
                rendererRef.current.setCursorState(CursorState.PASSIVE);
            }

            if (target) {
                rendererRef.current.setHighlight(target.x, target.y, mapData);
            }
        };

        const handleWheel = (e: WheelEvent) => {
            if (!rendererRef.current) return;
            e.preventDefault();
            rendererRef.current.adjustZoom(e.deltaY);
        };

        window.addEventListener('resize', handleResize);
        canvasRef.current.addEventListener('mousedown', handleClick);
        canvasRef.current.addEventListener('mousemove', handleMouseMove);
        canvasRef.current.addEventListener('wheel', handleWheel, { passive: false });

        handleResize(); // Initial size

        return () => {
            window.removeEventListener('resize', handleResize);
            canvasRef.current?.removeEventListener('mousedown', handleClick);
            canvasRef.current?.removeEventListener('mousemove', handleMouseMove);
            canvasRef.current?.removeEventListener('wheel', handleWheel);
        };
    }, [localPlayerId]); // Re-init if localPlayerId changes

    // Update renderer
    useEffect(() => {
        if (mapData && rendererRef.current) {
            rendererRef.current.renderMap(mapData);
        }
    }, [mapData]);

    useEffect(() => {
        if (rendererRef.current) {
            rendererRef.current.toggleCollisionView(!!showCollision);
        }
    }, [showCollision]);

    useEffect(() => {
        if (rendererRef.current && mapData) {
            rendererRef.current.updatePlayers(players, mapData);
            rendererRef.current.updateItems(items, mapData);
            rendererRef.current.updateMonsters(monsters, mapData);

            // Ensure selection is maintained visually
            if (selectedMonsterId) {
                rendererRef.current.selectMonster(selectedMonsterId, monsters, mapData);
            }

            // Re-check hover state if mouse hasn't moved but monsters have
            if (lastMousePos.current && canvasRef.current) {
                const rect = canvasRef.current.getBoundingClientRect();
                const hoveredMonsterId = rendererRef.current.pickMonster(
                    lastMousePos.current.x,
                    lastMousePos.current.y,
                    rect.width,
                    rect.height
                );

                if (hoveredMonsterId) {
                    rendererRef.current.setCursorState(CursorState.SELECT_TARGET);
                } else {
                    rendererRef.current.setCursorState(CursorState.PASSIVE);
                }
            }
        }
    }, [players, items, monsters, mapData, selectedMonsterId]);

    // Handle chat bubbles
    useEffect(() => {
        if (lastMessage && rendererRef.current) {
            // Don't show chat bubbles for system messages
            if (lastMessage.playerId !== 'system') {
                rendererRef.current.showChatBubble(lastMessage.playerId, lastMessage.message);
            }
        }
    }, [lastMessage]);

    // Track processed attack events to prevent duplicates
    const lastProcessedAttackRef = useRef<{ attackerId: string, targetId: string, damage: number } | null>(null);

    // Handle attack events
    useEffect(() => {
        if (lastAttackEvent && rendererRef.current && lastAttackEvent !== lastProcessedAttackRef.current) {
            lastProcessedAttackRef.current = lastAttackEvent;

            rendererRef.current.showDamage(lastAttackEvent.targetId, lastAttackEvent.damage, lastAttackEvent.attackerId);

            // Play sound effect
            if (lastAttackEvent.attackerId) {
                // Check if attacker is a player (by checking if they are in the players list)
                // Note: This assumes players list is available in scope (it is passed as prop)
                const isPlayer = players[lastAttackEvent.attackerId] !== undefined;

                if (isPlayer) {
                    AudioManager.getInstance().playSFX('/assets/sounds/dev-pc-punch.mp3');
                } else {
                    AudioManager.getInstance().playSFX('/assets/sounds/dev-bone-punch.mp3');
                }
            }
        }
    }, [lastAttackEvent, players]);

    // Track processed effects to prevent duplicates
    const lastProcessedEffectRef = useRef<{ effectId: string, position?: { x: number, y: number }, entityId?: string, durationMs: number } | null>(null);

    // Handle effect events
    useEffect(() => {
        if (lastEffectEvent && rendererRef.current && mapData && lastEffectEvent !== lastProcessedEffectRef.current) {
            lastProcessedEffectRef.current = lastEffectEvent;

            let worldPos: { x: number, y: number };
            let entityId: string | undefined;

            if (lastEffectEvent.entityId) {
                // Entity-attached effect - resolve entity position
                const entity = players[lastEffectEvent.entityId] || monsters[lastEffectEvent.entityId];
                if (entity) {
                    const offsetX = mapData.width / 2;
                    const offsetY = mapData.height / 2;
                    worldPos = {
                        x: entity.position.x - offsetX,
                        y: (mapData.height - 1 - entity.position.y) - offsetY
                    };
                    entityId = lastEffectEvent.entityId;
                } else {
                    console.warn(`Entity ${lastEffectEvent.entityId} not found for effect`);
                    return;
                }
            } else if (lastEffectEvent.position) {
                // Static positioned effect
                const offsetX = mapData.width / 2;
                const offsetY = mapData.height / 2;
                worldPos = {
                    x: lastEffectEvent.position.x - offsetX,
                    y: (mapData.height - 1 - lastEffectEvent.position.y) - offsetY
                };
            } else {
                console.warn('Effect event missing both position and entityId');
                return;
            }

            rendererRef.current.playEffect(lastEffectEvent.effectId, worldPos, entityId);
        }
    }, [lastEffectEvent, mapData, players, monsters]);

    // Auto-follow logic
    useEffect(() => {
        if (!selectedMonsterId || !monsters[selectedMonsterId] || !players[localPlayerId || '']) return;

        const monster = monsters[selectedMonsterId];
        const player = players[localPlayerId!];

        // Check if monster moved significantly
        const monsterMoved = !lastMonsterPos.current ||
            Math.abs(monster.position.x - lastMonsterPos.current.x) > 0.1 ||
            Math.abs(monster.position.y - lastMonsterPos.current.y) > 0.1;

        if (monsterMoved) {
            lastMonsterPos.current = { x: monster.position.x, y: monster.position.y };

            // Move to monster
            const dist = Math.sqrt(
                Math.pow(player.position.x - monster.position.x, 2) +
                Math.pow(player.position.y - monster.position.y, 2)
            );

            if (dist > 1.5) {
                onMove(monster.position.x, monster.position.y);
            } else {
                // Attack if close
                const now = Date.now();
                if (now - lastAttackTime.current > 500) {
                    onAttack(selectedMonsterId);
                    lastAttackTime.current = now;
                }
            }
        } else {
            // Monster stopped moving, but we might still be moving towards it or close to it
            // Check distance
            const dist = Math.sqrt(
                Math.pow(player.position.x - monster.position.x, 2) +
                Math.pow(player.position.y - monster.position.y, 2)
            );

            if (dist <= 2) {
                const now = Date.now();
                if (now - lastAttackTime.current > 500) {
                    onAttack(selectedMonsterId);
                    lastAttackTime.current = now;
                }
            }
        }

    }, [monsters, selectedMonsterId, localPlayerId, onMove, onAttack]); // Runs when monsters update

    return (
        <canvas
            ref={canvasRef}
            style={{ width: '100%', height: '100%', display: 'block' }}
        />
    );
}
