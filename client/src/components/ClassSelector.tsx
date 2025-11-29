import { useEffect, useState } from 'react';

interface ClassData {
    id: string;
    name: string;
    description: string;
    icon: string;
    baseHp: number;
    baseEnergy: number;
}

interface ClassSelectorProps {
    currentClassId: string;
    onSelectClass: (classId: string) => void;
    onClose: () => void;
}

export function ClassSelector({ currentClassId, onSelectClass, onClose }: ClassSelectorProps) {
    const [classes, setClasses] = useState<ClassData[]>([]);

    useEffect(() => {
        fetch('/api/classes')
            .then(res => res.json())
            .then(data => setClasses(data))
            .catch(err => console.error("Failed to load classes:", err));
    }, []);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content class-selector" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Select Class</h2>
                    <button className="close-btn" onClick={onClose}>&times;</button>
                </div>
                <div className="class-grid">
                    {classes.map(cls => (
                        <div
                            key={cls.id}
                            className={`class-card ${cls.id === currentClassId ? 'active' : ''}`}
                            onClick={() => {
                                onSelectClass(cls.id);
                                onClose();
                            }}
                        >
                            <div className="class-icon">{cls.icon}</div>
                            <div className="class-info">
                                <h3>{cls.name}</h3>
                                <p>{cls.description}</p>
                                <div className="class-stats">
                                    <span>❤️ {cls.baseHp}</span>
                                    <span>⚡ {cls.baseEnergy}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
