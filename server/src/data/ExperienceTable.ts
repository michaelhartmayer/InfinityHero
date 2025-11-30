export const EXPERIENCE_TABLE = {
    1: 300,
    2: 900,
    3: 2700,
    4: 6500,
    5: 14000,
    6: 23000,
    7: 34000,
    8: 48000,
    9: 64000,
    10: 85000,
    11: 100000,
    12: 120000,
    13: 140000,
    14: 165000,
    15: 195000,
    16: 225000,
    17: 265000,
    18: 305000,
    19: 355000,
    20: 355000 // Cap at 20 for now
};

export const getXpForLevel = (level: number): number => {
    // D&D 5e Cumulative XP table
    // But for our game, we might want "XP required to reach next level" if we reset XP bar.
    // Let's stick to the user request: "base it on D&D".
    // If we use cumulative, we need to handle the bar display carefully.
    // 
    // However, the Player interface has `xp` and `maxXp`. 
    // Usually `xp` is current progress and `maxXp` is the target for the NEXT level.
    // So let's convert the cumulative D&D table into "XP needed for this level".

    // Level 1 -> 2: 300 XP
    // Level 2 -> 3: 600 XP (900 total)
    // Level 3 -> 4: 1800 XP (2700 total)

    const table: Record<number, number> = {
        1: 300,
        2: 600,
        3: 1800,
        4: 3800,
        5: 7500,
        6: 9000,
        7: 11000,
        8: 14000,
        9: 16000,
        10: 21000,
        11: 15000,
        12: 20000,
        13: 20000,
        14: 25000,
        15: 30000,
        16: 30000,
        17: 40000,
        18: 40000,
        19: 50000,
        20: 50000
    };

    return table[level] || 50000;
};
