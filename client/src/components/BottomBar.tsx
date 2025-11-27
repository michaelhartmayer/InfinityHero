interface BottomBarProps {
    onToggleInventory: () => void;
}

export function BottomBar({ onToggleInventory }: BottomBarProps) {
    const skills = [1, 2, 3, 4, 5];

    return (
        <div className="bottom-bar">
            <div className="skill-bar">
                {skills.map(s => (
                    <div key={s} className="skill-slot">
                        <span className="skill-key">{s}</span>
                    </div>
                ))}
            </div>

            <div className="menu-bar">
                <button className="menu-btn" onClick={onToggleInventory} title="Inventory (I)">
                    🎒
                </button>
                <button className="menu-btn" title="Character (C)">
                    👤
                </button>
                <button className="menu-btn" title="Settings">
                    ⚙️
                </button>
            </div>
        </div>
    );
}
