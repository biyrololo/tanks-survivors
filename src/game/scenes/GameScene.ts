import Phaser from 'phaser';

import bg from '@/assets/map2.png';
import Tank from '../entities/Tank';
import hull from '@/assets/Color_A/Hull_01.png'
import gun from '@/assets/Color_A/Gun_01.png'
import PlayerController from '../entities/PlayerController';
import { guns, hulls } from '@/assets/Color_A';
import { tracks } from '@/assets/Tracks';
import Projectile from '../entities/Projectile';

import bulletTexture from '@/assets/ricoBullet.png';

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
        this.load.image(`bullet`, bulletTexture)
    }

    create() {
        this.add.image(0, 0, 'background').setScale(2);

        this.player = new Tank(this, {
            x: 700,
            y: 700,
            hullTexture: 'hull_03',
            gunTexture: 'gun_04',

            hullType: '01',
            gunType: '01',
            trackTextures: ['track_1A', 'track_1B'],
            team: 'player',
            bulletTexture: 'bullet',
            bulletSpeed: 2000,
        });

        this.entities.push(new Tank(this, {
            x: 700,
            y: 700,
            hullTexture: 'hull_01',
            gunTexture: 'gun_02',

            hullType: '01',
            gunType: '01',
            trackTextures: ['track_2A', 'track_2B'],
            bulletTexture: 'bullet'
        }));

        this.playerController = new PlayerController(
            this.player,
            this
        );

        this.cameras.main.startFollow(this.player)

        this.entities.push(this.player)

        this.matter.world.on('collisionstart', (event: Phaser.Physics.Matter.Events.CollisionStartEvent) => {
            for (const pair of event.pairs) {
                const goA = (pair.bodyA as any).gameObject;
                const goB = (pair.bodyB as any).gameObject;

                const [projectile, target] =
                    goA instanceof Projectile ? [goA, goB] :
                        goB instanceof Projectile ? [goB, goA] : [null, null];

                if (!projectile || !(target instanceof Tank)) continue;
                if (projectile.owner === target) continue; // не бьём себя своим же снарядом

                if (!projectile.team || projectile.team !== target.team) {
                    target.takeDamage(projectile.damage);

                    const vel = projectile.body.velocity;
                    const speedLen = Math.hypot(vel.x, vel.y) || 1;
                    const nx = vel.x / speedLen;
                    const ny = vel.y / speedLen;

                    target.applyKnockback(nx * projectile.impulseForce, ny * projectile.impulseForce);
                }

                projectile.destroy();
            }
        });

    }

    update(time: number, delta: number) {
        this.playerController.update(delta)

        this.entities.forEach(e => e.update(time, delta))
    }
}