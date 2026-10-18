export interface HullCharacteristics {
    speed: number;
    maxHealth: number;
}

export interface GunCharacteristics {
    damage: number;
    reloadTimeFrames: number; // In frames at 60 FPS
    playerDamage: number;
    playerReloadTimeFrames: number;
}

export const BASE_FPS = 60;
export const MAX_SPEED = 8;

export const CHARACTERISTICS_HULLS: Record<string, HullCharacteristics> = {
    '01': { speed: 4, maxHealth: 210 },
    '02': { speed: 2, maxHealth: 330 },
    '03': { speed: 6, maxHealth: 150 },
    '04': { speed: 8, maxHealth: 50 },
    '05': { speed: 3, maxHealth: 175 },
    '06': { speed: 5, maxHealth: 130 },
    '07': { speed: 6, maxHealth: 90 },
    '08': { speed: 7, maxHealth: 60 }
};

export const CHARACTERISTICS_GUNS: Record<string, GunCharacteristics> = {
    '01': {
        damage: 30,
        reloadTimeFrames: BASE_FPS * 1, // 60 frames
        playerDamage: 30,
        playerReloadTimeFrames: 30 // From start_menu.js changes_functions
    },
    '02': { // Railgun / Tesla
        damage: 50,
        reloadTimeFrames: Math.round(BASE_FPS * 1.5), // 90 frames (100 in addTank)
        playerDamage: 50,
        playerReloadTimeFrames: 70
    },
    '03': { // Ricochet
        damage: 25,
        reloadTimeFrames: BASE_FPS * 4, // 240 frames
        playerDamage: 30,
        playerReloadTimeFrames: 200
    },
    '04': { // Flamethrower
        damage: 1,
        reloadTimeFrames: BASE_FPS * 2, // 120 frames
        playerDamage: 2,
        playerReloadTimeFrames: 86
    },
    '05': { // Freeze
        damage: 13,
        reloadTimeFrames: BASE_FPS * 5, // 300 frames
        playerDamage: 17,
        playerReloadTimeFrames: 180
    },
    '06': { // Twin Gun
        damage: 25,
        reloadTimeFrames: Math.round(BASE_FPS * 1.5), // 90 frames
        playerDamage: 30,
        playerReloadTimeFrames: 50
    },
    '07': { // Thunder
        damage: 40,
        reloadTimeFrames: Math.round(BASE_FPS * 2.5), // 150 frames
        playerDamage: 50,
        playerReloadTimeFrames: 70
    },
    '08': { // Minigun / Machine Gun
        damage: 1,
        reloadTimeFrames: BASE_FPS * 2, // 120 frames
        playerDamage: 1,
        playerReloadTimeFrames: 100
    }
};
