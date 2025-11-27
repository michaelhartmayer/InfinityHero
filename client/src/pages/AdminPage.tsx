import React, { useState, useEffect } from 'react';

// --- Types ---

interface Monster {
    id: string;
    name: string;
    baseLevel: number;
    hp: number;
    energy: number;
    passiveStrategy: string;
    attackStrategy: string;
    fleeStrategy: string;
}

interface Skill {
    id: string;
    name: string;
    description: string;
    range: number;
    icon: string;
    target: 'target' | 'self' | 'passive';
}

interface MapData {
    id: string;
    name: string;
    width: number;
    height: number;
    monsterSpawns: Array<{
        monsterId: string;
        position: { x: number; y: number };
        respawnTime: number;
    }>;
    // Simplified for editor
}

// --- Styles ---

const styles = `
    .admin-container {
        display: flex;
        height: 100vh;
        width: 100vw;
        background: #121212;
        color: #e0e0e0;
        font-family: 'Inter', sans-serif;
        overflow: hidden;
    }

    .sidebar {
        width: 250px;
        background: rgba(30, 30, 30, 0.6);
        backdrop-filter: blur(10px);
        border-right: 1px solid rgba(255, 255, 255, 0.1);
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .sidebar-header {
        font-size: 1.5rem;
        font-weight: bold;
        margin-bottom: 20px;
        background: linear-gradient(45deg, #ff00cc, #3333ff);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
    }

    .nav-item {
        padding: 12px 15px;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s;
        font-weight: 500;
    }

    .nav-item:hover {
        background: rgba(255, 255, 255, 0.05);
    }

    .nav-item.active {
        background: rgba(51, 51, 255, 0.2);
        color: #8080ff;
        border: 1px solid rgba(51, 51, 255, 0.3);
    }

    .main-content {
        flex: 1;
        padding: 30px;
        overflow-y: auto;
        background: radial-gradient(circle at top right, #1a1a2e 0%, #121212 100%);
    }

    .editor-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 30px;
    }

    .editor-title {
        font-size: 2rem;
        font-weight: bold;
    }

    .card-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 20px;
    }

    .card {
        background: rgba(40, 40, 40, 0.4);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 12px;
        padding: 20px;
        transition: transform 0.2s, box-shadow 0.2s;
        cursor: pointer;
        position: relative;
        overflow: hidden;
    }

    .card:hover {
        transform: translateY(-5px);
        box-shadow: 0 10px 20px rgba(0, 0, 0, 0.3);
        border-color: rgba(255, 255, 255, 0.1);
    }

    .card::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 4px;
        background: linear-gradient(90deg, #ff00cc, #3333ff);
        opacity: 0;
        transition: opacity 0.2s;
    }

    .card:hover::before {
        opacity: 1;
    }

    .card h3 {
        margin: 0 0 10px 0;
        font-size: 1.2rem;
    }

    .card p {
        margin: 0;
        color: #aaa;
        font-size: 0.9rem;
    }

    .form-container {
        background: rgba(30, 30, 30, 0.8);
        padding: 30px;
        border-radius: 16px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        max-width: 800px;
        margin: 0 auto;
    }

    .form-group {
        margin-bottom: 20px;
    }

    .form-label {
        display: block;
        margin-bottom: 8px;
        color: #bbb;
        font-size: 0.9rem;
    }

    .form-input, .form-select, .form-textarea {
        width: 100%;
        padding: 12px;
        background: rgba(0, 0, 0, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        color: white;
        font-size: 1rem;
        transition: border-color 0.2s;
        box-sizing: border-box;
    }

    .form-input:focus, .form-select:focus, .form-textarea:focus {
        outline: none;
        border-color: #3333ff;
    }

    .btn {
        padding: 12px 24px;
        border-radius: 8px;
        border: none;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        font-size: 1rem;
    }

    .btn-primary {
        background: linear-gradient(45deg, #3333ff, #0066ff);
        color: white;
        box-shadow: 0 4px 15px rgba(51, 51, 255, 0.3);
    }

    .btn-primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(51, 51, 255, 0.4);
    }

    .btn-secondary {
        background: rgba(255, 255, 255, 0.1);
        color: white;
        margin-right: 10px;
    }

    .btn-secondary:hover {
        background: rgba(255, 255, 255, 0.15);
    }

    .btn-danger {
        background: rgba(255, 50, 50, 0.2);
        color: #ff5555;
        border: 1px solid rgba(255, 50, 50, 0.3);
        float: right;
    }

    .btn-danger:hover {
        background: rgba(255, 50, 50, 0.3);
    }

    .json-editor {
        font-family: 'Fira Code', monospace;
        font-size: 0.9rem;
        min-height: 400px;
    }
`;

