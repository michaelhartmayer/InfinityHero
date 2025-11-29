import { useEffect, useState } from 'react';

interface SkillData {
    id: string;
    icon: string;
    name: string;
}

interface BottomBarProps {
    onToggleInventory: () => void;
    skills?: string[];
    isMuted?: boolean;
    onToggleMute?: () => void;
    onToggleDebug?: () => void;
}

export function BottomBar({ onToggleInventory, skills = [], isMuted = false, onToggleMute, onToggleDebug }: BottomBarProps) {
    const [skillData, setSkillData] = useState<Record<string, SkillData>>({});

    useEffect(() => {
        fetch('/api/skills')
            .then(res => res.json())
            .then((data: SkillData[]) => {
                const map: Record<string, SkillData> = {};
                data.forEach(s => map[s.id] = s);
                setSkillData(map);
            })
            .catch(err => console.error("Failed to load skills:", err));
    }, []);

    // Ensure we always have 5 slots
    const slots = [0, 1, 2, 3, 4];

    return (
        <div className="bottom-bar">
            <div className="skill-bar">
                {slots.map(index => {
                    const skillId = skills[index];
                    const skill = skillId ? skillData[skillId] : null;

                    return (
                        <div key={index} className="skill-slot" title={skill ? skill.name : 'Empty Slot'}>
                            {skill ? <span className="skill-icon">{skill.icon}</span> : <span className="skill-key">{index + 1}</span>}
                        </div>
                    );
                })}
            </div>

            <div className="menu-bar">
                {onToggleMute && (
                    <button
                        className="menu-btn"
                        onClick={onToggleMute}
                        title={isMuted ? "Unmute Audio" : "Mute Audio"}
                    >
                        {isMuted ? '🔇' : '🔊'}
                    </button>
                )}
                <button className="menu-btn" onClick={onToggleInventory} title="Inventory (I)">
                    🎒
                </button>
                <button className="menu-btn" title="Character (C)">
                    👤
                </button>
                <button className="menu-btn" title="Settings">
                    ⚙️
                </button>
                {onToggleDebug && (
                    <button className="menu-btn" onClick={onToggleDebug} title="Toggle Debug Info">
                        🐛
                    </button>
                )}
            </div>
        </div>
    );
}
