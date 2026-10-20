export const CollisionCategories = {
    DEFAULT: 0x0001,
    TANK: 0x0002,
    WALL: 0x0004,
    WATER: 0x0008,
    PROJECTILE: 0x0010,
    PROJECTILE_BOUNCING: 0x0020,
    PICKUP: 0x0040,
    SENSOR: 0x0080,
} as const;