// --- Components ---

const MonsterEditor = () => {
    const [monsters, setMonsters] = useState<Monster[]>([]);
    const [editing, setEditing] = useState<Monster | null>(null);
    const [isNew, setIsNew] = useState(false);

    useEffect(() => {
        fetchMonsters();
    }, []);

    const fetchMonsters = async () => {
        const res = await fetch('http://localhost:3000/api/monsters');
        const data = await res.json();
        setMonsters(data);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editing) return;

        await fetch('http://localhost:3000/api/monsters', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(editing)
        });

        setEditing(null);
        setIsNew(false);
        fetchMonsters();
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this monster?')) return;
        await fetch(`http://localhost:3000/api/monsters/${id}`, { method: 'DELETE' });
        fetchMonsters();
        setEditing(null);
    };

    if (editing) {
        return (
            <div className="form-container">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2>{isNew ? 'Create Monster' : 'Edit Monster'}</h2>
                    <button className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
                </div>
                <form onSubmit={handleSave}>
                    <div className="form-group">
                        <label className="form-label">ID</label>
                        <input className="form-input" value={editing.id} onChange={e => setEditing({ ...editing, id: e.target.value })} disabled={!isNew} required />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Name</label>
                        <input className="form-input" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} required />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
                        <div className="form-group">
                            <label className="form-label">Level</label>
                            <input type="number" className="form-input" value={editing.baseLevel} onChange={e => setEditing({ ...editing, baseLevel: parseInt(e.target.value) })} required />
                        </div>
                        <div className="form-group">
                            <label className="form-label">HP</label>
                            <input type="number" className="form-input" value={editing.hp} onChange={e => setEditing({ ...editing, hp: parseInt(e.target.value) })} required />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Energy</label>
                            <input type="number" className="form-input" value={editing.energy} onChange={e => setEditing({ ...editing, energy: parseInt(e.target.value) })} required />
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Strategies</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
                            <input className="form-input" placeholder="Passive" value={editing.passiveStrategy} onChange={e => setEditing({ ...editing, passiveStrategy: e.target.value })} />
                            <input className="form-input" placeholder="Attack" value={editing.attackStrategy} onChange={e => setEditing({ ...editing, attackStrategy: e.target.value })} />
                            <input className="form-input" placeholder="Flee" value={editing.fleeStrategy} onChange={e => setEditing({ ...editing, fleeStrategy: e.target.value })} />
                        </div>
                    </div>
                    <div style={{ marginTop: '30px' }}>
                        <button type="submit" className="btn btn-primary">Save Monster</button>
                        {!isNew && <button type="button" className="btn btn-danger" onClick={() => handleDelete(editing.id)}>Delete</button>}
                    </div>
                </form>
            </div>
        );
    }

    return (
        <div>
            <div className="editor-header">
                <h2 className="editor-title">Monster Database</h2>
                <button className="btn btn-primary" onClick={() => {
                    setEditing({
                        id: '', name: '', baseLevel: 1, hp: 100, energy: 100,
                        passiveStrategy: 'wander', attackStrategy: 'melee_basic', fleeStrategy: 'low_hp'
                    });
                    setIsNew(true);
                }}>+ New Monster</button>
            </div>
            <div className="card-grid">
                {monsters.map(m => (
                    <div key={m.id} className="card" onClick={() => { setEditing(m); setIsNew(false); }}>
                        <h3>{m.name}</h3>
                        <p>Lvl {m.baseLevel} • {m.hp} HP</p>
                        <p style={{ marginTop: '10px', fontSize: '0.8rem', opacity: 0.7 }}>ID: {m.id}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

const SkillEditor = () => {
    const [skills, setSkills] = useState<Skill[]>([]);
    const [editing, setEditing] = useState<Skill | null>(null);
    const [isNew, setIsNew] = useState(false);

    useEffect(() => {
        fetchSkills();
    }, []);

    const fetchSkills = async () => {
        const res = await fetch('http://localhost:3000/api/skills');
        const data = await res.json();
        setSkills(data);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editing) return;

        await fetch('http://localhost:3000/api/skills', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(editing)
        });

        setEditing(null);
        setIsNew(false);
        fetchSkills();
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this skill?')) return;
        await fetch(`http://localhost:3000/api/skills/${id}`, { method: 'DELETE' });
        fetchSkills();
        setEditing(null);
    };

    if (editing) {
        return (
            <div className="form-container">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2>{isNew ? 'Create Skill' : 'Edit Skill'}</h2>
                    <button className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
                </div>
                <form onSubmit={handleSave}>
                    <div className="form-group">
                        <label className="form-label">ID</label>
                        <input className="form-input" value={editing.id} onChange={e => setEditing({ ...editing, id: e.target.value })} disabled={!isNew} required />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Name</label>
                        <input className="form-input" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} required />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Description</label>
                        <textarea className="form-textarea" rows={3} value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} required />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
                        <div className="form-group">
                            <label className="form-label">Range</label>
                            <input type="number" className="form-input" value={editing.range} onChange={e => setEditing({ ...editing, range: parseInt(e.target.value) })} required />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Icon</label>
                            <input className="form-input" value={editing.icon} onChange={e => setEditing({ ...editing, icon: e.target.value })} required />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Target Type</label>
                            <select className="form-select" value={editing.target} onChange={e => setEditing({ ...editing, target: e.target.value as any })}>
                                <option value="target">Target</option>
                                <option value="self">Self</option>
                                <option value="passive">Passive</option>
                            </select>
                        </div>
                    </div>
                    <div style={{ marginTop: '30px' }}>
                        <button type="submit" className="btn btn-primary">Save Skill</button>
                        {!isNew && <button type="button" className="btn btn-danger" onClick={() => handleDelete(editing.id)}>Delete</button>}
                    </div>
                </form>
            </div>
        );
    }

    return (
        <div>
            <div className="editor-header">
                <h2 className="editor-title">Skill Database</h2>
                <button className="btn btn-primary" onClick={() => {
                    setEditing({
                        id: '', name: '', description: '', range: 1, icon: 'sword', target: 'target'
                    });
                    setIsNew(true);
                }}>+ New Skill</button>
            </div>
            <div className="card-grid">
                {skills.map(s => (
                    <div key={s.id} className="card" onClick={() => { setEditing(s); setIsNew(false); }}>
                        <h3>{s.name}</h3>
                        <p>{s.description}</p>
                        <p style={{ marginTop: '10px', fontSize: '0.8rem', opacity: 0.7 }}>Range: {s.range} • {s.target}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

const MapEditor = () => {
    const [mapData, setMapData] = useState<MapData | null>(null);
    const [jsonContent, setJsonContent] = useState('');

    useEffect(() => {
        fetchMap();
    }, []);

    const fetchMap = async () => {
        const res = await fetch('http://localhost:3000/api/map');
        const data = await res.json();
        setMapData(data);
        setJsonContent(JSON.stringify(data, null, 4));
    };

    const handleSave = async () => {
        try {
            const parsed = JSON.parse(jsonContent);
            await fetch('http://localhost:3000/api/map', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: jsonContent
            });
            alert('Map saved successfully!');
            fetchMap();
        } catch (e) {
            alert('Invalid JSON: ' + e);
        }
    };

    if (!mapData) return <div>Loading map...</div>;

    return (
        <div>
            <div className="editor-header">
                <h2 className="editor-title">Map Editor ({mapData.name})</h2>
                <button className="btn btn-primary" onClick={handleSave}>Save Changes</button>
            </div>
            <div className="form-container" style={{ maxWidth: '100%' }}>
                <p style={{ marginBottom: '20px', color: '#aaa' }}>
                    Direct JSON editing is enabled for full control over map properties, regions, and spawns.
                </p>
                <textarea
                    className="form-textarea json-editor"
                    value={jsonContent}
                    onChange={e => setJsonContent(e.target.value)}
                    spellCheck={false}
                />
            </div>
        </div>
    );
};

export function AdminPage() {
    const [activeTab, setActiveTab] = useState('monsters');

    return (
        <>
            <style>{styles}</style>
            <div className="admin-container">
                <div className="sidebar">
                    <div className="sidebar-header">VibeMaster Admin</div>
                    <div className={`nav-item ${activeTab === 'monsters' ? 'active' : ''}`} onClick={() => setActiveTab('monsters')}>
                        👾 Monsters
                    </div>
                    <div className={`nav-item ${activeTab === 'skills' ? 'active' : ''}`} onClick={() => setActiveTab('skills')}>
                        ⚔️ Skills
                    </div>
                    <div className={`nav-item ${activeTab === 'map' ? 'active' : ''}`} onClick={() => setActiveTab('map')}>
                        🗺️ Map
                    </div>
                </div>
                <div className="main-content">
                    {activeTab === 'monsters' && <MonsterEditor />}
                    {activeTab === 'skills' && <SkillEditor />}
                    {activeTab === 'map' && <MapEditor />}
                </div>
            </div>
        </>
    );
}
