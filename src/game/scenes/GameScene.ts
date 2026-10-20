import Phaser from 'phaser';

import bg from '@/assets/map2.png';
import Tank from '../entities/Tank';
import PlayerController from '../entities/PlayerController';
import { guns, hulls } from '@/assets/Color_A';
import { tracks } from '@/assets/Tracks';
import Projectile from '../entities/Projectile';

import bulletTexture from '@/assets/ricoBullet.png';
import freezeBulletTexture from '@/assets/freezeBullet.png';
import { exhaustFlames, flashesA, explosions, flames, lts, laserT, mgunBullet } from '@/assets/Effects';
import { mgFrames } from '@/assets/Color_A';

export default class GameScene extends Phaser.Scene {
    private player!: Tank;
    private playerController!: PlayerController;

    private entities: Tank[] = [];


    constructor() {
        super({ key: 'GameScene' });
    }

    preload() {
        this.load.image('background', bg);

        for (let i = 1; i <= 8; i++) {
            this.load.image(`gun_0${i}`, guns[i - 1])
            this.load.image(`hull_0${i}`, hulls[i - 1])
        }

        for (let i = 1; i <= 4; i++) {
            this.load.image(`track_${i}A`, tracks[i - 1][0])
            this.load.image(`track_${i}B`, tracks[i - 1][1])
        }
        this.load.image(`bullet`, bulletTexture);
        this.load.image(`ricoBullet`, bulletTexture);
        this.load.image(`freezeBullet`, freezeBulletTexture);
        this.load.image(`bullet_mgun`, mgunBullet);

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
        this.add.image(0, 0, 'background').setScale(2);

        this.player = new Tank(this, {
            x: 700,
            y: 700,
            hullTexture: 'hull_04',
            gunTexture: 'gun_08',

            hullType: '04',
            gunType: '01',
            trackTextures: ['track_1A', 'track_1B'],
            team: 'player',
            bulletTexture: 'bullet',
            bulletSpeed: 2000,
        });

        this.entities.push(new Tank(this, {
            x: 1100,
            y: 700,
            hullTexture: 'hull_01',
            gunTexture: 'gun_02',

            hullType: '01',
            gunType: '01',
            trackTextures: ['track_2A', 'track_2B'],
            bulletTexture: 'bullet',
            team: 'enemy'
        }));


        this.playerController = new PlayerController(
            this.player,
            this
        );

        this.cameras.main.startFollow(this.player)

        this.entities.push(this.player)

        if (!this.anims.exists('explosion_anim')) {
            this.anims.create({
                key: 'explosion_anim',
                frames: explosions.map((_, i) => ({ key: `explosion_${i}` })),
                frameRate: 24, // 8 frames @ 24fps = 333ms
                repeat: 0
            });
        }

        const spawnExplosion = (x: number, y: number, scale: number = 0.5) => {
            const exp = this.add.sprite(x, y, 'explosion_0');
            exp.setScale(scale);
            exp.play('explosion_anim');
            exp.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
                exp.destroy();
            });
        };

        this.matter.world.on('collisionstart', (event: Phaser.Physics.Matter.Events.CollisionStartEvent) => {
            for (const pair of event.pairs) {
                const goA = (pair.bodyA as any).gameObject;
                const goB = (pair.bodyB as any).gameObject;

                const [projectile, target] =
                    goA instanceof Projectile ? [goA, goB] :
                        goB instanceof Projectile ? [goB, goA] : [null, null];

                if (!projectile) continue;

                // Handle obstacle / wall hit
                if (!(target instanceof Tank)) {
                    projectile.onWallBounce();
                    continue;
                }

                if (projectile.owner === target) continue; // не бьём себя своим же снарядом
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
                    // Friendly projectile interaction (Teammates / Allies)
                    // Friendly freeze cooling (index.js:2858-2861):
                    // Freeze bullets extinguish / cool down an overheated or burning ally without friendly fire damage!
                    if (projectile.statusEffect?.type === 'freeze') {
                        if (target.temp > 0) {
                            target.applyTemperature(Math.max(-target.temp, -250));
                        }
                    }
                }

                spawnExplosion(projectile.x, projectile.y, projectile.splashRadius ? 0.9 : 0.45);
                projectile.destroy();
            }
        });


        this.entities.forEach(tank => {
            tank.on('tank-destroyed', (t: Tank) => {
                spawnExplosion(t.x, t.y, 1.2);
                this.entities = this.entities.filter(e => e !== t);
            });
        })
    }

    update(time: number, delta: number) {
        this.playerController.update(delta);

        this.entities = this.entities.filter(e => e.active);

        this.entities.forEach(e => e.update(time, delta))
    }
}