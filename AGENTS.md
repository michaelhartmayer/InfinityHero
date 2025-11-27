# Agents Guide: VibeMaster MMORPG

> [!IMPORTANT]
> **Project Identity**: This project is named **VibeMaster**, a 2D/2.5D Top-Down MMORPG.
> **Directory Note**: The project is currently located in a directory named `InfinityHero`. Do not be confused by the folder name; the codebase is VibeMaster.
> **Agents**: This document must be kept up to date with any changes to the codebase so that AI agents are properly informed.

## 1. Project Overview
VibeMaster is a browser-based MMORPG using a **Client-Server** architecture.
- **Frontend**: React + Three.js (Orthographic View).
- **Backend**: Node.js + Express + Socket.io.
- **Shared**: Common TypeScript types and constants.

## 2. Technology Stack
- **Language**: TypeScript (Strict mode).
- **Build Tool**: Vite (Client), `tsc` (Server).
- **Rendering**: Three.js (Standard Library), `three-stdlib` (CSS2DRenderer, EffectComposer).
- **Networking**: Socket.io (Real-time bidirectional communication).
- **State Management**: React State (UI), Custom `EntityManager` (Game Logic).

## 3. Architecture & Nuances

### 3.1 Shared Library (`/shared`)
- **Purpose**: Single source of truth for types, constants, and events.
- **Key Files**:
    - `index.ts`: Exports all types (`Player`, `Monster`, `Item`, `GameState`) and `EVENTS` enum.
    - `CONSTANTS`: Defines `TICK_RATE` (60Hz), `TILE_SIZE`, etc.
- **Agent Rule**: If you modify a packet structure or entity property, **YOU MUST UPDATE SHARED FIRST**.

### 3.2 Server (`/server`)
- **Entry Point**: `src/index.ts` (Setup Express, Socket.io, Managers).
- **Game Loop**: `src/GameLoop.ts` runs at 60 ticks/sec.
    - Updates entity positions.
    - Handles monster AI (`MonsterStrategyType`).
    - Broadcasts `STATE_UPDATE` to all clients.
- **Managers**:
    - `WorldManager`: Handles Map data and **A* Pathfinding**.
    - `EntityManager`: CRUD for Players, Monsters, Items.
- **Movement Logic**: Server-authoritative. Clients send `PLAYER_MOVE` (target x,y), Server calculates path, assigns `movePath` to player, and updates position tick-by-tick.

### 3.3 Client (`/client`)
- **Entry Point**: `src/main.tsx` -> `App.tsx`.
- **Rendering Strategy**:
    - **NOT** using `react-three-fiber`.
    - Uses a custom `GameRenderer` class (`src/game/GameRenderer.ts`) that manages the `THREE.Scene` imperatively.
    - `GameCanvas` component acts as a wrapper/bridge.
- **UI Overlay**:
    - React components (`HUD`, `ChatWindow`, `Inventory`) float **over** the canvas.
    - **In-Scene Labels**: Uses `CSS2DRenderer` for player names and chat bubbles to keep text crisp and DOM-accessible.
- **Interpolation**: Client receives state updates and interpolates entity positions (`lerp`) for smooth rendering between server ticks.

### 3.4 VFX Library (`/client/src/vfx`)
- **Purpose**: Manages post-processing effects and visual enhancements via `three-stdlib`'s `EffectComposer`.
- **Key Files**:
    - `VFXLibrary.ts`: Main manager. Initializes `EffectComposer` and handles the render loop.
    - `effects/`: Contains individual effect wrappers (e.g., `BloomEffect.ts`).
- **Integration**:
    - `GameRenderer` delegates the final render call to `vfxLibrary.render(deltaTime)`.
    - **Resize**: Must forward resize events to `vfxLibrary.resize()`.
- **Adding Effects**:
    1. Create a class in `client/src/vfx/effects`.
    2. Instantiate it in `VFXLibrary` constructor.
    3. Add its `pass` to the `composer`.

## 4. Key Workflows

### Adding a New Entity
1.  **Shared**: Define interface in `shared/src/index.ts` (extend `Entity`).
2.  **Server**: Add storage in `EntityManager`, spawn logic in `index.ts` or `GameLoop`.
3.  **Client**: Update `GameRenderer.ts` to instantiate/update the mesh for the new entity type.

### Adding a Network Event
1.  **Shared**: Add key to `EVENTS` object in `shared/src/index.ts`.
2.  **Server**: Add `socket.on(EVENTS.NEW_EVENT, ...)` in `index.ts`.
3.  **Client**: Add `socket.emit(EVENTS.NEW_EVENT, ...)` or listener in `App.tsx`.

## 5. Development Setup
- **Install**: `npm install` in root (if workspaces set up) or in each folder.
- **Run Client**: `cd client && npm run dev`
- **Run Server**: `cd server && npm run dev` (uses `tsx` or `ts-node` via `nodemon` usually).

## 6. Common Pitfalls
- **Pathfinding**: The server calculates paths. If entities walk through walls, check `WorldManager` collision logic.
- **Pink Screen**: Usually means a shader error or missing texture in Three.js.
- **Desync**: If client/server positions drift, check the interpolation logic in `GameRenderer.updatePlayers`.
- **Shared Updates**: If `shared` changes aren't picked up, ensure the build script for shared is run or that `ts-node` on server is resolving the raw TS files correctly.

## 7. Code Style
- Use **Explicit Types**. Avoid `any`.
- Prefer `interface` over `type` for public APIs.
- Keep `GameRenderer` pure rendering logic; move game logic to `App.tsx` or Server.