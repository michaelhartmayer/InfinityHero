import { type Player } from '@vibemaster/shared';
import { useEffect, useState } from 'react';

interface ClassData {
    id: string;
    name: string;
    icon: string;
}

interface HUDProps {
    player: Player;
}

export function HUD({ player }: HUDProps) {
    const [classData, setClassData] = useState<Record<string, ClassData>>({});

    useEffect(() => {
        fetch('/api/classes')
            .then(res => res.json())
            .then((data: ClassData[]) => {
                const map: Record<string, ClassData> = {};
                data.forEach(c => map[c.id] = c);
                setClassData(map);
            })
            .catch(err => console.error("Failed to load class data:", err));
    }, []);

    const classInfo = classData[player.class];

    return (
        <div className="hud-container">
            <div className="hud-profile">
                <div className="hud-avatar">
                    {classInfo?.icon || '👤'}
                </div>
                <div className="hud-info">
                    <div className="hud-name">{player.name}</div>
                    <div className="hud-level">Lvl {player.level} {classInfo?.name || 'Hero'}</div>
                </div>
            </div>

            <div className="hud-bars">
                <div className="bar-container">
                    <div className="bar-text">{Math.floor(player.hp)} / {player.maxHp} HP</div>
                    <div className="bar-track">
                        <div
                            className="bar-fill hp-fill"
                            style={{ width: `${(player.hp / player.maxHp) * 100}%` }}
                        />
                    </div>
                </div>
                <div className="bar-container">
                    <div className="bar-text">{Math.floor(player.energy)} / {player.maxEnergy} EP</div>
                    <div className="bar-track">
                        <div
                            className="bar-fill energy-fill"
                            style={{ width: `${(player.energy / player.maxEnergy) * 100}%` }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
