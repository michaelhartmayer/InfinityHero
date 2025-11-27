import { useEffect, useRef, useState } from 'react';
import { GameRenderer } from '../game/GameRenderer';
import type { WorldMap, Player, Item, Monster, ChatMessage } from '@vibemaster/shared';

interface GameCanvasProps {
    mapData: WorldMap | null;
    players: Record<string, Player>;
    items: Record<string, Item>;
    monsters: Record<string, Monster>;
    localPlayerId: string | null;
    lastMessage: ChatMessage | null;
    onMove: (x: number, y: number) => void;
}

export function GameCanvas({ mapData, players, items, monsters, localPlayerId, lastMessage, onMove }: GameCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rendererRef = useRef<GameRenderer | null>(null);
    const [selectedMonsterId, setSelectedMonsterId] = useState<string | null>(null);
    const lastMonsterPos = useRef<{ x: number, y: number } | null>(null);

    useEffect(() => {
        if (!canvasRef.current) return;

        // Initialize renderer
        rendererRef.current = new GameRenderer(canvasRef.current, localPlayerId);

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

            const target = rendererRef.current.screenToWorld(x, y, rect.width, rect.height, mapData);
            if (target) {
                rendererRef.current.setHighlight(target.x, target.y, mapData);
            }
        };

        window.addEventListener('resize', handleResize);
        canvasRef.current.addEventListener('mousedown', handleClick);
        canvasRef.current.addEventListener('mousemove', handleMouseMove);

        handleResize(); // Initial size

        return () => {
            window.removeEventListener('resize', handleResize);
            canvasRef.current?.removeEventListener('mousedown', handleClick);
            canvasRef.current?.removeEventListener('mousemove', handleMouseMove);
        };
    }, [localPlayerId]); // Re-init if localPlayerId changes

    // Update renderer
    useEffect(() => {
        if (mapData && rendererRef.current) {
            rendererRef.current.renderMap(mapData);
        }
    }, [mapData]);

    useEffect(() => {
        if (rendererRef.current && mapData) {
            rendererRef.current.updatePlayers(players, mapData);
            rendererRef.current.updateItems(items, mapData);
            rendererRef.current.updateMonsters(monsters, mapData);

            // Ensure selection is maintained visually
            if (selectedMonsterId) {
                rendererRef.current.selectMonster(selectedMonsterId, monsters, mapData);
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
            }
        } else {
            // Monster stopped moving?
            // If we are close enough, we stop following?
            // Or if we haven't reached it, we keep going (which onMove handles)
        }

    }, [monsters, selectedMonsterId, localPlayerId, onMove]); // Runs when monsters update

    return (
        <canvas
            ref={canvasRef}
            style={{ width: '100%', height: '100%', display: 'block' }}
        />
    );
}
