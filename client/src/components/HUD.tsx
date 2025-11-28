import { type Player } from '@vibemaster/shared';

interface HUDProps {
    player: Player;
}

export function HUD({ player }: HUDProps) {
    const hpPercent = Math.max(0, Math.min(100, (player.hp / player.maxHp) * 100));
    const energyPercent = Math.max(0, Math.min(100, (player.energy / player.maxEnergy) * 100));

    return (
        <div className="hud-container">
            <div className="hud-profile">
                <div className="hud-avatar">
                    {(() => {
                        switch (player.class) {
                            case 'warrior': return '⚔️';
                            case 'mage': return '🔮';
                            case 'rogue': return '🗡️';
                            case 'cleric': return '✝️';
                            case 'ranger': return '🏹';
                            case 'paladin': return '🛡️';
                            default: return '❓';
                        }
                    })()}
                </div>
                <div className="hud-info">
                    <div className="hud-name">{player.name}</div>
                    <div className="hud-level">Lvl {player.level}</div>
                </div>
            </div>

            <div className="hud-bars">
                <div className="bar-container hp-bar-container">
                    <div className="bar-track">
                        <div className="bar-fill hp-fill" style={{ width: `${hpPercent}%` }}></div>
                        <div className="bar-text">{Math.floor(player.hp)} / {player.maxHp}</div>
                    </div>
                </div>
                <div className="bar-container energy-bar-container">
                    <div className="bar-track">
                        <div className="bar-fill energy-fill" style={{ width: `${energyPercent}%` }}></div>
                        <div className="bar-text">{Math.floor(player.energy)} / {player.maxEnergy}</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
