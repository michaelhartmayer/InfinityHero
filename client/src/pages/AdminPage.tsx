import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, NavLink, useNavigate, useParams, Navigate } from 'react-router-dom';

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

interface Sprite {
    id: string;
    name: string;
    type: 'character' | 'prop' | 'effect' | 'ui';
    texture: string;
    frameWidth: number;
    frameHeight: number;
    animations: Record<string, {
        frames: number[];
        frameRate: number;
        loop: boolean;
    }>;
}

interface MapData {
    id: string;
    name: string;
    width: number;
    height: number;
    description?: string;
    spawnPoints?: Array<{ x: number; y: number; type: string }>;
    tiles?: {
        default: {
            type: string;
            walkable: boolean;
            tileset: string;
        };
        regions: any[];
    };
    monsterSpawns: Array<{
        monsterId: string;
        position: { x: number; y: number };
        respawnTime: number;
    }>;
    itemSpawns?: Array<{
        itemId: string;
        position: { x: number; y: number };
        respawnTime: number;
    }>;
    metadata?: {
        difficulty: string;
        recommendedLevel: number;
        maxPlayers: number;
        theme: string;
        music?: string;
        ambientSound?: string;
    };
    placedSwatches?: Array<{
        x: number;
        y: number;
        swatchId: string;
        instanceId: string;
    }>;
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

const MonsterList = () => {
    const [monsters, setMonsters] = useState<Monster[]>([]);
    const navigate = useNavigate();

    useEffect(() => {
        fetchMonsters();
    }, []);

    const fetchMonsters = async () => {
        const res = await fetch('http://localhost:3000/api/monsters');
        const data = await res.json();
        setMonsters(data);
    };

    return (
        <div>
            <div className="editor-header">
                <h2 className="editor-title">Monster Database</h2>
                <button className="btn btn-primary" onClick={() => navigate('new')}>+ New Monster</button>
            </div>
            <div className="card-grid">
                {monsters.map(m => (
                    <div key={m.id} className="card" onClick={() => navigate(m.id)}>
                        <h3>{m.name}</h3>
                        <p>Lvl {m.baseLevel} • {m.hp} HP</p>
                        <p style={{ marginTop: '10px', fontSize: '0.8rem', opacity: 0.7 }}>ID: {m.id}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

const MonsterForm = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [editing, setEditing] = useState<Monster | null>(null);
    const isNew = !id;

    useEffect(() => {
        if (!isNew && id) {
            // Fetch specific monster
            fetch(`http://localhost:3000/api/monsters/${id}`) // Assuming this endpoint exists or we fetch all and find
                .then(res => res.json())
                .then(data => {
                    // If the API returns the specific monster, great. If it returns all, we filter.
                    // The original code fetched all. Let's assume we can fetch all and find for now to be safe,
                    // or better, let's assume the API supports get by ID or we just fetch all.
                    // Actually, looking at handleDelete, it uses /api/monsters/${id}, so likely GET /api/monsters/${id} works?
                    // If not, we might need to fetch all. Let's try fetch all and find to be safe if we are unsure,
                    // but standard REST implies GET /:id.
                    // Let's try to fetch all and find, to match previous behavior's reliability if we aren't sure about backend.
                    // Wait, previous code: fetchMonsters() -> /api/monsters (GET).
                    // handleDelete -> /api/monsters/${id} (DELETE).
                    // Let's assume GET /api/monsters/${id} exists. If not, I'll fix it.
                    // Actually, to be safe and consistent with previous code which only used fetchMonsters,
                    // I will fetch all and find.
                    return fetch('http://localhost:3000/api/monsters').then(r => r.json()).then((all: Monster[]) => {
                        const found = all.find(m => m.id === id);
                        if (found) setEditing(found);
                    });
                });
        } else {
            setEditing({
                id: '', name: '', baseLevel: 1, hp: 100, energy: 100,
                passiveStrategy: 'wander', attackStrategy: 'melee_basic', fleeStrategy: 'low_hp'
            });
        }
    }, [id, isNew]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editing) return;

        await fetch('http://localhost:3000/api/monsters', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(editing)
        });

        navigate('..');
    };

    const handleDelete = async () => {
        if (!editing || !confirm('Are you sure you want to delete this monster?')) return;
        await fetch(`http://localhost:3000/api/monsters/${editing.id}`, { method: 'DELETE' });
        navigate('..');
    };

    if (!editing) return <div>Loading...</div>;

    return (
        <div className="form-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2>{isNew ? 'Create Monster' : 'Edit Monster'}</h2>
                <button className="btn btn-secondary" onClick={() => navigate('..')}>Cancel</button>
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
                    {!isNew && <button type="button" className="btn btn-danger" onClick={handleDelete}>Delete</button>}
                </div>
            </form>
        </div>
    );
};

const MonsterEditor = () => {
    return (
        <Routes>
            <Route path="/" element={<MonsterList />} />
            <Route path="new" element={<MonsterForm />} />
            <Route path=":id" element={<MonsterForm />} />
        </Routes>
    );
};

const SkillList = () => {
    const [skills, setSkills] = useState<Skill[]>([]);
    const navigate = useNavigate();

    useEffect(() => {
        fetchSkills();
    }, []);

    const fetchSkills = async () => {
        const res = await fetch('http://localhost:3000/api/skills');
        const data = await res.json();
        setSkills(data);
    };

    return (
        <div>
            <div className="editor-header">
                <h2 className="editor-title">Skill Database</h2>
                <button className="btn btn-primary" onClick={() => navigate('new')}>+ New Skill</button>
            </div>
            <div className="card-grid">
                {skills.map(s => (
                    <div key={s.id} className="card" onClick={() => navigate(s.id)}>
                        <h3>{s.name}</h3>
                        <p>{s.description}</p>
                        <p style={{ marginTop: '10px', fontSize: '0.8rem', opacity: 0.7 }}>Range: {s.range} • {s.target}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

const SkillForm = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [editing, setEditing] = useState<Skill | null>(null);
    const isNew = !id;

    useEffect(() => {
        if (!isNew && id) {
            fetch('http://localhost:3000/api/skills')
                .then(res => res.json())
                .then((all: Skill[]) => {
                    const found = all.find(s => s.id === id);
                    if (found) setEditing(found);
                });
        } else {
            setEditing({
                id: '', name: '', description: '', range: 1, icon: 'sword', target: 'target'
            });
        }
    }, [id, isNew]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editing) return;

        await fetch('http://localhost:3000/api/skills', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(editing)
        });

        navigate('..');
    };

    const handleDelete = async () => {
        if (!editing || !confirm('Are you sure you want to delete this skill?')) return;
        await fetch(`http://localhost:3000/api/skills/${editing.id}`, { method: 'DELETE' });
        navigate('..');
    };

    if (!editing) return <div>Loading...</div>;

    return (
        <div className="form-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2>{isNew ? 'Create Skill' : 'Edit Skill'}</h2>
                <button className="btn btn-secondary" onClick={() => navigate('..')}>Cancel</button>
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
                    {!isNew && <button type="button" className="btn btn-danger" onClick={handleDelete}>Delete</button>}
                </div>
            </form>
        </div>
    );
};

const SkillEditor = () => {
    return (
        <Routes>
            <Route path="/" element={<SkillList />} />
            <Route path="new" element={<SkillForm />} />
            <Route path=":id" element={<SkillForm />} />
        </Routes>
    );
};

const SwatchPreview = ({ swatch, image }: { swatch: any, image?: HTMLImageElement }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !swatch.tiles || swatch.tiles.length === 0) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const xs = swatch.tiles.map((t: any) => t.x);
        const ys = swatch.tiles.map((t: any) => t.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        const width = maxX - minX + swatch.gridSize;
        const height = maxY - minY + swatch.gridSize;

        canvas.width = width;
        canvas.height = height;

        ctx.clearRect(0, 0, width, height);

        if (image) {
            swatch.tiles.forEach((t: any) => {
                ctx.drawImage(
                    image,
                    t.x, t.y, swatch.gridSize, swatch.gridSize,
                    t.x - minX, t.y - minY, swatch.gridSize, swatch.gridSize
                );
            });
        } else {
            ctx.fillStyle = '#444';
            swatch.tiles.forEach((t: any) => {
                ctx.fillRect(t.x - minX, t.y - minY, swatch.gridSize, swatch.gridSize);
                ctx.strokeStyle = '#666';
                ctx.strokeRect(t.x - minX, t.y - minY, swatch.gridSize, swatch.gridSize);
            });
        }
    }, [swatch, image]);

    if (!swatch.tiles || swatch.tiles.length === 0) return <div style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>No Preview</div>;

    const xs = swatch.tiles.map((t: any) => t.x);
    const ys = swatch.tiles.map((t: any) => t.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const width = maxX - minX + swatch.gridSize;
    const height = maxY - minY + swatch.gridSize;

    const CONTAINER_SIZE = 60;
    const scale = Math.min(CONTAINER_SIZE / width, CONTAINER_SIZE / height, 1);

    return (
        <div style={{
            width: '100%',
            height: CONTAINER_SIZE,
            position: 'relative',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: '5px',
            background: 'rgba(0,0,0,0.3)',
            borderRadius: '4px'
        }}>
            <canvas
                ref={canvasRef}
                style={{
                    transform: `scale(${scale})`,
                    transformOrigin: 'center center',
                    imageRendering: 'pixelated'
                }}
            />
        </div>
    );
};

const MapList = () => {
    const [mapList, setMapList] = useState<string[]>([]);
    const [activeMapId, setActiveMapId] = useState<string | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        fetchMapList();
        fetchActiveMap();
    }, []);

    const fetchMapList = async () => {
        const res = await fetch('http://localhost:3000/api/maps');
        const data = await res.json();
        setMapList(data);
    };

    const fetchActiveMap = async () => {
        const res = await fetch('http://localhost:3000/api/active-map');
        const data = await res.json();
        setActiveMapId(data.id);
    };

    const handleCreateMap = async () => {
        const name = prompt("Enter new Map name:");
        if (!name) return;
        const id = name.toLowerCase().replace(/\s+/g, '_');

        if (mapList.includes(id)) {
            alert("Map ID already exists!");
            return;
        }

        const newMap: MapData = {
            id,
            name,
            width: 50,
            height: 50,
            description: "New Map",
            spawnPoints: [],
            tiles: {
                default: { type: "grass", walkable: true, tileset: "grass" },
                regions: []
            },
            monsterSpawns: [],
            itemSpawns: [],
            metadata: {
                difficulty: "easy",
                recommendedLevel: 1,
                maxPlayers: 10,
                theme: "forest"
            },
            placedSwatches: []
        };

        await fetch('http://localhost:3000/api/map', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newMap)
        });

        fetchMapList();
        navigate(id);
    };

