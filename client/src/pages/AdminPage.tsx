import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import * as THREE from 'three';
import { Routes, Route, NavLink, useNavigate, useParams, Navigate } from 'react-router-dom';
import IconSelector from '../components/IconSelector';

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
    pivot?: { x: number; y: number };
    offsetX?: number;
    offsetY?: number;
    spacingX?: number;
    spacingY?: number;
}



interface Class {
    id: string;
    name: string;
    description: string;
    icon: string;
    baseHp: number;
    baseEnergy: number;
    startingSkills: string[];
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
            // Fetch all monsters and find the one we need
            fetch('http://localhost:3000/api/monsters')
                .then(res => res.json())
                .then((all: Monster[]) => {
                    const found = all.find(m => m.id === id);
                    if (found) setEditing(found);
                })
                .catch(err => console.error("Failed to load monster:", err));
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                            <span style={{ fontSize: '24px' }}>{s.icon || '❓'}</span>
                            <h3>{s.name}</h3>
                        </div>
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
                        <IconSelector value={editing.icon} onChange={(icon) => setEditing({ ...editing, icon })} />
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
                                                boxShadow: `0 0 ${15 / zoom}px rgba(255, 0, 204, 0.5)`,
                                                pointerEvents: 'none'
                                            }}
                                        />
                                    )}
                                </div>
                            )}
                            <div style={{ position: 'absolute', bottom: 10, right: 10, color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', pointerEvents: 'none', textAlign: 'right' }}>
                                Middle Mouse to Pan • Wheel to Zoom • Click to Add Frame
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

const Tooltip = ({ content, children }: { content: string, children: React.ReactNode }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const triggerRef = useRef<HTMLDivElement>(null);

    const handleMouseEnter = () => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setPosition({
                top: rect.top + window.scrollY,
                left: rect.left + rect.width / 2 + window.scrollX
            });
            setIsVisible(true);
        }
    };

    return (
        <>
            <div
                ref={triggerRef}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={() => setIsVisible(false)}
                style={{ position: 'relative', display: 'inline-block', cursor: 'help', borderBottom: '1px dotted #666' }}
            >
                {children}
            </div>
            {isVisible && createPortal(
                <div style={{
                    position: 'absolute',
                    top: position.top,
                    left: position.left,
                    transform: 'translate(-50%, -100%) translateY(-8px)',
                    padding: '8px 12px',
                    background: '#222',
                    color: '#fff',
                    borderRadius: '4px',
                    fontSize: '0.8rem',
                    whiteSpace: 'nowrap',
                    zIndex: 9999,
                    boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                    border: '1px solid #444',
                    pointerEvents: 'none'
                }}>
                    {content}
                    {/* Arrow */}
                    <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: '50%',
                        marginLeft: '-5px',
                        borderWidth: '5px',
                        borderStyle: 'solid',
                        borderColor: '#222 transparent transparent transparent'
                    }} />
                </div>,
                document.body
            )}
        </>
    );
};

const Toast = ({ message, type, onClose }: { message: string, type: 'success' | 'error', onClose: () => void }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return createPortal(
        <div style={{
            position: 'fixed',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#222',
            color: '#fff',
            padding: '10px 20px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            border: `1px solid ${type === 'success' ? '#4caf50' : '#f44336'}`,
            animation: 'fadeIn 0.3s ease-out'
        }}>
            <span style={{ color: type === 'success' ? '#4caf50' : '#f44336', fontSize: '1.2rem' }}>
                {type === 'success' ? '✓' : '⚠'}
            </span>
            {message}
        </div>,
        document.body
    );
};

const AnimationTimeline = ({ texture, frameWidth, frameHeight, frames, onRemove, onReorder, offsetX = 0, offsetY = 0, spacingX = 0, spacingY = 0 }: any) => {
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === index) return;
    };

    const handleDrop = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === index) return;
        onReorder(draggedIndex, index);
        setDraggedIndex(null);
    };

    return (
        <div style={{
            display: 'flex',
            gap: '5px',
            overflowX: 'auto',
            padding: '10px',
            background: '#222',
            borderRadius: '8px',
            minHeight: '80px',
            alignItems: 'center'
        }}>
            {frames.map((frameIndex: number, i: number) => (
                <div
                    key={i}
                    draggable
                    onDragStart={(e) => handleDragStart(e, i)}
                    onDragOver={(e) => handleDragOver(e, i)}
                    onDrop={(e) => handleDrop(e, i)}
                    style={{
                        position: 'relative',
                        width: '50px',
                        height: '50px',
                        border: '1px solid #444',
                        borderRadius: '4px',
                        flexShrink: 0,
                        background: '#333',
                        cursor: 'grab',
                        opacity: draggedIndex === i ? 0.5 : 1
                    }}
                >
                    <div style={{
                        width: '100%',
                        height: '100%',
                        // backgroundImage: `url(/assets/sprites/${texture})`,
                        // backgroundPosition: `-${(frameIndex % Math.ceil(10000 / frameWidth)) * frameWidth}px -${Math.floor(frameIndex / Math.ceil(10000 / frameWidth)) * frameHeight}px`, // Approximate, better to use canvas for thumbnails but css is faster for now
                        // Actually, CSS background position is tricky without knowing image width. 
                        // Let's use a mini canvas or just the number for now to be safe and fast.
                        display: 'flex', justifyContent: 'center', alignItems: 'center',
                        fontSize: '1.2rem', fontWeight: 'bold', color: '#666'
                    }}>
                        {/* {frameIndex} */}
                    </div>
                    {/* Thumbnail Overlay */}
                    <div style={{
                        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                        overflow: 'hidden', pointerEvents: 'none'
                    }}>
                        <SpritePreview
                            texture={texture}
                            frameWidth={frameWidth}
                            frameHeight={frameHeight}
                            frameIndex={frameIndex}
                            scale={50 / Math.max(frameWidth, frameHeight)}
                            offsetX={offsetX}
                            offsetY={offsetY}
                            spacingX={spacingX}
                            spacingY={spacingY}
                        />
                    </div>

                    <div style={{
                        position: 'absolute', top: '-5px', left: '-5px',
                        background: '#007bff', color: '#fff',
                        borderRadius: '50%', width: '16px', height: '16px',
                        fontSize: '10px', display: 'flex', justifyContent: 'center', alignItems: 'center'
                    }}>
                        {i + 1}
                    </div>
                    <button
                        onClick={() => onRemove(i)}
                        style={{
                            position: 'absolute', top: '-5px', right: '-5px',
                            background: '#ff4444', color: '#fff', border: 'none',
                            borderRadius: '50%', width: '16px', height: '16px',
                            fontSize: '10px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center'
                        }}
                    >
                        ×
                    </button>
                </div>
            ))}
            {frames.length === 0 && <div style={{ color: '#666', fontSize: '0.9rem', padding: '0 10px' }}>No frames selected. Click on the sprite sheet to add frames.</div>}
        </div>
    );
};

