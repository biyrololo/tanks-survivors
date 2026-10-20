import Phaser from 'phaser';

import bg from '@/assets/map2.png';
import Tank from '../entities/Tank';
import PlayerController from '../entities/PlayerController';
import { guns, hulls } from '@/assets/Color_A';
import { tracks } from '@/assets/Tracks';
import Projectile from '../entities/Projectile';
import Pickup from '../entities/Pickup';
import MapManager from '../map/MapManager';
import WaveSpawner from '../entities/WaveSpawner';
import { usePlayerStore } from '../bridge/usePlayerStore';

import bulletTexture from '@/assets/ricoBullet.png';
import freezeBulletTexture from '@/assets/freezeBullet.png';
import expTexture from '@/assets/exp.png';
import healthTexture from '@/assets/health.png';
import { exhaustFlames, flashesA, explosions, flames, lts, laserT, mgunBullet } from '@/assets/Effects';
import { mgFrames } from '@/assets/Color_A';

export default class GameScene extends Phaser.Scene {
    private player!: Tank;
    private playerController!: PlayerController;
    private mapManager!: MapManager;
    private waveSpawner!: WaveSpawner;

    private entities: Tank[] = [];
    private pickups: Pickup[] = [];
    private statSyncTimer: number = 0;

    constructor() {
        super({ key: 'GameScene' });
    }

    preload() {
        this.load.image('background', bg);

        for (let i = 1; i <= 8; i++) {
            this.load.image(`gun_0${i}`, guns[i - 1]);
            this.load.image(`hull_0${i}`, hulls[i - 1]);
        }

        for (let i = 1; i <= 4; i++) {
            this.load.image(`track_${i}A`, tracks[i - 1][0]);
            this.load.image(`track_${i}B`, tracks[i - 1][1]);
        }

        this.load.image('bullet', bulletTexture);
        this.load.image('ricoBullet', bulletTexture);
        this.load.image('freezeBullet', freezeBulletTexture);
        this.load.image('bullet_mgun', mgunBullet);

        // Preload pick-ups
        this.load.image('exp_pickup', expTexture);
        this.load.image('health_pickup', healthTexture);

        // Preload MG spinning barrels
        for (let i = 0; i < mgFrames.length; i++) {
            this.load.image(`mg_${i}`, mgFrames[i]);
        }

        // Preload flame frames
        for (let i = 0; i < flames.length; i++) {
            this.load.image(`flame_${i}`, flames[i]);
        }

        // Preload LTS (tesla charge)
        for (let i = 0; i < lts.length; i++) {
            this.load.image(`lts_${i}`, lts[i]);
        }

        // Preload LaserT (tesla lightning beam)
        for (let i = 0; i < laserT.length; i++) {
            this.load.image(`laser_t_${i}`, laserT[i]);
        }

        // Preload exhaust frames
        for (let i = 0; i < exhaustFlames.length; i++) {
            this.load.image(`exhaust_${i}`, exhaustFlames[i]);
        }

        // Preload muzzle flash frames
        for (let i = 0; i < flashesA.length; i++) {
            this.load.image(`flash_A_${i}`, flashesA[i]);
        }

        // Preload explosion frames
        for (let i = 0; i < explosions.length; i++) {
            this.load.image(`explosion_${i}`, explosions[i]);
        }
    }

