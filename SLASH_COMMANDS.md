# Slash Commands Implementation

## Overview
I've successfully implemented slash commands for the VibeMaster game chat system. Players can now use special commands to perform various actions.

## Available Commands

### `/help`
- **Usage**: `/help`
- **Description**: Lists all available commands
- **Response**: Displays the command list in the chat window

### `/alias [name]`
- **Usage**: `/alias [new name]`
- **Description**: Changes your character name
- **Example**: `/alias DragonSlayer`
- **Limits**: Name is limited to 20 characters

### `/respawn`
- **Usage**: `/respawn`
- **Description**: Respawns you at the starting location (5, 5)
- **Effect**: Restores full HP and teleports you to spawn

### `/spawn [monster id] [quantity]`
- **Usage**: `/spawn [monster id] [quantity]`
- **Description**: Spawns monsters around your current location
- **Example**: `/spawn slime_green 5`
- **Default**: If quantity is not specified, spawns 1 monster
- **Limits**: Maximum 10 monsters per command
- **Spawn Area**: Monsters spawn within a 5x5 area around you
- **Available Monster IDs**:
  - `slime_green` - Green Slime (Level 1)
  - `slime_blue` - Blue Slime (Level 2)
  - `goblin_scout` - Goblin Scout (Level 3)
  - `goblin_warrior` - Goblin Warrior (Level 5)
  - `wolf_gray` - Gray Wolf (Level 4)
  - `wolf_dire` - Dire Wolf (Level 7)
  - `skeleton` - Skeleton (Level 6)
  - `zombie` - Zombie (Level 5)
  - `spider_small` - Small Spider (Level 2)
  - `spider_giant` - Giant Spider (Level 8)
  - `bat_cave` - Cave Bat (Level 3)
  - `orc_grunt` - Orc Grunt (Level 10)
  - `orc_shaman` - Orc Shaman (Level 12)
  - `troll` - Troll (Level 15)
  - `dragon_whelp` - Dragon Whelp (Level 20)

### `/broadcast [message]`
- **Usage**: `/broadcast [message]`
- **Description**: Sends a broadcast message to all players
- **Example**: `/broadcast Server maintenance in 5 minutes!`
- **Display**: Shows a large overlay message at the top-center of the screen
- **Duration**: Message displays for 5 seconds
- **Limits**: Message limited to 200 characters

## Technical Implementation

### Files Modified

1. **shared/src/index.ts**
   - Added new event types: `COMMAND_HELP`, `COMMAND_ALIAS`, `COMMAND_RESPAWN`, `COMMAND_SPAWN`, `BROADCAST_MESSAGE`

2. **shared/src/chat.ts**
   - Added `BroadcastMessage` interface

3. **server/src/managers/EntityManager.ts**
   - Added `setPlayerName()` method for the `/alias` command

4. **server/src/index.ts**
   - Implemented slash command parsing and routing
   - Added handlers for all commands
   - Commands starting with `/` are intercepted and processed
   - Regular messages are sent as chat messages

5. **client/src/components/BroadcastOverlay.tsx** (NEW)
   - Created overlay component for broadcast messages
   - Auto-hides after 5 seconds
   - Positioned at top-center of screen

6. **client/src/App.tsx**
   - Added broadcast message state
   - Added event listeners for `BROADCAST_MESSAGE` and `COMMAND_HELP`
   - Integrated `BroadcastOverlay` component

7. **client/src/App.css**
   - Added broadcast overlay styles with glassmorphic design
   - Gradient background with smooth animations

## How to Test

1. **Start the game** (both client and server should be running)

2. **Test /help command**:
   - Press Enter to activate chat mode
   - Type `/help` and press Enter
   - You should see a list of commands in the chat

3. **Test /alias command**:
   - Type `/alias YourNewName`
   - Your character name should change
   - Other players will see your new name

4. **Test /respawn command**:
   - Move your character somewhere
   - Type `/respawn`
   - You should teleport to position (5, 5) with full HP

5. **Test /spawn command**:
   - Type `/spawn slime` to spawn 1 slime
   - Type `/spawn slime 5` to spawn 5 slimes
   - Monsters should appear around your character

6. **Test /broadcast command**:
   - Type `/broadcast Hello everyone!`
   - A large message should appear at the top of the screen for all players
   - It should fade out after 5 seconds

## Error Handling

- Unknown commands show an error message suggesting to use `/help`
- Commands with missing arguments show usage instructions
- Invalid monster IDs show an error message
- Spawn quantity is clamped between 1 and 10

## Notes

- All commands are case-insensitive (e.g., `/HELP` works the same as `/help`)
- System messages appear in chat with "System" as the sender
- Commands do not appear in the chat for other players
- Regular chat messages (without `/`) work as before
