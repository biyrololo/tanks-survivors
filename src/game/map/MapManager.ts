import Phaser from 'phaser';
import { CollisionCategories } from '../config/collisionCategories';
import {
    MAP_WIDTH,
    MAP_HEIGHT,
    WALL_RECTS,
    WATER_RECTS,
    SPAWN_POINTS,
    type ISpawnPoint
} from './mapData';

export default class MapManager {
    private scene: Phaser.Scene;
    public wallBodies: MatterJS.BodyType[] = [];
    public waterBodies: MatterJS.BodyType[] = [];

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }

    public buildMap(): void {
        const { matter, cameras } = this.scene;

        // Set camera bounds to the exact dimensions of map2.png
        cameras.main.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);

        // Set Matter physics world bounds
        matter.world.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);

        // 1. Create Outer Boundary Walls (thick safety margins around edges)
        const wallThickness = 64;
        const outerWalls = [
            // Top
            { x: MAP_WIDTH / 2, y: -wallThickness / 2, w: MAP_WIDTH + wallThickness * 2, h: wallThickness },
            // Bottom
            { x: MAP_WIDTH / 2, y: MAP_HEIGHT + wallThickness / 2, w: MAP_WIDTH + wallThickness * 2, h: wallThickness },
            // Left
            { x: -wallThickness / 2, y: MAP_HEIGHT / 2, w: wallThickness, h: MAP_HEIGHT + wallThickness * 2 },
            // Right
            { x: MAP_WIDTH + wallThickness / 2, y: MAP_HEIGHT / 2, w: wallThickness, h: MAP_HEIGHT + wallThickness * 2 }
        ];

        for (const wall of outerWalls) {
            const body = matter.add.rectangle(wall.x, wall.y, wall.w, wall.h, {
                isStatic: true,
                friction: 0.1,
                restitution: 0,
                collisionFilter: {
                    category: CollisionCategories.WALL,
                    mask: CollisionCategories.TANK | CollisionCategories.PROJECTILE | CollisionCategories.PROJECTILE_BOUNCING
                }
            });
            (body as any).label = 'wall';
            this.wallBodies.push(body);
        }

        // 2. Create Solid Wall Bodies (merged rectangles from collision.js)
        // These block tanks without springy bouncing, and block/bounce bullets
        for (const rect of WALL_RECTS) {
            const centerX = rect.x + rect.w / 2;
            const centerY = rect.y + rect.h / 2;

            const body = matter.add.rectangle(centerX, centerY, rect.w, rect.h, {
                isStatic: true,
                friction: 0.1,
                restitution: 0,
                collisionFilter: {
                    category: CollisionCategories.WALL,
                    mask: CollisionCategories.TANK | CollisionCategories.PROJECTILE | CollisionCategories.PROJECTILE_BOUNCING
                }
            });
            (body as any).label = 'wall';
            this.wallBodies.push(body);
        }

        // 3. Create Water Bodies (merged rectangles from collision.js tiles 42 & 152)
        // Water blocks tanks, but lets bullets fly right over!
        for (const rect of WATER_RECTS) {
            const centerX = rect.x + rect.w / 2;
            const centerY = rect.y + rect.h / 2;

            const body = matter.add.rectangle(centerX, centerY, rect.w, rect.h, {
                isStatic: true,
                friction: 0.1,
                restitution: 0,
                collisionFilter: {
                    category: CollisionCategories.WATER,
                    mask: CollisionCategories.TANK // Bullets not in mask -> fly over water!
                }
            });
            (body as any).label = 'water';
            this.waterBodies.push(body);
        }
    }

    /**
     * Pick a random authentic spawn point from SPAWN_POINTS (spawn_zones.js)
     */
    public getRandomSpawnPoint(): ISpawnPoint {
        const idx = Math.floor(Math.random() * SPAWN_POINTS.length);
        return SPAWN_POINTS[idx];
    }

    /**
     * Check if a position collides with any solid wall or water
     */
    public isPointBlocked(x: number, y: number, radius: number = 40): boolean {
        for (const rect of WALL_RECTS) {
            if (
                x + radius >= rect.x &&
                x - radius <= rect.x + rect.w &&
                y + radius >= rect.y &&
                y - radius <= rect.y + rect.h
            ) {
                return true;
            }
        }
        for (const rect of WATER_RECTS) {
            if (
                x + radius >= rect.x &&
                x - radius <= rect.x + rect.w &&
                y + radius >= rect.y &&
                y - radius <= rect.y + rect.h
            ) {
                return true;
            }
        }
        return false;
    }
}