    create() {
        // 1. Build Map & Static Colliders
        this.add.image(0, 0, 'background').setOrigin(0, 0);

        this.mapManager = new MapManager(this);
        this.mapManager.buildMap();

        // 2. Spawn Player at authentic spawn point with balanced starter tank (Hull 01, Gun 01)
        const playerSpawn = this.mapManager.getRandomSpawnPoint();
        this.player = new Tank(this, {
            x: playerSpawn.x,
            y: playerSpawn.y,
            hullTexture: 'hull_01',
            gunTexture: 'gun_01',
            hullType: '01',
            gunType: '01',
            trackTextures: ['track_1A', 'track_1B'],
            team: 'player',
            bulletTexture: 'bullet',
            bulletSpeed: 1500,
        });

        this.entities.push(this.player);

        this.playerController = new PlayerController(
            this.player,
            this
        );

        // Smooth camera follow
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

        // 3. Initialize Wave Spawner
        this.waveSpawner = new WaveSpawner(this, this.mapManager, this.player);
        this.events.on('bot-spawned', (botTank: Tank) => {
            this.entities.push(botTank);
            this.setupTankDestroyHandler(botTank);
        });

        this.setupTankDestroyHandler(this.player);

        // 4. Explosion Animation
        if (!this.anims.exists('explosion_anim')) {
            this.anims.create({
                key: 'explosion_anim',
                frames: explosions.map((_, i) => ({ key: `explosion_${i}` })),
                frameRate: 24, // 8 frames @ 24fps = 333ms
                repeat: 0
            });
        }

        // 5. Collision Handling
        this.matter.world.on('collisionstart', (event: Phaser.Physics.Matter.Events.CollisionStartEvent) => {
            for (const pair of event.pairs) {
                const goA = (pair.bodyA as any).gameObject;
                const goB = (pair.bodyB as any).gameObject;

                const [projectile, target] =
                    goA instanceof Projectile ? [goA, goB] :
                        goB instanceof Projectile ? [goB, goA] : [null, null];

                // Handle Tank bump into static obstacle (wall or water) -> trigger Bot reverse
                const tank = goA instanceof Tank ? goA : goB instanceof Tank ? goB : null;
                const otherBody = goA instanceof Tank ? pair.bodyB : pair.bodyA;
                if (tank && tank.team === 'enemy' && !pair.bodyA.isSensor && !pair.bodyB.isSensor) {
                    const botEntry = this.waveSpawner.spawnedBots.find(b => b.tank === tank);
                    if (botEntry) {
                        const isWall = (otherBody as any).label === 'wall' || (otherBody as any).label === 'water';
                        if (isWall) {
                            botEntry.controller.onCollisionWithObstacle();
                        }
                    }
                }

                if (!projectile) continue;

                // Handle projectile hitting a static wall or map obstacle
                if (!(target instanceof Tank)) {
                    if (projectile.bouncesRemaining <= 0) {
                        this.spawnExplosion(projectile.x, projectile.y, 0.4);
                    }
                    projectile.onWallBounce();
                    continue;
                }

                if (projectile.owner === target) continue; // Don't damage self with own bullet
                if (!target.active) continue;

                if (!projectile.team || projectile.team !== target.team) {
                    target.takeDamage(projectile.damage);

                    // Apply status effects (e.g. Freeze chilling)
                    if (projectile.statusEffect) {
                        target.applyTemperature(projectile.statusEffect.amount);
                    }

                    // Apply AoE Splash Damage (Thunder gun 07)
                    if (projectile.splashRadius && projectile.splashRadius > 0) {
                        for (const otherTank of this.entities) {
                            if (otherTank === target || !otherTank.active) continue;
                            if (otherTank.team === projectile.team) continue;
                            const dist = Phaser.Math.Distance.Between(projectile.x, projectile.y, otherTank.x, otherTank.y);
                            if (dist <= projectile.splashRadius) {
                                otherTank.takeDamage(projectile.damage);
                            }
                        }
                    }

                    const vel = projectile.body.velocity;
                    const speedLen = Math.hypot(vel.x, vel.y) || 1;
                    const nx = vel.x / speedLen;
                    const ny = vel.y / speedLen;

                    target.applyKnockback(nx * projectile.impulseForce, ny * projectile.impulseForce);
                } else {
                    // Friendly projectile interaction (Allies / Teammates)
                    // Friendly freeze cooling (index.js:2858-2861): cools down burning ally
                    if (projectile.statusEffect?.type === 'freeze') {
                        if (target.temp > 0) {
                            target.applyTemperature(Math.max(-target.temp, -250));
                        }
                    }
                }

                this.spawnExplosion(projectile.x, projectile.y, projectile.splashRadius ? 0.9 : 0.45);
                projectile.destroy();
            }
        });
    }

    public getEntities(): Tank[] {
        return this.entities;
    }

    private setupTankDestroyHandler(tank: Tank): void {
        tank.on('tank-destroyed', (t: Tank) => {
            this.spawnExplosion(t.x, t.y, 1.2);
            this.entities = this.entities.filter(e => e !== t);

            if (t === this.player) {
                this.cameras.main.stopFollow();
                usePlayerStore.getState().updatePlayerStats({
                    health: 0
                });
            }

            // Spawns Exp crystal (80%) or Health pack (20%) when an enemy tank is destroyed
            if (t.team === 'enemy') {
                this.spawnPickup(t.x, t.y);
                usePlayerStore.getState().incrementKills();
            }
        });
    }

    private spawnExplosion(x: number, y: number, scale: number = 0.5): void {
        const exp = this.add.sprite(x, y, 'explosion_0');
        exp.setScale(scale);
        exp.play('explosion_anim');
        exp.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
            exp.destroy();
        });
    }

    private spawnPickup(x: number, y: number): void {
        // 80% exp crystal, 20% health repair pack (index.js:2244-2248)
        const type = Math.random() > 0.8 ? 'health' : 'exp';
        const pickup = new Pickup(this, {
            x,
            y,
            type,
            targetTank: this.player,
            collectRange: this.player.collectRange
        });
        this.pickups.push(pickup);
    }

    update(time: number, delta: number) {
        if (this.player.active && this.player.body) {
            this.playerController.update(delta);
        }

        this.entities = this.entities.filter(e => e.active);
        this.pickups = this.pickups.filter(p => p.active);

        // Update all tanks that are currently active
        for (const entity of this.entities) {
            if (entity.active && entity.body) {
                entity.update(time, delta);
            }
        }

        // Update wave spawner & bot controllers
        this.waveSpawner.update(delta, this.entities);

        // Throttled sync to Zustand player store for React HUD (~20 updates/sec)
        this.statSyncTimer += delta;
        if (this.statSyncTimer >= 50 && this.player.active) {
            this.statSyncTimer = 0;
            usePlayerStore.getState().updatePlayerStats({
                health: Math.round(this.player.getHealth()),
                maxHealth: this.player.getMaxHealth(),
                exp: this.player.getExp(),
                level: this.player.getLevel(),
                expNeeded: this.player.getExpNeeded(),
                temp: Math.round(this.player.temp),
                gunType: this.player.gunType,
                resourceProgress: this.player.getResourceProgress(),
                resourceType: this.player.getResourceType(),
                survivalTimeSec: Math.floor(time / 1000)
            });
        }
    }
}