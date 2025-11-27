# Architecture & Abstractions

This document outlines the high-level architecture and key business objects for the VibeMaster MMORPG.

## 🏗 High-Level Architecture

The application follows a standard Client-Server architecture using **Node.js** for the backend and **React + Three.js** for the frontend, communicating via **Socket.io** for real-time state synchronization.

### 🔄 Data Flow
1.  **Input**: Client captures input (Mouse Click, Keys 1-4) -> Sends `ActionPacket` to Server.
2.  **Processing**: Server validates action -> Updates Game State (Position, Health, Cooldowns) -> Checks Collisions/Triggers.
3.  **Broadcast**: Server broadcasts `StateUpdatePacket` to relevant clients (AOI - Area of Interest, or Global for MVP).
4.  **Rendering**: Client receives update -> Interpolates positions -> Renders frame via Three.js -> Updates React UI.

---

## 🖥 Client-Side (Frontend)

### Core Systems
*   **`GameEngine`**: The central controller initializing the Three.js renderer, scene, and main loop.
*   **`NetworkManager`**: Singleton wrapper for `socket.io-client`. Handles connection, reconnection, and event dispatching.
*   **`InputManager`**: Listeners for Mouse (Movement/Targeting) and Keyboard (Skills/Hotkeys). Converts inputs into intent.
*   **`SceneManager`**: Manages the Three.js scene graph, camera controls, and lighting.

### Entity Management
*   **`ClientEntityManager`**: Maintains a registry of all visible entities (`Player`, `Monster`, `Item`). Responsible for spawning, despawning, and smoothing movement (interpolation).
*   **`VisualsSystem`**: Handles animations, particle effects, and mesh updates based on entity state.

### UI (React)
*   **`HUD`**: Overlay components for Health/Energy bars, Experience bar.
*   **`ChatWindow`**: Text log and input for chatting.
*   **`InventoryGrid`**: Drag-and-drop interface for items.
*   **`FloatingText`**: Damage numbers and status effects rendered in world space or screen space.

---

## 📡 Server-Side (Backend)

### Core Systems
*   **`GameServer`**: Entry point. Initializes the HTTP server, Socket.io, and the Game Loop.
*   **`GameLoop`**: A fixed-timestep loop (e.g., 20 ticks/sec) that drives the simulation.
*   **`WorldManager`**: Manages the game map, grid data, and collision detection.

### Business Logic
*   **`EntityManager`**: The source of truth for all entities. Handles unique IDs, state changes, and persistence.
*   **`CombatSystem`**: Calculates damage, applies status effects, handles cooldowns, and resolves death.
*   **`LootSystem`**: Generates loot based on `MonsterTable` and `LootTable` definitions.
*   **`SkillSystem`**: Executes logic for skills (1-4), checking range, resource cost (Energy), and valid targets.

### Data & Persistence
*   **`DatabaseFacade`**: An abstraction layer for data storage.
    *   *Implementation*: `FileSystemAdapter` (writes JSON files to `data/` directory).
    *   *Future*: Can be swapped for `PostgresAdapter` or `MongoAdapter`.

---

## 📦 Shared / Common

*   **`DTOs (Data Transfer Objects)`**: TypeScript interfaces defining the shape of network packets (e.g., `PlayerJoinPacket`, `MovementPacket`, `AttackPacket`).
*   **`Constants`**: Shared configuration (Tick Rate, Tile Size, Max Level).
*   **`Enums`**: `EntityType`, `SkillType`, `ItemRarity`.

## 🧩 Business Objects (Entities)

### `Entity` (Base Class)
*   `id`: string (UUID)
*   `position`: { x, y }
*   `rotation`: number

### `Character` (extends Entity)
*   `stats`: { hp, maxHp, energy, maxEnergy, speed }
*   `level`: number
*   `name`: string
*   `targetId`: string | null

### `Player` (extends Character)
*   `xp`: number
*   `inventory`: Item[]
*   `job`: JobType
*   `socketId`: string

### `Monster` (extends Character)
*   `typeId`: string (refers to MonsterTable)
*   `aggroRange`: number
*   `spawnPoint`: { x, y }

### `Item` (extends Entity - World Object)
*   `itemId`: string
*   `ownerId`: string | null (if reserved for a player)