    const handleDeleteMap = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (id === activeMapId) {
            alert("Cannot delete the currently active map!");
            return;
        }
        if (!confirm(`Are you sure you want to delete map "${id}"?`)) return;

        await fetch(`http://localhost:3000/api/maps/${id}`, {
            method: 'DELETE'
        });

        fetchMapList();
    };

    const handleSetActiveMap = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm(`Set "${id}" as the active server map? This will reload the world for all players.`)) return;

        await fetch('http://localhost:3000/api/active-map', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        setActiveMapId(id);
        alert(`Map "${id}" is now active!`);
    };

    return (
        <div>
            <div className="editor-header">
                <h2 className="editor-title">Maps</h2>
                <button className="btn btn-primary" onClick={handleCreateMap}>+ New Map</button>
            </div>
            <div className="card-grid">
                {mapList.map(id => (
                    <div key={id} className="card" onClick={() => navigate(id)} style={{ border: activeMapId === id ? '2px solid #00ff00' : undefined }}>
                        <h3>{id}</h3>
                        <p>Map ID: {id}</p>
                        {activeMapId === id && <p style={{ color: '#00ff00', fontWeight: 'bold' }}>Currently Active</p>}
                        <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between' }}>
                            {activeMapId !== id && (
                                <button
                                    className="btn btn-secondary"
                                    style={{ padding: '5px 10px', fontSize: '0.8rem' }}
                                    onClick={(e) => handleSetActiveMap(id, e)}
                                >
                                    Set Active
                                </button>
                            )}
                            <button
                                className="btn btn-danger"
                                style={{ padding: '5px 10px', fontSize: '0.8rem' }}
                                onClick={(e) => handleDeleteMap(id, e)}
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const MapEditView = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [mapData, setMapData] = useState<MapData | null>(null);
    const [swatchSets, setSwatchSets] = useState<any[]>([]);
    const [activeSetId, setActiveSetId] = useState<string>('default_set');
    const [selectedSwatch, setSelectedSwatch] = useState<any | null>(null);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Resource Cache
    const [tilesetImages, setTilesetImages] = useState<Record<string, HTMLImageElement>>({});
    const [tilesetMetadata, setTilesetMetadata] = useState<Record<string, any>>({});

    useEffect(() => {
        fetchSwatches();
        if (id) fetchMap(id);
    }, [id]);

    // Load Tileset Resources
    useEffect(() => {
        const loadResources = async () => {
            const uniqueTilesets = new Set<string>();
            swatchSets.forEach(set => {
                set.swatches.forEach((s: any) => {
                    if (s.tileset) uniqueTilesets.add(s.tileset);
                });
            });

            const newImages: Record<string, HTMLImageElement> = { ...tilesetImages };
            const newMetadata: Record<string, any> = { ...tilesetMetadata };
            let hasUpdates = false;

            for (const tileset of Array.from(uniqueTilesets)) {
                if (!newImages[tileset]) {
                    try {
                        const res = await fetch(`http://localhost:3000/api/tilesets/${tileset}`);
                        const data = await res.json();
                        newMetadata[tileset] = data;

                        const img = new Image();
                        img.src = `/assets/tilesets/${data.texture}`;
                        await new Promise((resolve, reject) => {
                            img.onload = resolve;
                            img.onerror = reject;
                        });
                        newImages[tileset] = img;
                        hasUpdates = true;
                    } catch (e) {
                        console.error(`Failed to load tileset ${tileset}`, e);
                    }
                }
            }

            if (hasUpdates) {
                setTilesetImages(newImages);
                setTilesetMetadata(newMetadata);
            }
        };

        if (swatchSets.length > 0) {
            loadResources();
        }
    }, [swatchSets]);

    const fetchMap = async (id: string) => {
        const res = await fetch(`http://localhost:3000/api/maps/${id}`);
        const data = await res.json();
        if (!data.placedSwatches) data.placedSwatches = [];
        setMapData(data);
    };

    const fetchSwatches = async () => {
        const res = await fetch('http://localhost:3000/api/swatches');
        const data = await res.json();
        setSwatchSets(data);
        if (data.length > 0) setActiveSetId(data[0].id);
    };

    const handleSave = async () => {
        if (!mapData) return;
        const res = await fetch('http://localhost:3000/api/map', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(mapData)
        });
        if (res.ok) {
            alert('Map saved successfully!');
        } else {
            alert('Failed to save map!');
        }
    };

    // Canvas Rendering Loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !mapData) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        if (containerRef.current) {
            canvas.width = containerRef.current.clientWidth;
            canvas.height = containerRef.current.clientHeight;
        }

        // Clear
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.save();

        // Apply Pan and Zoom
        ctx.translate(pan.x, pan.y);
        ctx.scale(zoom, zoom);

        // Draw Map Background
        ctx.fillStyle = '#222';
        ctx.fillRect(0, 0, mapData.width * 32, mapData.height * 32);

        // Draw Grid
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1 / zoom;
        ctx.beginPath();
        for (let x = 0; x <= mapData.width * 32; x += 32) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, mapData.height * 32);
        }
        for (let y = 0; y <= mapData.height * 32; y += 32) {
            ctx.moveTo(0, y);
            ctx.lineTo(mapData.width * 32, y);
        }
        ctx.stroke();

        // Draw Placed Swatches
        if (mapData.placedSwatches) {
            // Optimization: Create a swatch lookup map
            const swatchMap = new Map();
            swatchSets.forEach(set => {
                set.swatches.forEach((s: any) => swatchMap.set(s.id, s));
            });

            mapData.placedSwatches.forEach(p => {
                const swatch = swatchMap.get(p.swatchId);
                if (!swatch) return;

                const img = tilesetImages[swatch.tileset];
                if (!img) return;

                swatch.tiles.forEach((t: any) => {
                    let minX = Infinity, minY = Infinity;
                    swatch.tiles.forEach((st: any) => {
                        if (st.x < minX) minX = st.x;
                        if (st.y < minY) minY = st.y;
                    });

                    const mapGridSize = 32;
                    const swatchGridSize = swatch.gridSize || 32;
                    const scale = mapGridSize / swatchGridSize;

                    const drawX = p.x + (t.x - minX) * scale;
                    const drawY = p.y + (t.y - minY) * scale;

                    ctx.drawImage(
                        img,
                        t.x, t.y, swatchGridSize, swatchGridSize, // Source
                        drawX, drawY, mapGridSize, mapGridSize // Destination
                    );
                });
            });
        }

        ctx.restore();

    }, [mapData, pan, zoom, tilesetImages, tilesetMetadata, swatchSets]);

    const handleWheel = (e: React.WheelEvent) => {
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        setZoom(z => Math.min(Math.max(z * delta, 0.1), 5));
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button === 1) {
            setIsPanning(true);
            return;
        }
        if (e.button === 0 && selectedSwatch && mapData) {
            placeSwatch(e);
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isPanning) {
            setPan(p => ({ x: p.x + e.movementX, y: p.y + e.movementY }));
        } else if (e.buttons === 1 && selectedSwatch) {
            placeSwatch(e);
        }
    };

    const handleMouseUp = () => {
        setIsPanning(false);
    };

    const placeSwatch = (e: React.MouseEvent) => {
        if (!mapData || !selectedSwatch || !containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left - pan.x) / zoom;
        const y = (e.clientY - rect.top - pan.y) / zoom;

        const gridSize = 32;
        const gx = Math.floor(x / gridSize) * gridSize;
        const gy = Math.floor(y / gridSize) * gridSize;

        const existingIndex = mapData.placedSwatches?.findIndex(p => p.x === gx && p.y === gy);

        const newPlacement = {
            x: gx,
            y: gy,
            swatchId: selectedSwatch.id,
            instanceId: Math.random().toString(36).substr(2, 9)
        };

        let newPlacedSwatches = [...(mapData.placedSwatches || [])];
        if (existingIndex !== undefined && existingIndex >= 0) {
            newPlacedSwatches[existingIndex] = newPlacement;
        } else {
            newPlacedSwatches.push(newPlacement);
        }

        setMapData({
            ...mapData,
            placedSwatches: newPlacedSwatches
        });
    };

    const activeSet = swatchSets.find(s => s.id === activeSetId);
    const activeSwatches = activeSet ? activeSet.swatches : [];

    if (!mapData) return <div>Loading map...</div>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="editor-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <button className="btn btn-secondary" onClick={() => navigate('..')}>← Back</button>
                    <h2 className="editor-title">Editing: {mapData.name}</h2>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn btn-primary" onClick={handleSave}>Save Map</button>
                    <button className="btn btn-secondary" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>Reset View</button>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '20px', flex: 1, overflow: 'hidden' }}>
                {/* Left Panel: Swatches */}
                <div style={{ width: '250px', display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px' }}>
                    <h4>Palette</h4>
                    <select
                        className="form-select"
                        value={activeSetId}
                        onChange={e => setActiveSetId(e.target.value)}
                    >
                        {swatchSets.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>

                    <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '8px', alignContent: 'start' }}>
                        {activeSwatches.map((s: any) => (
                            <div
                                key={s.id}
                                onClick={() => setSelectedSwatch(s)}
                                style={{
                                    cursor: 'pointer',
                                    borderRadius: '4px',
                                    border: selectedSwatch?.id === s.id ? '2px solid #ffcc00' : '1px solid #444',
                                    background: '#222',
                                    padding: '8px',
                                    textAlign: 'center',
                                    fontSize: '0.7rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center'
                                }}
                            >
                                <SwatchPreview swatch={s} image={tilesetImages[s.tileset]} />
                                <div style={{ fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{s.name}</div>
                            </div>
                        ))}
                    </div>
                    <div style={{ marginTop: '10px', fontSize: '0.8rem', color: '#aaa' }}>
                        Selected: {selectedSwatch ? selectedSwatch.name : 'None'}
                    </div>
                </div>

                {/* Map View */}
                <div
                    ref={containerRef}
                    style={{
                        flex: 1,
                        background: '#1a1a1a',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        position: 'relative',
                        userSelect: 'none',
                        cursor: isPanning ? 'grabbing' : 'crosshair'
                    }}
                    onWheel={handleWheel}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                >
                    <canvas
                        ref={canvasRef}
                        style={{ display: 'block', width: '100%', height: '100%' }}
                    />
                </div>
            </div>
        </div>
    );
};

const MapEditor = () => {
    return (
        <Routes>
            <Route path="/" element={<MapList />} />
            <Route path=":id" element={<MapEditView />} />
        </Routes>
    );
};

const TilesetView = () => {
    const { name } = useParams();
    const navigate = useNavigate();
    const selectedTileset = name || null;

    const [tilesets, setTilesets] = useState<string[]>([]);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [gridSize, setGridSize] = useState(32);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });

    // Selection state
    const [isSelecting, setIsSelecting] = useState(false);
    const [isPanning, setIsPanning] = useState(false);
    const [selectionStart, setSelectionStart] = useState<{ x: number, y: number } | null>(null);
    const [selectionEnd, setSelectionEnd] = useState<{ x: number, y: number } | null>(null);
    const [clickMode, setClickMode] = useState(false); // New Click Mode

    // Swatch Data
    const [swatchSets, setSwatchSets] = useState<any[]>([]);
    const [activeSetId, setActiveSetId] = useState<string>('');

    // Resource Cache
    const [tilesetImages, setTilesetImages] = useState<Record<string, HTMLImageElement>>({});

    // Swatch Builder State
    const [swatchName, setSwatchName] = useState('');
    const [swatchWalkable, setSwatchWalkable] = useState(true);

    // Container ref for fit-to-view calculation
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchTilesets();
        fetchSwatches();
    }, []);

    useEffect(() => {
        if (selectedTileset) {
            fetchTilesetData(selectedTileset);
        } else {
            setPreviewImage(null);
            setSelectionStart(null);
            setSelectionEnd(null);
        }
    }, [selectedTileset]);

    useEffect(() => {
        const loadResources = async () => {
            const uniqueTilesets = new Set<string>();
            swatchSets.forEach(set => {
                set.swatches.forEach((s: any) => {
                    if (s.tileset) uniqueTilesets.add(s.tileset);
                });
            });

            const newImages: Record<string, HTMLImageElement> = { ...tilesetImages };
            let hasUpdates = false;

            for (const tileset of Array.from(uniqueTilesets)) {
                if (!newImages[tileset]) {
                    try {
                        const res = await fetch(`http://localhost:3000/api/tilesets/${tileset}`);
                        const data = await res.json();

                        const img = new Image();
                        img.src = `/assets/tilesets/${data.texture}`;
                        await new Promise((resolve, reject) => {
                            img.onload = resolve;
                            img.onerror = reject;
                        });
                        newImages[tileset] = img;
                        hasUpdates = true;
                    } catch (e) {
                        console.error(`Failed to load tileset ${tileset}`, e);
                    }
                }
            }

            if (hasUpdates) {
                setTilesetImages(newImages);
            }
        };

        if (swatchSets.length > 0) {
            loadResources();
        }
    }, [swatchSets]);

    const fetchTilesets = async () => {
        const res = await fetch('http://localhost:3000/api/tilesets');
        const data = await res.json();
        setTilesets(data);
    };

    const fetchSwatches = async () => {
        const res = await fetch('http://localhost:3000/api/swatches');
        const data = await res.json();
        setSwatchSets(data);
        if (data.length > 0 && (!activeSetId || !data.find((s: any) => s.id === activeSetId))) {
            setActiveSetId(data[0].id);
        }
    };

    const fetchTilesetData = async (name: string) => {
        const res = await fetch(`http://localhost:3000/api/tilesets/${name}`);
        const data = await res.json();
        if (data.texture) setPreviewImage(data.texture);
        if (data.tileSize) setGridSize(data.tileSize);
        setSelectionStart(null);
        setSelectionEnd(null);
    };

    const handleSelect = (name: string) => {
        if (selectedTileset === name) return;
        navigate(name);
    };

    const handleSwatchClick = async (swatch: any) => {
        // 1. Select the tileset if not already selected
        if (selectedTileset !== swatch.tileset) {
            navigate(swatch.tileset);
        }

        // 2. Set form data
        setSwatchName(swatch.name);
        setSwatchWalkable(swatch.properties?.walkable ?? true);
        if (swatch.gridSize) setGridSize(swatch.gridSize);

        // 3. Highlight the swatch area (calculate bounding box)
        if (swatch.tiles && swatch.tiles.length > 0) {
            const xs = swatch.tiles.map((t: any) => t.x);
            const ys = swatch.tiles.map((t: any) => t.y);
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);

            setSelectionStart({ x: minX, y: minY });
            setSelectionEnd({ x: maxX, y: maxY });
        }
    };

    const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        if (containerRef.current) {
            const img = e.currentTarget;
            const container = containerRef.current;
            const widthRatio = container.clientWidth / img.naturalWidth;
            const heightRatio = container.clientHeight / img.naturalHeight;
            const fitZoom = Math.min(widthRatio, heightRatio) * 0.9; // 90% fit
            setZoom(fitZoom);

            // Center it
            const x = (container.clientWidth - img.naturalWidth * fitZoom) / 2;
            const y = (container.clientHeight - img.naturalHeight * fitZoom) / 2;
            setPan({ x, y });
        }
    };

    const saveSwatchSets = async (newSets: any[]) => {
        await fetch('http://localhost:3000/api/swatches', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newSets)
        });
        setSwatchSets(newSets);
    };

    const createSet = () => {
        const name = prompt("Enter new Swatch Set name:");
        if (!name) return;
        const id = name.toLowerCase().replace(/\s+/g, '_');
        if (swatchSets.find(s => s.id === id)) {
            alert("Set already exists!");
            return;
        }
        const newSet = { id, name, swatches: [] };
        const newSets = [...swatchSets, newSet];
        saveSwatchSets(newSets);
        setActiveSetId(id);
    };

    // --- Grid Interaction ---

    const handleWheel = (e: React.WheelEvent) => {
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        setZoom(z => Math.min(Math.max(z * delta, 0.1), 5));
    };

    const getGridCoords = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - rect.left - pan.x) / zoom;
        const y = (e.clientY - rect.top - pan.y) / zoom;

        const gx = Math.floor(x / gridSize) * gridSize;
        const gy = Math.floor(y / gridSize) * gridSize;
        return { x: gx, y: gy };
    };

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        // alert('Tileset MouseDown: ' + e.button);
        if (!previewImage) return;

        if (e.button === 1) { // Middle Mouse
            e.preventDefault();
            setIsPanning(true);
            return;
        }

        if (e.button === 0) { // Left Click
            const coords = getGridCoords(e);

            if (clickMode) {
                if (isSelecting) {
                    // Finish selection
                    setSelectionEnd(coords);
                    setIsSelecting(false);
                } else {
                    // Start selection
                    setSelectionStart(coords);
                    setSelectionEnd(coords);
                    setIsSelecting(true);
                }
            } else {
                // Drag mode
                setIsSelecting(true);
                setSelectionStart(coords);
                setSelectionEnd(coords);
            }
        }
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (isPanning) {
            setPan(p => ({ x: p.x + e.movementX, y: p.y + e.movementY }));
            return;
        }

        if (isSelecting && selectionStart) {
            const coords = getGridCoords(e);
            setSelectionEnd(coords);
        }
    };

    const handleMouseUp = () => {
        if (!clickMode) {
            setIsSelecting(false);
        }
        setIsPanning(false);
    };

    // --- Swatch Logic ---

    const getSelectionBounds = () => {
        if (!selectionStart || !selectionEnd) return null;
        const minX = Math.min(selectionStart.x, selectionEnd.x);
        const maxX = Math.max(selectionStart.x, selectionEnd.x);
        const minY = Math.min(selectionStart.y, selectionEnd.y);
        const maxY = Math.max(selectionStart.y, selectionEnd.y);
        return { minX, maxX, minY, maxY, width: maxX - minX + gridSize, height: maxY - minY + gridSize };
    };

    const createSwatch = () => {
        if (!selectedTileset || !selectionStart || !selectionEnd || !swatchName) {
            alert('Please enter a swatch name and make a selection.');
            return;
        }

        const bounds = getSelectionBounds();
        if (!bounds) return;

        // Create a new swatch entry
        const tiles = [];
        for (let y = bounds.minY; y <= bounds.maxY; y += gridSize) {
            for (let x = bounds.minX; x <= bounds.maxX; x += gridSize) {
                tiles.push({ x, y });
            }
        }

        const newSwatch = {
            id: swatchName.toLowerCase().replace(/\s+/g, '_'),
            name: swatchName,
            tileset: selectedTileset,
            gridSize: gridSize, // Save current grid size
            properties: {
                walkable: swatchWalkable
            },
            tiles: tiles
        };

        // Find active set
        const setIndex = swatchSets.findIndex(s => s.id === activeSetId);
        if (setIndex === -1) {
            alert("No active swatch set selected.");
            return;
        }

        const updatedSets = [...swatchSets];
        const activeSet = { ...updatedSets[setIndex] };

        // Check if swatch exists in set
        const existingIndex = activeSet.swatches.findIndex((s: any) => s.id === newSwatch.id);
        if (existingIndex >= 0) {
            if (!confirm(`Swatch "${newSwatch.name}" already exists in this set. Overwrite?`)) return;
            activeSet.swatches[existingIndex] = newSwatch;
        } else {
            activeSet.swatches.push(newSwatch);
        }

        updatedSets[setIndex] = activeSet;
        saveSwatchSets(updatedSets);
        alert(`Swatch "${swatchName}" saved to set "${activeSet.name}".`);
    };

    const bounds = getSelectionBounds();
    const lineWidth = Math.max(1 / zoom, 0.5);

    const activeSet = swatchSets.find(s => s.id === activeSetId);
    const activeSwatches = activeSet ? activeSet.swatches : [];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="editor-header">
                <h2 className="editor-title">Tileset Editor</h2>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <label>Grid Size:</label>
                    <input
                        type="number"
                        value={gridSize}
                        onChange={(e) => setGridSize(parseInt(e.target.value) || 32)}
                        className="form-input"
                        style={{ width: '60px' }}
                    />
                    <label>Zoom: {Math.round(zoom * 100)}%</label>
                    <button className="btn btn-secondary" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>Reset View</button>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.9rem', cursor: 'pointer' }}>
                        <input type="checkbox" checked={clickMode} onChange={e => setClickMode(e.target.checked)} />
                        Click Mode
                    </label>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '20px', flex: 1, overflow: 'hidden' }}>
                {/* Left Panel: Tilesets & Swatches */}
                <div style={{ width: '280px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

                    {/* Tileset List */}
                    <div style={{ flex: 1, overflowY: 'auto', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '10px', maxHeight: '30%' }}>
                        <h4 style={{ marginTop: 0 }}>Tilesets</h4>
                        {tilesets.map(name => (
                            <div
                                key={name}
                                onClick={() => handleSelect(name)}
                                style={{
                                    padding: '4px 8px',
                                    cursor: 'pointer',
                                    borderRadius: '4px',
                                    background: selectedTileset === name ? 'rgba(51, 51, 255, 0.2)' : 'transparent',
                                    color: selectedTileset === name ? '#8080ff' : '#ccc',
                                    marginBottom: '2px',
                                    fontSize: '0.9rem'
                                }}
                            >
                                {name}
                            </div>
                        ))}
                    </div>

                    {/* Swatch Sets */}
                    <div style={{ flex: 2, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <h4 style={{ margin: 0 }}>Swatches</h4>
                            <button className="btn btn-sm btn-secondary" onClick={createSet} style={{ fontSize: '0.7rem', padding: '2px 6px' }}>+ Set</button>
                        </div>

                        <select
                            className="form-select"
                            value={activeSetId}
                            onChange={e => setActiveSetId(e.target.value)}
                            style={{ marginBottom: '10px' }}
                        >
                            {swatchSets.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>

                        <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '8px', alignContent: 'start' }}>
                            {activeSwatches.map((s: any) => (
                                <div
                                    key={s.id}
                                    onClick={() => handleSwatchClick(s)}
                                    title={`${s.name} (${s.gridSize}px)`}
                                    style={{
                                        cursor: 'pointer',
                                        borderRadius: '4px',
                                        border: swatchName === s.name ? '2px solid #ffcc00' : '1px solid #444',
                                        background: '#222',
                                        padding: '8px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center'
                                    }}
                                >
                                    <SwatchPreview swatch={s} image={tilesetImages[s.tileset]} />
                                    <div style={{ padding: '4px', fontSize: '0.7rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'center', width: '100%' }}>
                                        {s.name}
                                    </div>
                                    <div style={{ fontSize: '0.6rem', color: '#666', textAlign: 'center', paddingBottom: '2px' }}>
                                        {s.gridSize}px
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Editor Area */}
                {selectedTileset ? (
                    <div style={{ flex: 1, display: 'flex', gap: '20px', overflow: 'hidden' }}>
                        {/* Texture View */}
                        <div
                            ref={containerRef}
                            style={{
                                flex: 2,
                                background: '#1a1a1a',
                                borderRadius: '8px',
                                overflow: 'hidden',
                                position: 'relative',
                                userSelect: 'none',
                                cursor: isPanning ? 'grabbing' : 'crosshair'
                            }}
                            onWheel={handleWheel}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                            onClick={() => console.log('Container Clicked')} // Debug
                        >
                            {previewImage && (
                                <div
                                    style={{
                                        position: 'absolute',
                                        left: 0, top: 0,
                                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                                        transformOrigin: '0 0',
                                        transition: isPanning ? 'none' : 'transform 0.1s ease-out'
                                    }}
                                >
                                    <img
                                        src={`/assets/tilesets/${previewImage}`}
                                        alt="Tileset Preview"
                                        style={{ display: 'block', maxWidth: 'none', pointerEvents: 'none', imageRendering: 'pixelated' }}
                                        onDragStart={(e) => e.preventDefault()}
                                        onLoad={handleImageLoad}
                                    />
                                    {/* Grid Overlay */}
                                    <div
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            height: '100%',
                                            backgroundImage: `
                                                linear-gradient(to right, rgba(255,255,255,0.3) ${lineWidth}px, transparent ${lineWidth}px),
                                                linear-gradient(to bottom, rgba(255,255,255,0.3) ${lineWidth}px, transparent ${lineWidth}px)
                                            `,
                                            backgroundSize: `${gridSize}px ${gridSize}px`,
                                            pointerEvents: 'none'
                                        }}
                                    />
                                    {/* Existing Swatches Highlight (from active set) */}
                                    {activeSwatches.filter((s: any) => s.tileset === selectedTileset).map((s: any) => (
                                        s.tiles.map((t: any, i: number) => (
                                            <div
                                                key={`${s.id}-${i}`}
                                                title={`Swatch: ${s.name}`}
                                                style={{
                                                    position: 'absolute',
                                                    left: t.x,
                                                    top: t.y,
                                                    width: s.gridSize || gridSize,
                                                    height: s.gridSize || gridSize,
                                                    border: `1px solid rgba(255, 200, 0, 0.5)`,
                                                    backgroundColor: 'rgba(255, 200, 0, 0.2)',
                                                    pointerEvents: 'none'
                                                }}
                                            />
                                        ))
                                    ))}
                                    {/* Selection Highlight */}
                                    {bounds && (
                                        <div
                                            style={{
                                                position: 'absolute',
                                                left: bounds.minX,
                                                top: bounds.minY,
                                                width: bounds.width,
                                                height: bounds.height,
                                                border: `${2 / zoom}px solid #ff00cc`,
                                                backgroundColor: 'rgba(255, 0, 204, 0.2)',
                                                pointerEvents: 'none',
                                                boxShadow: `0 0 ${15 / zoom}px rgba(255, 0, 204, 0.5)`
                                            }}
                                        />
                                    )}
                                </div>
                            )}
                            <div style={{ position: 'absolute', bottom: 10, right: 10, color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', pointerEvents: 'none', textAlign: 'right' }}>
                                Middle Mouse to Pan • Wheel to Zoom<br />
                                Debug: Selecting={isSelecting.toString()}, Start={selectionStart ? `${selectionStart.x},${selectionStart.y}` : 'null'}, End={selectionEnd ? `${selectionEnd.x},${selectionEnd.y}` : 'null'}
                            </div>
                        </div>

                        {/* Swatch Builder Panel */}
                        <div className="form-container" style={{ flex: 1, display: 'flex', flexDirection: 'column', margin: 0, overflowY: 'auto' }}>
                            <h3>Swatch Builder</h3>
                            {bounds ? (
                                <div>
                                    <p style={{ color: '#aaa', marginBottom: '15px' }}>
                                        Selected Area: {bounds.width / gridSize}x{bounds.height / gridSize} tiles
                                        <br />
                                        Start: ({bounds.minX}, {bounds.minY})
                                    </p>

                                    <div className="form-group">
                                        <label className="form-label">Swatch Name</label>
                                        <input
                                            className="form-input"
                                            value={swatchName}
                                            onChange={e => setSwatchName(e.target.value)}
                                            placeholder="e.g. Grass, Stone Wall"
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">Properties</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <input
                                                type="checkbox"
                                                checked={swatchWalkable}
                                                onChange={e => setSwatchWalkable(e.target.checked)}
                                                style={{ width: '20px', height: '20px' }}
                                            />
                                            <span>Walkable</span>
                                        </div>
                                    </div>

                                    <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                                        <button className="btn btn-primary" onClick={createSwatch} style={{ flex: 1 }}>
                                            Save Swatch
                                        </button>
                                        <button className="btn btn-danger" onClick={() => { setSelectionStart(null); setSelectionEnd(null); }}>
                                            Clear Selection
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ color: '#666', textAlign: 'center', marginTop: '50px' }}>
                                    Drag on the grid to select an area for your swatch.
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#666' }}>
                        Select a tileset to edit
                    </div>
                )}
            </div>
        </div>
    );
};

const TilesetEditor = () => {
    return (
        <Routes>
            <Route path="/" element={<TilesetView />} />
            <Route path=":name" element={<TilesetView />} />
        </Routes>
    );
};


const SpriteList = () => {
    const [sprites, setSprites] = useState<Sprite[]>([]);
    const navigate = useNavigate();

    useEffect(() => {
        fetchSprites();
    }, []);

    const fetchSprites = async () => {
        const res = await fetch('http://localhost:3000/api/sprites');
        const data = await res.json();
        setSprites(data);
    };

    return (
        <div>
            <div className="editor-header">
                <h2 className="editor-title">Sprite Database</h2>
                <button className="btn btn-primary" onClick={() => navigate('new')}>+ New Sprite</button>
            </div>
            <div className="card-grid">
                {sprites.map(s => (
                    <div key={s.id} className="card" onClick={() => navigate(s.id)}>
                        <h3>{s.name}</h3>
                        <p>{s.type} • {s.texture}</p>
                        <p style={{ marginTop: '10px', fontSize: '0.8rem', opacity: 0.7 }}>{s.frameWidth}x{s.frameHeight}px</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

const SpriteForm = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [editing, setEditing] = useState<Sprite | null>(null);
    const isNew = !id;

    useEffect(() => {
        if (!isNew && id) {
            fetch('http://localhost:3000/api/sprites')
                .then(res => res.json())
                .then((all: Sprite[]) => {
                    const found = all.find(s => s.id === id);
                    if (found) setEditing(found);
                });
        } else {
            setEditing({
                id: '', name: '', type: 'character', texture: '', frameWidth: 32, frameHeight: 32, animations: {}
            });
        }
    }, [id, isNew]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editing) return;

        await fetch('http://localhost:3000/api/sprites', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(editing)
        });

        navigate('..');
    };

    const handleDelete = async () => {
        if (!editing || !confirm('Are you sure you want to delete this sprite?')) return;
        await fetch(`http://localhost:3000/api/sprites/${editing.id}`, { method: 'DELETE' });
        navigate('..');
    };

    if (!editing) return <div>Loading...</div>;

    return (
        <div className="form-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2>{isNew ? 'Create Sprite' : 'Edit Sprite'}</h2>
                <button className="btn btn-secondary" onClick={() => navigate('..')}>Cancel</button>
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div className="form-group">
                        <label className="form-label">Type</label>
                        <select className="form-select" value={editing.type} onChange={e => setEditing({ ...editing, type: e.target.value as any })}>
                            <option value="character">Character</option>
                            <option value="prop">Prop</option>
                            <option value="effect">Effect</option>
                            <option value="ui">UI</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Texture File</label>
                        <input className="form-input" value={editing.texture} onChange={e => setEditing({ ...editing, texture: e.target.value })} required />
                    </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div className="form-group">
                        <label className="form-label">Frame Width</label>
                        <input type="number" className="form-input" value={editing.frameWidth} onChange={e => setEditing({ ...editing, frameWidth: parseInt(e.target.value) })} required />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Frame Height</label>
                        <input type="number" className="form-input" value={editing.frameHeight} onChange={e => setEditing({ ...editing, frameHeight: parseInt(e.target.value) })} required />
                    </div>
                </div>

                <div className="form-group">
                    <label className="form-label">Animations (JSON)</label>
                    <textarea
                        className="form-textarea"
                        rows={5}
                        value={JSON.stringify(editing.animations, null, 2)}
                        onChange={e => {
                            try {
                                const parsed = JSON.parse(e.target.value);
                                setEditing({ ...editing, animations: parsed });
                            } catch (err) {
                                // Allow typing invalid JSON, but maybe show error? 
                                // For now, simple implementation.
                            }
                        }}
                    />
                    <p style={{ fontSize: '0.8rem', color: '#aaa', marginTop: '5px' }}>Format: {"{ \"idle\": { \"frames\": [0, 1], \"frameRate\": 5, \"loop\": true } }"}</p>
                </div>

                <div style={{ marginTop: '30px' }}>
                    <button type="submit" className="btn btn-primary">Save Sprite</button>
                    {!isNew && <button type="button" className="btn btn-danger" onClick={handleDelete}>Delete</button>}
                </div>
            </form>
        </div>
    );
};

const SpriteEditor = () => {
    return (
        <Routes>
            <Route path="/" element={<SpriteList />} />
            <Route path="new" element={<SpriteForm />} />
            <Route path=":id" element={<SpriteForm />} />
        </Routes>
    );
};

export function AdminPage() {
    useEffect(() => {
        const styleSheet = document.createElement("style");
        styleSheet.innerText = styles;
        document.head.appendChild(styleSheet);
        return () => {
            document.head.removeChild(styleSheet);
        };
    }, []);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#111', color: '#eee' }}>
            <div style={{ display: 'flex', background: '#222', borderBottom: '1px solid #444' }}>
                <NavLink
                    to="/admin/monsters"
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    style={{ textDecoration: 'none', color: 'inherit', padding: '15px 20px', display: 'block' }}
                >
                    Monsters
                </NavLink>
                <NavLink
                    to="/admin/skills"
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    style={{ textDecoration: 'none', color: 'inherit', padding: '15px 20px', display: 'block' }}
                >
                    Skills
                </NavLink>
                <NavLink
                    to="/admin/maps"
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    style={{ textDecoration: 'none', color: 'inherit', padding: '15px 20px', display: 'block' }}
                >
                    Map Editor
                </NavLink>
                <NavLink
                    to="/admin/tilesets"
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    style={{ textDecoration: 'none', color: 'inherit', padding: '15px 20px', display: 'block' }}
                >
                    Tileset Editor
                </NavLink>
                <NavLink
                    to="/admin/sprites"
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    style={{ textDecoration: 'none', color: 'inherit', padding: '15px 20px', display: 'block' }}
                >
                    Sprite Editor
                </NavLink>
            </div>
            <div style={{ flex: 1, overflow: 'hidden', padding: '20px' }}>
                <Routes>
                    <Route path="monsters/*" element={<MonsterEditor />} />
                    <Route path="skills/*" element={<SkillEditor />} />
                    <Route path="maps/*" element={<MapEditor />} />
                    <Route path="tilesets/*" element={<TilesetEditor />} />
                    <Route path="sprites/*" element={<SpriteEditor />} />
                    <Route path="*" element={<Navigate to="monsters" replace />} />
                </Routes>
            </div>
        </div>
    );
};
