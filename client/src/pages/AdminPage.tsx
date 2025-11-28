import React, { useState, useEffect, useRef } from 'react';

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
    const [swatchSets, setSwatchSets] = useState<any[]>([]);
    const [activeSetId, setActiveSetId] = useState<string>('');
    const [selectedSwatch, setSelectedSwatch] = useState<any | null>(null);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchMap();
        fetchSwatches();
    }, []);

    const fetchMap = async () => {
        const res = await fetch('http://localhost:3000/api/map');
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
        alert('Saving ' + (mapData.placedSwatches?.length || 0) + ' swatches');
        await fetch('http://localhost:3000/api/map', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(mapData)
        });
        alert('Map saved successfully!');
    };

    const handleWheel = (e: React.WheelEvent) => {
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        setZoom(z => Math.min(Math.max(z * delta, 0.1), 5));
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        // alert('Map MouseDown: button=' + e.button);
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
            // Drag paint
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

        // alert('Placed at ' + gx + ',' + gy);

        // Check if already placed at this location (simple check)
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
                <h2 className="editor-title">Map Editor ({mapData.name})</h2>
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

                    <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))', gap: '8px', alignContent: 'start' }}>
                        {activeSwatches.map((s: any) => (
                            <div
                                key={s.id}
                                onClick={() => setSelectedSwatch(s)}
                                style={{
                                    cursor: 'pointer',
                                    borderRadius: '4px',
                                    border: selectedSwatch?.id === s.id ? '2px solid #ffcc00' : '1px solid #444',
                                    background: '#222',
                                    padding: '4px',
                                    textAlign: 'center',
                                    fontSize: '0.7rem'
                                }}
                            >
                                <div style={{ marginBottom: '4px' }}>{s.name}</div>
                                <div style={{ color: '#666' }}>{s.gridSize}px</div>
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
                    <div
                        style={{
                            position: 'absolute',
                            left: 0, top: 0,
                            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                            transformOrigin: '0 0',
                            width: mapData.width * 32, // Assuming 32px grid
                            height: mapData.height * 32,
                            background: '#222'
                        }}
                    >
                        {/* Grid Lines */}
                        <div
                            style={{
                                position: 'absolute',
                                width: '100%',
                                height: '100%',
                                backgroundImage: `
                                    linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px),
                                    linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px)
                                `,
                                backgroundSize: '32px 32px',
                                pointerEvents: 'none'
                            }}
                        />

                        {/* Placed Swatches */}
                        {mapData.placedSwatches?.map(p => {
                            // Find swatch
                            let swatchDef = null;
                            for (const set of swatchSets) {
                                const found = set.swatches.find((s: any) => s.id === p.swatchId);
                                if (found) {
                                    swatchDef = found;
                                    break;
                                }
                            }
                            if (!swatchDef) return null;

                            return (
                                <div
                                    key={p.instanceId}
                                    style={{
                                        position: 'absolute',
                                        left: p.x,
                                        top: p.y,
                                        width: swatchDef.gridSize || 32,
                                        height: swatchDef.gridSize || 32,
                                        pointerEvents: 'none'
                                    }}
                                >
                                    {/* Render tiles of the swatch */}
                                    {swatchDef.tiles && swatchDef.tiles.length > 0 && swatchDef.tiles.map((t: any, i: number) => (
                                        <div
                                            key={i}
                                            style={{
                                                position: 'absolute',
                                                left: t.x - swatchDef.tiles[0].x,
                                                top: t.y - swatchDef.tiles[0].y,
                                                width: swatchDef.gridSize,
                                                height: swatchDef.gridSize,
                                                backgroundImage: `url(/assets/tilesets/${swatchDef.tileset}.png)`,
                                                backgroundPosition: `-${t.x}px -${t.y}px`,
                                                backgroundSize: 'auto'
                                            }}
                                        />
                                    ))}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

const TilesetEditor = () => {
    const [tilesets, setTilesets] = useState<string[]>([]);
    const [selectedTileset, setSelectedTileset] = useState<string | null>(null);
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
    const [activeSetId, setActiveSetId] = useState<string>('default_set');
    const [swatchName, setSwatchName] = useState('');
    const [swatchWalkable, setSwatchWalkable] = useState(true);

    // Container ref for fit-to-view calculation
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchTilesets();
        fetchSwatches();
    }, []);

    const fetchTilesets = async () => {
        const res = await fetch('http://localhost:3000/api/tilesets');
        const data = await res.json();
        setTilesets(data);
    };

    const fetchSwatches = async () => {
        const res = await fetch('http://localhost:3000/api/swatches');
        const data = await res.json();
        setSwatchSets(data);
        if (data.length > 0 && !activeSetId) {
            setActiveSetId(data[0].id);
        }
    };

    const handleSelect = async (name: string) => {
        if (selectedTileset === name) return;
        setSelectedTileset(name);
        const res = await fetch(`http://localhost:3000/api/tilesets/${name}`);
        const data = await res.json();
        if (data.texture) setPreviewImage(data.texture);
        if (data.tileSize) setGridSize(data.tileSize);
        setSelectionStart(null);
        setSelectionEnd(null);
    };

    const handleSwatchClick = async (swatch: any) => {
        // 1. Select the tileset if not already selected
        if (selectedTileset !== swatch.tileset) {
            await handleSelect(swatch.tileset);
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

                        <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))', gap: '8px', alignContent: 'start' }}>
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
                                        overflow: 'hidden',
                                        display: 'flex',
                                        flexDirection: 'column'
                                    }}
                                >
                                    <div style={{ width: '100%', aspectRatio: '1', position: 'relative', background: '#000' }}>
                                        {/* Render preview using background-image trick */}
                                        {s.tiles.length > 0 && (
                                            <div style={{
                                                width: '100%',
                                                height: '100%',
                                                backgroundImage: `url(/assets/tilesets/${s.tileset}.png)`,
                                                backgroundPosition: `-${s.tiles[0].x}px -${s.tiles[0].y}px`,
                                                backgroundSize: 'cover', // This is tricky. We need actual pixel mapping.
                                                // Better approach: Use a small canvas or just show the first tile if it's simple.
                                                // Let's try to just show the first tile scaled up.
                                                // If we know the texture size, we can use background-size: auto.
                                                // But we don't know texture size here easily without loading it.
                                                // Alternative: Just use a colored block or text if image loading is complex.
                                                // Let's try a simpler approach: Just show the name and size for now, 
                                                // but user asked for "grid view with name and size".
                                            }}>
                                                {/* 
                                                    Ideally we'd use a canvas here to draw the specific tiles. 
                                                    For now, let's use a placeholder icon or simple div.
                                                */}
                                                <div style={{
                                                    width: '100%', height: '100%',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: '0.7rem', color: '#666'
                                                }}>
                                                    Preview
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ padding: '4px', fontSize: '0.7rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'center' }}>
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
                    <div className={`nav-item ${activeTab === 'tilesets' ? 'active' : ''}`} onClick={() => setActiveTab('tilesets')}>
                        🎨 Tilesets
                    </div>
                </div>
                <div className="main-content">
                    {activeTab === 'monsters' && <MonsterEditor />}
                    {activeTab === 'skills' && <SkillEditor />}
                    {activeTab === 'map' && <MapEditor />}
                    {activeTab === 'tilesets' && <TilesetEditor />}
                </div>
            </div>
        </>
    );
}
