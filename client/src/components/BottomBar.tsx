import { useEffect, useState } from 'react';

interface SkillData {
    id: string;
    icon: string;
    name: string;
}

interface BottomBarProps {
    onToggleInventory: () => void;
    skills?: string[];
    activeSkill?: string;
    isMuted?: boolean;
    onToggleMute?: () => void;
    onToggleDebug?: () => void;
    onToggleClassSelector?: () => void;
    onSkillSelect?: (skillId: string) => void;
    cooldowns?: Record<string, number>; // Map of skillId -> expirationTimestamp
    cooldownDurations?: Record<string, number>; // Map of skillId -> duration in ms
}

export function BottomBar({ onToggleInventory, skills = [], activeSkill, isMuted = false, onToggleMute, onToggleDebug, onToggleClassSelector, onSkillSelect, cooldowns = {}, cooldownDurations = {} }: BottomBarProps) {
    const [skillData, setSkillData] = useState<Record<string, SkillData>>({});
    const [, setTick] = useState(0); // Force re-render for countdown

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

    // Update countdown timer every 100ms
    useEffect(() => {
        const interval = setInterval(() => {
            setTick(t => t + 1);
        }, 100);
        return () => clearInterval(interval);
    }, []);

    // Ensure we always have 5 slots
    const slots = [0, 1, 2, 3, 4];

    return (
        <div className="bottom-bar">
            <div className="skill-bar">
                {slots.map(index => {
                    const skillId = skills[index];
                    const skill = skillId ? skillData[skillId] : null;
                    const isActive = skillId === activeSkill;
                    const cooldownEnd = skillId ? cooldowns[skillId] : undefined;
                    const cooldownDuration = skillId ? cooldownDurations[skillId] : undefined;
                    const now = Date.now();
                    const isOnCooldown = cooldownEnd && now < cooldownEnd;
                    const remainingMs = isOnCooldown ? cooldownEnd! - now : 0;
                    // Calculate progress based on actual duration
                    const totalDuration = cooldownDuration || 3000; // Fallback to 3s if not set
                    const elapsedMs = totalDuration - remainingMs;
                    const cooldownProgress = Math.min(elapsedMs / totalDuration, 1);

                    return (
                        <div
                            key={index}
                            className={`skill-slot ${isActive ? 'active' : ''} ${isOnCooldown ? 'on-cooldown' : ''}`}
                            title={skill ? skill.name : 'Empty Slot'}
                            onClick={() => {
                                if (skillId && onSkillSelect && !isOnCooldown) {
                                    onSkillSelect(skillId);
                                }
                            }}
                        >
                            {skill ? <span className="skill-icon">{skill.icon}</span> : <span className="skill-key">{index + 1}</span>}
                            {isOnCooldown && (
                                <>
                                    <div
                                        className="cooldown-fill"
                                        style={{
                                            height: `${(1 - cooldownProgress) * 100}%`
                                        }}
                                    />
                                    <div className="cooldown-text">{(remainingMs / 1000).toFixed(1)}s</div>
                                </>
                            )}
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
                <button className="menu-btn" onClick={onToggleClassSelector} title="Change Class">
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
