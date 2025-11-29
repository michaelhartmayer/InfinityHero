# Game Scripting DSL Reference

This DSL defines behavior for items, skills, buffs, and effects using small,
declarative instructions called **directives**. Each directive describes *when*
something happens (the trigger) and *what* action is performed (the function).

- Every directive ends with `;`
- Lines starting with `#` are comments
- Whitespace and line breaks do not matter

------------------------------------------------------------
1. Syntax
------------------------------------------------------------

TRIGGER FUNCTION Arg1,Arg2,...;

Example:
ACTIVATE heal_target 15,$_self;
ACTIVATE effect heal_aura,@$_self,1500;

------------------------------------------------------------
2. Triggers
------------------------------------------------------------

Triggers determine when directives execute.

Built-in examples:
- ACTIVATE   → When the skill or item is used
- ATTACK     → When an attack occurs
- TICK       → Runs every engine tick
- EQUIP      → When an item is equipped
- UNEQUIP    → When an item is removed

You may define custom event triggers. Example:
FIRE_STORM effect fire_storm,@$_target,1000;

------------------------------------------------------------
3. Functions
------------------------------------------------------------

Functions are actions that run when their trigger fires. Each accepts arguments
specific to the function.

Examples:

damage_target
    ATTACK damage_target amount,target;
    Deals damage to the target.

heal_target
    ACTIVATE heal_target amount,target;
    Heals the target.

effect
    ACTIVATE effect effectId,position,durationMs;
    Spawns a timed effect at coordinates.

add_stat
    EQUIP add_stat statName,value,target;
    Modifies a stat while equipped (reverse with UNEQUIP).

chance
    ATTACK chance percent,function,args...;
    Executes the given function only if a random roll succeeds.

set_element
    ATTACK set_element element,target;
    Tags the outgoing attack with an element.

------------------------------------------------------------
4. Arguments
------------------------------------------------------------

Arguments are comma-separated. No spaces required.

Types:
- integers            (10, 250, 5000)
- identifiers         (heal_aura, fire_storm)
- entity variables    ($_self, $_target)
- coordinate values   (@$_self, @$_target)

------------------------------------------------------------
5. Variables
------------------------------------------------------------

Entity variables:
- $_self      → the entity executing the script
- $_target    → the current target

Coordinate resolution:
Prefixing a variable with @ resolves its world position:
- @$_self     → coordinates of user
- @$_target   → coordinates of target

------------------------------------------------------------
6. Execution Order
------------------------------------------------------------

When a trigger fires:
1. All directives matching that trigger are collected.
2. They run top-to-bottom in the order they appear in the script.

------------------------------------------------------------
7. Example: Simple Heal Skill
------------------------------------------------------------

# When activated, heal self and show aura
ACTIVATE heal_target 20,$_self;
ACTIVATE effect heal_aura,@$_self,1000;

------------------------------------------------------------
8. Example: Fire Dagger
------------------------------------------------------------

# Stats
EQUIP add_stat luck,20,$_self;
UNEQUIP add_stat luck,-20,$_self;

EQUIP add_stat crit_chance,10,$_self;
UNEQUIP add_stat crit_chance,-10,$_self;

# Base damage + fire element
ATTACK damage_target 20,$_target;
ATTACK set_element fire,$_target;

# 5% chance to trigger fire storm
ATTACK chance 5,FIRE_STORM,$_self,$_target;

# Fire storm event
FIRE_STORM effect fire_storm,@$_target,1000;