const SpriteSheetViewer = ({ texture, frameWidth, frameHeight, selectedFrames, onSelect, offsetX = 0, offsetY = 0, spacingX = 0, spacingY = 0 }: any) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [image, setImage] = useState<HTMLImageElement | null>(null);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [isPanning, setIsPanning] = useState(false);

    // Load Image
    useEffect(() => {
        if (!texture) {
            setImage(null);
            return;
        }
        const img = new Image();
        img.src = `/assets/sprites/${texture}`;
        img.onload = () => {
            setImage(img);
            // Fit to view
            if (containerRef.current) {
                const cw = containerRef.current.clientWidth;
                const ch = containerRef.current.clientHeight;
                const scale = Math.min((cw - 40) / img.width, (ch - 40) / img.height, 1);
                setZoom(scale);
                setPan({
                    x: (cw - img.width * scale) / 2,
                    y: (ch - img.height * scale) / 2
                });
            }
        };
    }, [texture]);

    // Render Loop
    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container || !image) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;

        // Clear
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        ctx.translate(pan.x, pan.y);
        ctx.scale(zoom, zoom);

        // Draw Image
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(image, 0, 0);

        // Draw Offsets
        ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
        if (offsetX > 0) {
            ctx.fillRect(0, 0, offsetX, image.height);
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
            ctx.lineWidth = 2 / zoom;
            ctx.beginPath();
            ctx.moveTo(offsetX, 0);
            ctx.lineTo(offsetX, image.height);
            ctx.stroke();
        }
        if (offsetY > 0) {
            ctx.fillRect(0, 0, image.width, offsetY);
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
            ctx.lineWidth = 2 / zoom;
            ctx.beginPath();
            ctx.moveTo(0, offsetY);
            ctx.lineTo(image.width, offsetY);
            ctx.stroke();
        }

        // Draw Grid (Individual Frames)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1 / zoom;
        ctx.beginPath();

        const effectiveWidth = frameWidth + spacingX;
        const effectiveHeight = frameHeight + spacingY;

        const cols = Math.floor((image.width - offsetX + spacingX) / effectiveWidth);
        const rows = Math.floor((image.height - offsetY + spacingY) / effectiveHeight);

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const x = offsetX + c * effectiveWidth;
                const y = offsetY + r * effectiveHeight;
                ctx.rect(x, y, frameWidth, frameHeight);
            }
        }

        ctx.stroke();

        // Draw Selected Frames
        ctx.lineWidth = 2 / zoom;

        // Map frame indices to their sequence positions
        const frameMap = new Map<number, number[]>();
        selectedFrames.forEach((frameIndex: number, seqIndex: number) => {
            if (!frameMap.has(frameIndex)) frameMap.set(frameIndex, []);
            frameMap.get(frameIndex)!.push(seqIndex + 1);
        });

        frameMap.forEach((seqIndices, frameIndex) => {
            const stride = Math.floor((image.width - offsetX + spacingX) / effectiveWidth);
            if (stride <= 0) return;

            const c = frameIndex % stride;
            const r = Math.floor(frameIndex / stride);

            const x = offsetX + c * effectiveWidth;
            const y = offsetY + r * effectiveHeight;

            ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
            ctx.strokeStyle = '#00ff00';

            ctx.fillRect(x, y, frameWidth, frameHeight);
            ctx.strokeRect(x, y, frameWidth, frameHeight);

            // Draw Sequence Numbers
            ctx.fillStyle = '#fff';
            ctx.font = `bold ${Math.min(14, frameHeight / 2)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Draw a badge for the sequence numbers
            const text = seqIndices.join(', ');
            ctx.fillText(text, x + frameWidth / 2, y + frameHeight / 2);
        });

        ctx.restore();

    }, [image, pan, zoom, frameWidth, frameHeight, selectedFrames, offsetX, offsetY, spacingX, spacingY]);

    const handleWheel = (e: React.WheelEvent) => {
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.min(Math.max(zoom * delta, 0.1), 10);

        // Zoom towards mouse pointer
        const rect = containerRef.current!.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const scaleChange = newZoom - zoom;
        const offsetX = (mouseX - pan.x) / zoom;
        const offsetY = (mouseY - pan.y) / zoom;

        setPan({
            x: pan.x - offsetX * scaleChange,
            y: pan.y - offsetY * scaleChange
        });
        setZoom(newZoom);
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button === 1) { // Middle click
            setIsPanning(true);
        } else if (e.button === 0 && image) { // Left click
            const rect = containerRef.current!.getBoundingClientRect();
            const x = (e.clientX - rect.left - pan.x) / zoom;
            const y = (e.clientY - rect.top - pan.y) / zoom;

            if (x >= 0 && x < image.width && y >= 0 && y < image.height) {
                const effectiveWidth = frameWidth + spacingX;
                const effectiveHeight = frameHeight + spacingY;

                // Adjust for offset
                const adjX = x - offsetX;
                const adjY = y - offsetY;

                if (adjX < 0 || adjY < 0) return;

                const col = Math.floor(adjX / effectiveWidth);
                const row = Math.floor(adjY / effectiveHeight);

                // Check if click is within the frame (not in spacing)
                const inFrameX = (adjX % effectiveWidth) < frameWidth;
                const inFrameY = (adjY % effectiveHeight) < frameHeight;

                if (inFrameX && inFrameY) {
                    const stride = Math.floor((image.width - offsetX + spacingX) / effectiveWidth);
                    const index = row * stride + col;
                    onSelect(index);
                }
            }
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isPanning) {
            setPan(p => ({ x: p.x + e.movementX, y: p.y + e.movementY }));
        }
    };

    const handleMouseUp = () => {
        setIsPanning(false);
    };

    return (
        <div
            ref={containerRef}
            style={{
                flex: 1,
                background: '#111',
                borderRadius: '8px',
                overflow: 'hidden',
                position: 'relative',
                cursor: isPanning ? 'grabbing' : 'crosshair',
                minHeight: '400px'
            }}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
            {!image && <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#666' }}>Select a texture to view</div>}
            <div style={{ position: 'absolute', bottom: 10, right: 10, color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', pointerEvents: 'none', textAlign: 'right' }}>
                Middle Mouse to Pan • Wheel to Zoom • Click to Add Frame
            </div>
        </div>
    );
};

const SpritePreview = ({ texture, frameWidth, frameHeight, frameIndex, pivot, scale = 1, offsetX = 0, offsetY = 0, spacingX = 0, spacingY = 0 }: any) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [image, setImage] = useState<HTMLImageElement | null>(null);

    // Load Image only when texture changes
    useEffect(() => {
        if (!texture) {
            setImage(null);
            return;
        }
        const img = new Image();
        img.src = `/assets/sprites/${texture}`;
        img.onload = () => setImage(img);
    }, [texture]);

    // Render when frame/props change
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !image) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const effectiveWidth = frameWidth + spacingX;
        const effectiveHeight = frameHeight + spacingY;
        const stride = Math.floor((image.width - offsetX + spacingX) / effectiveWidth);
        const col = frameIndex % stride;
        const row = Math.floor(frameIndex / stride);

        canvas.width = frameWidth * scale;
        canvas.height = frameHeight * scale;

        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(
            image,
            offsetX + col * effectiveWidth, offsetY + row * effectiveHeight, frameWidth, frameHeight,
            0, 0, frameWidth * scale, frameHeight * scale
        );

        // Draw Pivot
        if (pivot) {
            const px = pivot.x * canvas.width;
            const py = pivot.y * canvas.height;
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(px - 10, py);
            ctx.lineTo(px + 10, py);
            ctx.moveTo(px, py - 10);
            ctx.lineTo(px, py + 10);
            ctx.stroke();
        }
    }, [image, frameWidth, frameHeight, frameIndex, pivot, scale, offsetX, offsetY, spacingX, spacingY]);

    return <canvas ref={canvasRef} />;
};

const SpriteForm = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [editing, setEditing] = useState<Sprite | null>(null);
    const [textures, setTextures] = useState<string[]>([]);
    const [activeAnim, setActiveAnim] = useState<string>('idle');
    const [previewFrame, setPreviewFrame] = useState(0);
    const [previewZoom, setPreviewZoom] = useState(2);
    const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
    const isNew = !id;

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
    };

    // Animation playback
    useEffect(() => {
        if (!editing || !editing.animations[activeAnim]) return;
        const anim = editing.animations[activeAnim];
        if (anim.frames.length === 0) return;

        const interval = setInterval(() => {
            setPreviewFrame(f => (f + 1) % anim.frames.length);
        }, 1000 / anim.frameRate);

        return () => clearInterval(interval);
    }, [editing, activeAnim]);

    useEffect(() => {
        fetch('http://localhost:3000/api/sprite-textures').then(r => r.json()).then(setTextures);

        if (!isNew && id) {
            fetch('http://localhost:3000/api/sprites')
                .then(res => res.json())
                .then((all: Sprite[]) => {
                    const found = all.find(s => s.id === id);
                    if (found) {
                        if (!found.pivot) found.pivot = { x: 0.5, y: 1.0 };
                        if (found.offsetX === undefined) found.offsetX = 0;
                        if (found.offsetY === undefined) found.offsetY = 0;

                        // Migration
                        if ((found as any).spacing !== undefined) {
                            found.spacingX = (found as any).spacing;
                            found.spacingY = (found as any).spacing;
                        }

                        if (found.spacingX === undefined) found.spacingX = 0;
                        if (found.spacingY === undefined) found.spacingY = 0;

                        setEditing(found);
                        if (Object.keys(found.animations).length > 0) {
                            setActiveAnim(Object.keys(found.animations)[0]);
                        }
                    }
                });
        } else {
            setEditing({
                id: '', name: '', type: 'character', texture: '',
                frameWidth: 32, frameHeight: 32,
                animations: {
                    idle: { frames: [0], frameRate: 8, loop: true },

                },
                pivot: { x: 0.5, y: 1.0 },
                offsetX: 0,
                offsetY: 0,
                spacingX: 0,
                spacingY: 0
            });
        }
    }, [id, isNew]);

    const handleAutoDetect = () => {
        if (!editing || !editing.texture) return;

        const img = new Image();
        img.src = `/assets/sprites/${editing.texture}`;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            // 1. Binary Projections
            const xProjection = new Array(canvas.width).fill(0);
            const yProjection = new Array(canvas.height).fill(0);

            for (let y = 0; y < canvas.height; y++) {
                for (let x = 0; x < canvas.width; x++) {
                    if (data[(y * canvas.width + x) * 4 + 3] > 0) {
                        xProjection[x] = 1;
                        yProjection[y] = 1;
                    }
                }
            }

            // 2. Dilation (Fill small gaps)
            const dilate = (projection: number[], maxGap: number = 2) => {
                const dilated = [...projection];
                let gapStart = -1;

                // Find gaps between 1s
                for (let i = 0; i < projection.length; i++) {
                    if (projection[i] === 0) {
                        if (gapStart === -1) gapStart = i;
                    } else {
                        if (gapStart !== -1) {
                            const gapLen = i - gapStart;
                            // If gap is small and bounded by 1s (which is true if we are in this else block), fill it
                            // Check if gapStart > 0 to ensure it's bounded on left
                            if (gapLen <= maxGap && gapStart > 0) {
                                for (let j = gapStart; j < i; j++) dilated[j] = 1;
                            }
                            gapStart = -1;
                        }
                    }
                }
                return dilated;
            };

            const xDilated = dilate(xProjection, 4); // Allow 4px gaps (e.g. between legs)
            const yDilated = dilate(yProjection, 4);

            // 3. Segment Analysis
            const analyzeSegments = (projection: number[]) => {
                const segments: { start: number, length: number, center: number }[] = [];
                let currentStart = -1;

                for (let i = 0; i < projection.length; i++) {
                    if (projection[i] === 1) {
                        if (currentStart === -1) currentStart = i;
                    } else {
                        if (currentStart !== -1) {
                            const len = i - currentStart;
                            segments.push({ start: currentStart, length: len, center: currentStart + len / 2 });
                            currentStart = -1;
                        }
                    }
                }
                if (currentStart !== -1) {
                    const len = projection.length - currentStart;
                    segments.push({ start: currentStart, length: len, center: currentStart + len / 2 });
                }

                if (segments.length === 0) return null;

                // Median Size
                const lengths = segments.map(s => s.length).sort((a, b) => a - b);
                const medianSize = lengths[Math.floor(lengths.length / 2)];

                // Median Spacing (Stride)
                // Stride is distance between starts (or centers) of consecutive segments
                const strides: number[] = [];
                for (let i = 0; i < segments.length - 1; i++) {
                    strides.push(segments[i + 1].start - segments[i].start);
                }

                let medianStride = 0;
                if (strides.length > 0) {
                    strides.sort((a, b) => a - b);
                    medianStride = strides[Math.floor(strides.length / 2)];
                } else {
                    // Only one segment? Stride is size? Or 0?
                    medianStride = medianSize;
                }

                const spacing = Math.max(0, medianStride - medianSize);
                const offset = segments[0].start;

                return { size: medianSize, spacing, offset, stride: medianStride };
            };

            const xData = analyzeSegments(xDilated);
            const yData = analyzeSegments(yDilated);

            console.log('AutoDetect Dilated:', { xData, yData });

            if (!xData || !yData) {
                showToast("Could not detect any content.", "error");
                return;
            }

            const frameWidth = xData.size;
            const frameHeight = yData.size;
            const spacingX = xData.spacing;
            const spacingY = yData.spacing;

            const offsetX = xData.offset;
            const offsetY = yData.offset;

            setEditing(prev => prev ? ({
                ...prev,
                frameWidth,
                frameHeight,
                offsetX,
                offsetY,
                spacingX,
                spacingY
            }) : null);

            showToast(`Applied: ${frameWidth}x${frameHeight}, Off: ${offsetX},${offsetY}, Spc: ${spacingX},${spacingY}`, "success");
        };
    };

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

    const appendFrame = (frameIndex: number) => {
        if (!editing) return;
        const anim = editing.animations[activeAnim] || { frames: [], frameRate: 8, loop: true };
        const frames = [...anim.frames, frameIndex];

        setEditing({
            ...editing,
            animations: {
                ...editing.animations,
                [activeAnim]: { ...anim, frames }
            }
        });
    };

    const removeFrame = (index: number) => {
        if (!editing) return;
        const anim = editing.animations[activeAnim];
        const frames = [...anim.frames];
        frames.splice(index, 1);
        setEditing({
            ...editing,
            animations: { ...editing.animations, [activeAnim]: { ...anim, frames } }
        });
    };

    const reorderFrames = (fromIndex: number, toIndex: number) => {
        if (!editing) return;
        const anim = editing.animations[activeAnim];
        const frames = [...anim.frames];
        const [moved] = frames.splice(fromIndex, 1);
        frames.splice(toIndex, 0, moved);
        setEditing({
            ...editing,
            animations: { ...editing.animations, [activeAnim]: { ...anim, frames } }
        });
    };

    if (!editing) return <div>Loading...</div>;

    return (
        <div className="form-container" style={{ maxWidth: '95vw', height: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2>{isNew ? 'Create Sprite' : 'Edit Sprite'}</h2>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn btn-primary" onClick={handleSave}>Save Sprite</button>
                    <button className="btn btn-secondary" onClick={() => navigate('..')}>Cancel</button>
                    {!isNew && <button type="button" className="btn btn-danger" onClick={handleDelete}>Delete</button>}
                </div>
            </div>

            <div style={{ display: 'flex', gap: '20px', flex: 1, overflow: 'hidden' }}>
                {/* Left Column: Settings & Animation List */}
                <div style={{ width: '300px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>
                    <div className="form-group">
                        <Tooltip content="Unique identifier for this sprite.">
                            <label className="form-label">ID</label>
                        </Tooltip>
                        <input className="form-input" value={editing.id} onChange={e => setEditing({ ...editing, id: e.target.value })} disabled={!isNew} required />
                    </div>
                    <div className="form-group">
                        <Tooltip content="Display name for the sprite.">
                            <label className="form-label">Name</label>
                        </Tooltip>
                        <input className="form-input" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} required />
                    </div>
                    <div className="form-group">
                        <Tooltip content="Category of the sprite (Character, Prop, Effect, UI).">
                            <label className="form-label">Type</label>
                        </Tooltip>
                        <select className="form-select" value={editing.type} onChange={e => setEditing({ ...editing, type: e.target.value as any })}>
                            <option value="character">Character</option>
                            <option value="prop">Prop</option>
                            <option value="effect">Effect</option>
                            <option value="ui">UI</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <Tooltip content="The source image file for the sprite sheet.">
                            <label className="form-label">Texture</label>
                        </Tooltip>
                        <select className="form-select" value={editing.texture} onChange={e => setEditing({ ...editing, texture: e.target.value })}>
                            <option value="">Select Texture...</option>
                            {textures.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div className="form-group">
                            <Tooltip content="Width of a single frame in pixels.">
                                <label className="form-label">Frame W</label>
                            </Tooltip>
                            <input type="number" className="form-input" value={editing.frameWidth} onChange={e => setEditing({ ...editing, frameWidth: parseInt(e.target.value) })} required />
                        </div>
                        <div className="form-group">
                            <Tooltip content="Height of a single frame in pixels.">
                                <label className="form-label">Frame H</label>
                            </Tooltip>
                            <input type="number" className="form-input" value={editing.frameHeight} onChange={e => setEditing({ ...editing, frameHeight: parseInt(e.target.value) })} required />
                        </div>
                    </div>
                    <button
                        className="button"
                        style={{ width: '100%', marginBottom: '10px', background: '#444', fontSize: '0.9rem' }}
                        onClick={handleAutoDetect}
                        disabled={!editing.texture}
                    >
                        Auto Detect Frames
                    </button>
                    <div className="form-group">
                        <Tooltip content="Anchor point (0-1). (0.5, 1.0) is bottom-center.">
                            <label className="form-label">Pivot (X, Y)</label>
                        </Tooltip>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <input type="number" step="0.1" className="form-input" value={editing.pivot?.x ?? 0.5} onChange={e => setEditing({ ...editing, pivot: { ...editing.pivot!, x: parseFloat(e.target.value) } })} />
                            <input type="number" step="0.1" className="form-input" value={editing.pivot?.y ?? 1.0} onChange={e => setEditing({ ...editing, pivot: { ...editing.pivot!, y: parseFloat(e.target.value) } })} />
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px' }}>
                        <div className="form-group">
                            <Tooltip content="Pixels to skip from the left edge.">
                                <label className="form-label">Offset X</label>
                            </Tooltip>
                            <input type="number" className="form-input" value={editing.offsetX ?? 0} onChange={e => setEditing({ ...editing, offsetX: parseInt(e.target.value) })} />
                        </div>
                        <div className="form-group">
                            <Tooltip content="Pixels to skip from the top edge.">
                                <label className="form-label">Offset Y</label>
                            </Tooltip>
                            <input type="number" className="form-input" value={editing.offsetY ?? 0} onChange={e => setEditing({ ...editing, offsetY: parseInt(e.target.value) })} />
                        </div>
                        <div className="form-group">
                            <Tooltip content="Horizontal spacing between frames.">
                                <label className="form-label">Spacing Left</label>
                            </Tooltip>
                            <input type="number" className="form-input" value={editing.spacingX ?? 0} onChange={e => setEditing({ ...editing, spacingX: parseInt(e.target.value) })} />
                        </div>
                        <div className="form-group">
                            <Tooltip content="Vertical spacing between frames.">
                                <label className="form-label">Spacing Top</label>
                            </Tooltip>
                            <input type="number" className="form-input" value={editing.spacingY ?? 0} onChange={e => setEditing({ ...editing, spacingY: parseInt(e.target.value) })} />
                        </div>
                    </div>

                    {/* Animation List */}
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '8px', flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Animations</h3>
                            <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '0.8rem' }} onClick={() => {
                                const name = prompt('Animation Name (e.g. attack):');
                                if (name && !editing.animations[name]) {
                                    setEditing({
                                        ...editing,
                                        animations: { ...editing.animations, [name]: { frames: [], frameRate: 10, loop: false } }
                                    });
                                    setActiveAnim(name);
                                }
                            }}>+ Add</button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            {Object.keys(editing.animations).map(animName => (
                                <div
                                    key={animName}
                                    onClick={() => setActiveAnim(animName)}
                                    style={{
                                        padding: '8px 12px',
                                        borderRadius: '4px',
                                        background: activeAnim === animName ? '#3333ff' : '#333',
                                        cursor: 'pointer',
                                        border: '1px solid #555',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }}
                                >
                                    <span>{animName}</span>
                                    <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>{editing.animations[animName].frames.length} f</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Center: Sprite Sheet Viewer & Timeline */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ margin: 0 }}>Sprite Sheet</h3>
                        <div style={{ fontSize: '0.9rem', color: '#aaa' }}>
                            Editing: <span style={{ color: '#fff', fontWeight: 'bold' }}>{activeAnim}</span>
                        </div>
                    </div>
                    <SpriteSheetViewer
                        texture={editing.texture}
                        frameWidth={editing.frameWidth}
                        frameHeight={editing.frameHeight}
                        offsetX={editing.offsetX ?? 0}
                        offsetY={editing.offsetY ?? 0}
                        spacingX={editing.spacingX ?? 0}
                        spacingY={editing.spacingY ?? 0}
                        selectedFrames={editing.animations[activeAnim]?.frames || []}
                        onSelect={appendFrame}
                    />

                    {/* Timeline */}
                    <h4 style={{ margin: '10px 0 5px 0' }}>Animation Timeline (Drag to reorder)</h4>
                    <AnimationTimeline
                        texture={editing.texture}
                        frameWidth={editing.frameWidth}
                        frameHeight={editing.frameHeight}
                        offsetX={editing.offsetX ?? 0}
                        offsetY={editing.offsetY ?? 0}
                        spacingX={editing.spacingX ?? 0}
                        spacingY={editing.spacingY ?? 0}
                        frames={editing.animations[activeAnim]?.frames || []}
                        onRemove={removeFrame}
                        onReorder={reorderFrames}
                    />
                </div>

                {/* Right: Preview & Anim Settings */}
                <div style={{ width: '250px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '8px' }}>
                        <h3 style={{ margin: '0 0 15px 0', fontSize: '1.1rem' }}>Preview</h3>
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '15px' }}>
                            <div style={{
                                width: editing.frameWidth * 2 + 20,
                                height: editing.frameHeight * 2 + 20,
                                background: `
                                    conic-gradient(
                                        #333 0.25turn, #444 0.25turn 0.5turn,
                                        #333 0.5turn 0.75turn, #444 0.75turn
                                    )
                                `,
                                backgroundSize: '20px 20px',
                                display: 'flex', justifyContent: 'center', alignItems: 'center',
                                border: '1px solid #444'
                            }}>
                                {editing.texture && editing.animations[activeAnim] && editing.animations[activeAnim].frames.length > 0 && (
                                    <div
                                        onWheel={(e) => {
                                            e.preventDefault();
                                            const delta = e.deltaY > 0 ? 0.9 : 1.1;
                                            setPreviewZoom(z => Math.min(Math.max(z * delta, 0.5), 10));
                                        }}
                                        style={{
                                            width: editing.frameWidth * previewZoom + 20,
                                            height: editing.frameHeight * previewZoom + 20,
                                            background: `
                                                conic-gradient(
                                                    #333 0.25turn, #444 0.25turn 0.5turn,
                                                    #333 0.5turn 0.75turn, #444 0.75turn
                                                )
                                            `,
                                            backgroundSize: '20px 20px',
                                            display: 'flex', justifyContent: 'center', alignItems: 'center',
                                            border: '1px solid #444',
                                            overflow: 'hidden',
                                            cursor: 'zoom-in'
                                        }}>
                                        <SpritePreview
                                            texture={editing.texture}
                                            frameWidth={editing.frameWidth}
                                            frameHeight={editing.frameHeight}
                                            frameIndex={editing.animations[activeAnim].frames[previewFrame]}
                                            pivot={editing.pivot}
                                            scale={previewZoom}
                                            offsetX={editing.offsetX ?? 0}
                                            offsetY={editing.offsetY ?? 0}
                                            spacingX={editing.spacingX ?? 0}
                                            spacingY={editing.spacingY ?? 0}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                        <div style={{ textAlign: 'center', fontSize: '0.8rem', color: '#aaa' }}>
                            Frame: {editing.animations[activeAnim]?.frames[previewFrame]} <br />
                            ({previewFrame + 1} / {editing.animations[activeAnim]?.frames.length || 0}) <br />
                            Zoom: {previewZoom.toFixed(1)}x
                        </div>
                    </div>

                    {activeAnim && editing.animations[activeAnim] && (
                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '8px' }}>
                            <h3 style={{ margin: '0 0 15px 0', fontSize: '1.1rem' }}>Settings</h3>
                            <div className="form-group">
                                <label className="form-label">Speed (fps)</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={editing.animations[activeAnim].frameRate}
                                    onChange={e => setEditing({
                                        ...editing,
                                        animations: { ...editing.animations, [activeAnim]: { ...editing.animations[activeAnim], frameRate: parseInt(e.target.value) } }
                                    })}
                                />
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={editing.animations[activeAnim].loop}
                                        onChange={e => setEditing({
                                            ...editing,
                                            animations: { ...editing.animations, [activeAnim]: { ...editing.animations[activeAnim], loop: e.target.checked } }
                                        })}
                                    />
                                    <span>Loop Animation</span>
                                </label>
                            </div>
                            <button className="btn btn-danger" style={{ width: '100%', marginTop: '10px' }} onClick={() => {
                                if (confirm(`Delete animation "${activeAnim}"?`)) {
                                    const newAnims = { ...editing.animations };
                                    delete newAnims[activeAnim];
                                    setEditing({ ...editing, animations: newAnims });
                                    setActiveAnim(Object.keys(newAnims)[0] || '');
                                }
                            }}>Delete Animation</button>
                        </div>
                    )}
                </div>
            </div>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
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

const ClassList = () => {
    const [classes, setClasses] = useState<Class[]>([]);
    const navigate = useNavigate();

    useEffect(() => {
        fetchClasses();
    }, []);

    const fetchClasses = async () => {
        const res = await fetch('http://localhost:3000/api/classes');
        const data = await res.json();
        setClasses(data);
    };

    return (
        <div>
            <div className="editor-header">
                <h2 className="editor-title">Class Database</h2>
                <button className="btn btn-primary" onClick={() => navigate('new')}>+ New Class</button>
            </div>
            <div className="card-grid">
                {classes.map(c => (
                    <div key={c.id} className="card" onClick={() => navigate(c.id)}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                            <span style={{ fontSize: '24px' }}>{c.icon || '❓'}</span>
                            <h3>{c.name}</h3>
                        </div>
                        <p>{c.description}</p>
                        <p style={{ marginTop: '10px', fontSize: '0.8rem', opacity: 0.7 }}>HP: {c.baseHp} • Energy: {c.baseEnergy}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

const ClassForm = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [editing, setEditing] = useState<Class | null>(null);
    const [skills, setSkills] = useState<Skill[]>([]);
    const isNew = !id;

    useEffect(() => {
        // Fetch dependencies
        fetch('http://localhost:3000/api/skills').then(r => r.json()).then(setSkills);

        if (!isNew && id) {
            fetch('http://localhost:3000/api/classes')
                .then(res => res.json())
                .then((all: Class[]) => {
                    const found = all.find(c => c.id === id);
                    if (found) setEditing(found);
                });
        } else {
            setEditing({
                id: '', name: '', description: '', icon: '', baseHp: 100, baseEnergy: 50, startingSkills: []
            });
        }
    }, [id, isNew]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editing) return;

        await fetch('http://localhost:3000/api/classes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(editing)
        });

        navigate('..');
    };

    const handleDelete = async () => {
        if (!editing || !confirm('Are you sure you want to delete this class?')) return;
        await fetch(`http://localhost:3000/api/classes/${editing.id}`, { method: 'DELETE' });
        navigate('..');
    };

    const toggleSkill = (skillId: string) => {
        if (!editing) return;
        const current = editing.startingSkills || [];
        if (current.includes(skillId)) {
            setEditing({ ...editing, startingSkills: current.filter(s => s !== skillId) });
        } else {
            setEditing({ ...editing, startingSkills: [...current, skillId] });
        }
    };

    if (!editing) return <div>Loading...</div>;

    return (
        <div className="form-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2>{isNew ? 'Create Class' : 'Edit Class'}</h2>
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div className="form-group">
                        <label className="form-label">Base HP</label>
                        <input type="number" className="form-input" value={editing.baseHp} onChange={e => setEditing({ ...editing, baseHp: parseInt(e.target.value) })} required />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Base Energy</label>
                        <input type="number" className="form-input" value={editing.baseEnergy} onChange={e => setEditing({ ...editing, baseEnergy: parseInt(e.target.value) })} required />
                    </div>
                </div>

                <div className="form-group">
                    <label className="form-label">Icon</label>
                    <IconSelector value={editing.icon} onChange={(icon) => setEditing({ ...editing, icon })} />
                </div>

                <div className="form-group">
                    <label className="form-label">Starting Skills</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px', maxHeight: '200px', overflowY: 'auto', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px' }}>
                        {skills.map(s => (
                            <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={editing.startingSkills?.includes(s.id)}
                                    onChange={() => toggleSkill(s.id)}
                                />
                                <span>{s.name}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <div style={{ marginTop: '30px' }}>
                    <button type="submit" className="btn btn-primary">Save Class</button>
                    {!isNew && <button type="button" className="btn btn-danger" onClick={handleDelete}>Delete</button>}
                </div>
            </form>
        </div>
    );
};

const ClassEditor = () => {
    return (
        <Routes>
            <Route path="/" element={<ClassList />} />
            <Route path="new" element={<ClassForm />} />
            <Route path=":id" element={<ClassForm />} />
        </Routes>
    );
};


interface EffectLayer {
    id: string;
    name: string;
    type: 'points' | 'line' | 'mesh';
    geometryType: 'box' | 'sphere' | 'ring';
    vertexShader: string;
    fragmentShader: string;
    count: number;
    blending: string;
    attributeConfig?: {
        sizeStart?: number;
        sizeEnd?: number;
        kindPattern?: string;
    };
}

interface EffectUniform {
    name: string;
    type: 'float' | 'vec2' | 'vec3' | 'color';
    value: any;
    min?: number;
    max?: number;
}

interface Effect {
    id: string;
    name: string;
    layers: EffectLayer[];
    uniforms: EffectUniform[];
}

const EffectPreview = ({ effect }: { effect: Effect }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [error, setError] = useState<string | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const materialsRef = useRef<THREE.ShaderMaterial[]>([]);
    const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d');

    useEffect(() => {
        if (!containerRef.current) return;

        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;

        const scene = new THREE.Scene();
        sceneRef.current = scene;

        let camera: THREE.Camera;
        if (viewMode === '3d') {
            const pCamera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
            pCamera.position.z = 2;
            pCamera.position.y = 1;
            pCamera.lookAt(0, 0, 0);
            camera = pCamera;
        } else {
            const aspect = width / height;
            const frustumSize = 5;
            const oCamera = new THREE.OrthographicCamera(
                frustumSize * aspect / -2,
                frustumSize * aspect / 2,
                frustumSize / 2,
                frustumSize / -2,
                0.1,
                1000
            );
            oCamera.position.set(0, 0, 5); // Top down
            oCamera.lookAt(0, 0, 0);
            camera = oCamera;
        }

        const renderer = new THREE.WebGLRenderer({ alpha: true });
        renderer.setSize(width, height);
        containerRef.current.innerHTML = '';
        containerRef.current.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // Grid helper
        const grid = new THREE.GridHelper(10, 10, 0x444444, 0x222222);
        if (viewMode === '2d') {
            grid.rotation.x = Math.PI / 2; // Rotate grid for top-down view if needed, or just keep it flat
        }
        scene.add(grid);

        materialsRef.current = [];
        setError(null);

        effect.layers.forEach((layer) => {
            let geometry: THREE.BufferGeometry;
            const count = layer.count || 100;

            if (layer.type === 'points' || layer.type === 'line') {
                geometry = new THREE.BufferGeometry();
                const positions = new Float32Array(count * 3);
                const sizes = new Float32Array(count);
                const colors = new Float32Array(count * 3);
                const alphas = new Float32Array(count);
                const kinds = new Float32Array(count);
                const angles = new Float32Array(count);

                const kindPattern = layer.attributeConfig?.kindPattern
                    ? layer.attributeConfig.kindPattern.split(',').map(Number)
                    : [0, 1, 2];

                for (let i = 0; i < count; i++) {
                    const t = i / (count - 1 || 1);

                    if (layer.geometryType === 'ring') {
                        const angle = t * Math.PI * 2;
                        const r = 1.0;
                        positions[i * 3] = Math.cos(angle) * r;
                        positions[i * 3 + 1] = 0;
                        positions[i * 3 + 2] = Math.sin(angle) * r;
                        angles[i] = angle;
                    } else if (layer.geometryType === 'sphere') {
                        const theta = Math.random() * Math.PI * 2;
                        const phi = Math.acos(2 * Math.random() - 1);
                        const r = 1.0;
                        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
                        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
                        positions[i * 3 + 2] = r * Math.cos(phi);
                        angles[i] = theta;
                    } else {
                        // Box (default)
                        positions[i * 3] = (Math.random() - 0.5) * 2;
                        positions[i * 3 + 1] = (Math.random() - 0.5) * 2;
                        positions[i * 3 + 2] = (Math.random() - 0.5) * 2;
                        angles[i] = 0;
                    }

                    // Size gradient
                    const startSize = layer.attributeConfig?.sizeStart ?? 1.0;
                    const endSize = layer.attributeConfig?.sizeEnd ?? 0.0;
                    sizes[i] = startSize * (1 - t) + endSize * t;

                    colors[i * 3] = 1;
                    colors[i * 3 + 1] = 1;
                    colors[i * 3 + 2] = 1;
                    alphas[i] = 1;

                    // Kind pattern
                    kinds[i] = kindPattern[i % kindPattern.length];
                }

                geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
                geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
                geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
                geometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));
                geometry.setAttribute('kind', new THREE.BufferAttribute(kinds, 1));
                geometry.setAttribute('angle', new THREE.BufferAttribute(angles, 1));
            } else {
                geometry = new THREE.BoxGeometry(1, 1, 1);
            }

            // Prepare uniforms
            const uniforms: any = {
                uTime: { value: 0 },
            };
            effect.uniforms.forEach(u => {
                if (u.type === 'color') {
                    uniforms[u.name] = { value: new THREE.Color(u.value) };
                } else if (u.type === 'vec2') {
                    uniforms[u.name] = { value: new THREE.Vector2(u.value[0], u.value[1]) };
                } else if (u.type === 'vec3') {
                    uniforms[u.name] = { value: new THREE.Vector3(u.value[0], u.value[1], u.value[2]) };
                } else {
                    uniforms[u.name] = { value: u.value };
                }
            });

            let material: THREE.ShaderMaterial;
            try {
                material = new THREE.ShaderMaterial({
                    uniforms,
                    vertexShader: layer.vertexShader,
                    fragmentShader: layer.fragmentShader,
                    transparent: true,
                    blending: layer.blending === 'additive' ? THREE.AdditiveBlending : THREE.NormalBlending,
                    depthWrite: false,
                    side: THREE.DoubleSide
                });
            } catch (e: any) {
                console.error(e);
                setError(e.message);
                material = new THREE.ShaderMaterial({
                    vertexShader: `void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
                    fragmentShader: `void main() { gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); }`
                });
            }
            materialsRef.current.push(material);

            let mesh: THREE.Object3D;
            if (layer.type === 'points') {
                mesh = new THREE.Points(geometry, material);
            } else if (layer.type === 'line') {
                mesh = new THREE.Line(geometry, material);
            } else {
                mesh = new THREE.Mesh(geometry, material);
            }
            scene.add(mesh);
        });

        const startTime = Date.now();
        let animationId: number;

        const animate = () => {
            animationId = requestAnimationFrame(animate);
            const elapsed = (Date.now() - startTime) / 1000;

            materialsRef.current.forEach(mat => {
                if (mat.uniforms.uTime) {
                    mat.uniforms.uTime.value = elapsed;
                }
                // Update other uniforms if needed (though React state updates trigger re-render of this component)
            });

            // Simple camera orbit
            // camera.position.x = Math.sin(elapsed * 0.2) * 2;
            // camera.position.z = Math.cos(elapsed * 0.2) * 2;
            // camera.lookAt(0, 0, 0);

            renderer.render(scene, camera);
        };

        animate();

        return () => {
            cancelAnimationFrame(animationId);
            renderer.dispose();
            // Dispose geometries and materials
        };
    }, [effect, viewMode]);

    return (
        <div style={{ width: '100%', height: '400px', background: '#000', borderRadius: '8px', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 10 }}>
                <button
                    className="btn btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '4px 8px' }}
                    onClick={() => setViewMode(viewMode === '3d' ? '2d' : '3d')}
                >
                    {viewMode === '3d' ? 'Switch to 2D' : 'Switch to 3D'}
                </button>
            </div>
            <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
            {error && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(255,0,0,0.8)', color: 'white', padding: '10px', fontSize: '0.8rem' }}>{error}</div>}
        </div>
    );
};


const EffectList = () => {
    const [effects, setEffects] = useState<Effect[]>([]);
    const navigate = useNavigate();

    useEffect(() => {
        fetchEffects();
    }, []);

    const fetchEffects = async () => {
        const res = await fetch('http://localhost:3000/api/effects');
        const data = await res.json();
        setEffects(data);
    };

    return (
        <div>
            <div className="editor-header">
                <h2 className="editor-title">Effects Database</h2>
                <button className="btn btn-primary" onClick={() => navigate('new')}>+ New Effect</button>
            </div>
            <div className="card-grid">
                {effects.map(e => (
                    <div key={e.id} className="card" onClick={() => navigate(e.id)}>
                        <h3>{e.name}</h3>
                        <p>Layers: {e.layers?.length || 0}</p>
                        <p style={{ fontSize: '0.85rem', opacity: 0.7 }}>
                            {e.layers?.map(l => l.type).join(', ') || 'No layers'}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
};

const EffectForm = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [editing, setEditing] = useState<Effect | null>(null);
    const [activeLayerIndex, setActiveLayerIndex] = useState<number>(0);
    const [activeTab, setActiveTab] = useState<'vertex' | 'fragment'>('vertex');
    const isNew = !id;

    useEffect(() => {
        if (!isNew && id) {
            fetch('http://localhost:3000/api/effects')
                .then(res => res.json())
                .then((all: Effect[]) => {
                    const found = all.find(e => e.id === id);
                    if (found) {
                        // Migration check
                        if (!found.layers) {
                            found.layers = [{
                                id: 'default',
                                name: 'Base Layer',
                                type: 'points',
                                geometryType: 'box',
                                vertexShader: (found as any).vertexShader || '',
                                fragmentShader: (found as any).fragmentShader || '',
                                count: (found as any).config?.particleCount || 100,
                                blending: 'additive'
                            }];
                            found.uniforms = [];
                        }
                        setEditing(found);
                    }
                });
        } else {
            setEditing({
                id: '',
                name: '',
                layers: [{
                    id: 'layer_1',
                    name: 'Particles',
                    type: 'points',
                    geometryType: 'box',
                    count: 100,
                    blending: 'additive',
                    attributeConfig: {
                        sizeStart: 1.0,
                        sizeEnd: 0.0,
                        kindPattern: '0,1,2'
                    },
                    vertexShader: `
attribute float size;
attribute vec3 color;
attribute float alpha;
varying vec3 vColor;
varying float vAlpha;
uniform float uTime;

void main() {
    vColor = color;
    vAlpha = alpha;
    vec3 pos = position;
    // Simple movement
    pos.y += sin(uTime + position.x * 10.0) * 0.2;
    
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = size * 100.0 / -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;
}
                    `.trim(),
                    fragmentShader: `
uniform float uTime;
varying vec3 vColor;
varying float vAlpha;

void main() {
    float dist = length(gl_PointCoord - 0.5);
    if (dist > 0.5) discard;
    gl_FragColor = vec4(vColor, vAlpha);
}
                    `.trim()
                }],
                uniforms: [
                    { name: 'uSpeed', type: 'float', value: 1.0, min: 0, max: 5 }
                ]
            });
        }
    }, [id, isNew]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editing) return;

        await fetch('http://localhost:3000/api/effects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(editing)
        });

        navigate('..');
    };

    const handleDelete = async () => {
        if (!editing || !confirm('Are you sure you want to delete this effect?')) return;
        await fetch(`http://localhost:3000/api/effects/${editing.id}`, { method: 'DELETE' });
        navigate('..');
    };

    const addLayer = () => {
        if (!editing) return;
        const newLayer: EffectLayer = {
            id: `layer_${Date.now()}`,
            name: 'New Layer',
            type: 'points',
            geometryType: 'box',
            count: 100,
            blending: 'additive',
            attributeConfig: {
                sizeStart: 1.0,
                sizeEnd: 0.0,
                kindPattern: '0,1,2'
            },
            vertexShader: 'void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = 10.0; }',
            fragmentShader: 'void main() { gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0); }'
        };
        setEditing({ ...editing, layers: [...editing.layers, newLayer] });
        setActiveLayerIndex(editing.layers.length);
    };

    const removeLayer = (index: number) => {
        if (!editing || editing.layers.length <= 1) return;
        const newLayers = [...editing.layers];
        newLayers.splice(index, 1);
        setEditing({ ...editing, layers: newLayers });
        setActiveLayerIndex(Math.max(0, index - 1));
    };

    const updateLayer = (index: number, updates: Partial<EffectLayer>) => {
        if (!editing) return;
        const newLayers = [...editing.layers];
        newLayers[index] = { ...newLayers[index], ...updates };
        setEditing({ ...editing, layers: newLayers });
    };

    const addUniform = () => {
        if (!editing) return;
        const newUniform: EffectUniform = { name: 'uNew', type: 'float', value: 0.5, min: 0, max: 1 };
        setEditing({ ...editing, uniforms: [...editing.uniforms, newUniform] });
    };

    const updateUniform = (index: number, updates: Partial<EffectUniform>) => {
        if (!editing) return;
        const newUniforms = [...editing.uniforms];
        newUniforms[index] = { ...newUniforms[index], ...updates };
        setEditing({ ...editing, uniforms: newUniforms });
    };

    const removeUniform = (index: number) => {
        if (!editing) return;
        const newUniforms = [...editing.uniforms];
        newUniforms.splice(index, 1);
        setEditing({ ...editing, uniforms: newUniforms });
    };

    if (!editing) return <div>Loading...</div>;

    const activeLayer = editing.layers[activeLayerIndex];

    return (
        <div className="form-container" style={{ maxWidth: '1400px', display: 'grid', gridTemplateColumns: '350px 1fr 400px', gap: '20px', height: '90vh' }}>
            {/* Left Column: Configuration */}
            <div style={{ overflowY: 'auto', paddingRight: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2>{isNew ? 'Create' : 'Edit'}</h2>
                    <button className="btn btn-secondary" onClick={() => navigate('..')}>Back</button>
                </div>

                <div className="form-group">
                    <label className="form-label">ID</label>
                    <input className="form-input" value={editing.id} onChange={e => setEditing({ ...editing, id: e.target.value })} disabled={!isNew} required />
                </div>
                <div className="form-group">
                    <label className="form-label">Name</label>
                    <input className="form-input" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} required />
                </div>

                <hr style={{ borderColor: 'rgba(255,255,255,0.1)', margin: '20px 0' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h3 style={{ margin: 0 }}>Uniforms</h3>
                    <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '0.8rem' }} onClick={addUniform}>+</button>
                </div>
                {editing.uniforms.map((u, idx) => (
                    <div key={idx} style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', gap: '5px', marginBottom: '5px' }}>
                            <input className="form-input" style={{ padding: '5px' }} value={u.name} onChange={e => updateUniform(idx, { name: e.target.value })} />
                            <select className="form-select" style={{ padding: '5px', width: '80px' }} value={u.type} onChange={e => updateUniform(idx, { type: e.target.value as any })}>
                                <option value="float">Float</option>
                                <option value="vec2">Vec2</option>
                                <option value="vec3">Vec3</option>
                                <option value="color">Color</option>
                            </select>
                            <button className="btn btn-danger" style={{ padding: '2px 8px' }} onClick={() => removeUniform(idx)}>x</button>
                        </div>
                        {u.type === 'float' && (
                            <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                                <input type="range" min={u.min || 0} max={u.max || 1} step={0.01} value={u.value} onChange={e => updateUniform(idx, { value: parseFloat(e.target.value) })} style={{ flex: 1 }} />
                                <span style={{ fontSize: '0.8rem', width: '40px' }}>{u.value.toFixed(2)}</span>
                            </div>
                        )}
                        {u.type === 'color' && (
                            <input type="color" value={u.value} onChange={e => updateUniform(idx, { value: e.target.value })} style={{ width: '100%' }} />
                        )}
                    </div>
                ))}

                <hr style={{ borderColor: 'rgba(255,255,255,0.1)', margin: '20px 0' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h3 style={{ margin: 0 }}>Layers</h3>
                    <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '0.8rem' }} onClick={addLayer}>+</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {editing.layers.map((layer, idx) => (
                        <div
                            key={layer.id}
                            onClick={() => setActiveLayerIndex(idx)}
                            style={{
                                padding: '10px',
                                borderRadius: '8px',
                                background: activeLayerIndex === idx ? 'rgba(51, 51, 255, 0.2)' : 'rgba(0,0,0,0.2)',
                                border: activeLayerIndex === idx ? '1px solid #3333ff' : '1px solid transparent',
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}
                        >
                            <span>{layer.name}</span>
                            <button className="btn btn-danger" style={{ padding: '2px 6px', fontSize: '0.7rem' }} onClick={(e) => { e.stopPropagation(); removeLayer(idx); }}>x</button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Middle Column: Shader Editor */}
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {activeLayer && (
                    <>
                        <div style={{ marginBottom: '10px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                            <input className="form-input" value={activeLayer.name} onChange={e => updateLayer(activeLayerIndex, { name: e.target.value })} placeholder="Layer Name" style={{ flex: 1, minWidth: '150px' }} />
                            <select className="form-select" value={activeLayer.type} onChange={e => updateLayer(activeLayerIndex, { type: e.target.value as any })}>
                                <option value="points">Points</option>
                                <option value="line">Line</option>
                            </select>
                            <select className="form-select" value={activeLayer.geometryType || 'box'} onChange={e => updateLayer(activeLayerIndex, { geometryType: e.target.value as any })}>
                                <option value="box">Box</option>
                                <option value="sphere">Sphere</option>
                                <option value="ring">Ring</option>
                            </select>
                            <input type="number" className="form-input" value={activeLayer.count} onChange={e => updateLayer(activeLayerIndex, { count: parseInt(e.target.value) })} placeholder="Count" style={{ width: '80px' }} />
                        </div>

                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px', marginBottom: '10px' }}>
                            <h4 style={{ margin: '0 0 5px 0', fontSize: '0.8rem', color: '#aaa' }}>Attribute Config</h4>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '0.7rem', display: 'block' }}>Size Start</label>
                                    <input type="number" step="0.01" className="form-input" value={activeLayer.attributeConfig?.sizeStart ?? 1.0} onChange={e => updateLayer(activeLayerIndex, { attributeConfig: { ...activeLayer.attributeConfig!, sizeStart: parseFloat(e.target.value) } })} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '0.7rem', display: 'block' }}>Size End</label>
                                    <input type="number" step="0.01" className="form-input" value={activeLayer.attributeConfig?.sizeEnd ?? 0.0} onChange={e => updateLayer(activeLayerIndex, { attributeConfig: { ...activeLayer.attributeConfig!, sizeEnd: parseFloat(e.target.value) } })} />
                                </div>
                                <div style={{ flex: 2 }}>
                                    <label style={{ fontSize: '0.7rem', display: 'block' }}>Kind Pattern (csv)</label>
                                    <input className="form-input" value={activeLayer.attributeConfig?.kindPattern ?? '0,1,2'} onChange={e => updateLayer(activeLayerIndex, { attributeConfig: { ...activeLayer.attributeConfig!, kindPattern: e.target.value } })} />
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', marginBottom: '0' }}>
                            <button
                                className={`btn ${activeTab === 'vertex' ? 'btn-primary' : 'btn-secondary'}`}
                                style={{ borderRadius: '8px 8px 0 0', marginRight: '2px' }}
                                onClick={() => setActiveTab('vertex')}
                            >
                                Vertex Shader
                            </button>
                            <button
                                className={`btn ${activeTab === 'fragment' ? 'btn-primary' : 'btn-secondary'}`}
                                style={{ borderRadius: '8px 8px 0 0' }}
                                onClick={() => setActiveTab('fragment')}
                            >
                                Fragment Shader
                            </button>
                        </div>
                        <textarea
                            className="form-textarea"
                            style={{
                                flex: 1,
                                fontFamily: 'monospace',
                                fontSize: '0.9rem',
                                borderRadius: '0 8px 8px 8px',
                                resize: 'none',
                                whiteSpace: 'pre'
                            }}
                            value={activeTab === 'vertex' ? activeLayer.vertexShader : activeLayer.fragmentShader}
                            onChange={e => updateLayer(activeLayerIndex, activeTab === 'vertex' ? { vertexShader: e.target.value } : { fragmentShader: e.target.value })}
                        />
                    </>
                )}
            </div>

            {/* Right Column: Preview */}
            <div>
                <h3 style={{ marginBottom: '20px' }}>Preview</h3>
                <EffectPreview effect={editing} />

                <div style={{ marginTop: '20px' }}>
                    <button type="submit" className="btn btn-primary" style={{ width: '100%' }} onClick={handleSave}>Save Effect</button>
                    {!isNew && <button type="button" className="btn btn-danger" style={{ width: '100%', marginTop: '10px' }} onClick={handleDelete}>Delete</button>}
                </div>
            </div>
        </div>
    );
};

const EffectEditor = () => {
    return (
        <Routes>
            <Route path="/" element={<EffectList />} />
            <Route path="new" element={<EffectForm />} />
            <Route path=":id" element={<EffectForm />} />
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
                    to="/admin/classes"
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    style={{ textDecoration: 'none', color: 'inherit', padding: '15px 20px', display: 'block' }}
                >
                    Classes
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
                <NavLink
                    to="/admin/effects"
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    style={{ textDecoration: 'none', color: 'inherit', padding: '15px 20px', display: 'block' }}
                >
                    Effects
                </NavLink>
            </div>
            <div style={{ flex: 1, overflow: 'hidden', padding: '20px' }}>
                <Routes>
                    <Route path="monsters/*" element={<MonsterEditor />} />
                    <Route path="classes/*" element={<ClassEditor />} />
                    <Route path="skills/*" element={<SkillEditor />} />
                    <Route path="maps/*" element={<MapEditor />} />
                    <Route path="tilesets/*" element={<TilesetEditor />} />
                    <Route path="sprites/*" element={<SpriteEditor />} />
                    <Route path="effects/*" element={<EffectEditor />} />
                    <Route path="*" element={<Navigate to="monsters" replace />} />
                </Routes>
            </div>
        </div>
    );
};
