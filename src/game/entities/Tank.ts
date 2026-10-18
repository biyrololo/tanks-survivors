import Phaser from 'phaser';
import { tanksParams } from '../config/tankParams';
import type { IGun } from './Guns/Gun';
import SimpleGun from './Guns/SimpleGun';

export interface ITankProps {
    x: number;
    y: number;

    hullTexture: string;
    gunTexture: string;
    trackTextures: [string, string];
    bulletTexture: string;

    hullType: string;
    gunType: string;

    team?: string;
    bulletSpeed?: number;
    damage?: number;
    reloadTime?: number; // мс
}

export default class Tank extends Phaser.GameObjects.Container {
    declare body: MatterJS.BodyType;

    private hull: Phaser.GameObjects.Sprite;
    private gun: IGun;

    private trackLeft: Phaser.GameObjects.Sprite;
    private trackRight: Phaser.GameObjects.Sprite;
    private trackTextures: [string, string];
    private trackFrame = 0;
    private trackAnimTimer = 0;
    private trackAnimInterval = 120;
    private trackAnimSpeedThreshold = 0.05;

    private gunLocalMuzzleY: number; // локальный y дула относительно origin gun-спрайта

    public team: string;
    public bulletTexture: string;
    public bulletSpeed: number;
    public damage: number;

    public moveSpeed = 600;
    public rotationSpeed = 2;

    private gunMountOffsetX: number;
    private gunMountOffsetY: number;

    private hpBarColor: number;
    private hpBarBgColor: number;
    private recoilBarColor: number = 0x00ff00;
    private recoilBarBgColor: number = 0x008800;

    private hpBarBg!: Phaser.GameObjects.Graphics;
    private hpBar!: Phaser.GameObjects.Graphics;
    private recoilBar!: Phaser.GameObjects.Graphics;
    private recoilBarBg!: Phaser.GameObjects.Graphics;

    private health: number;
    private maxHealth: number;

    public getHealth(): number {
        return this.health;
    }

    constructor(scene: Phaser.Scene, props: ITankProps) {
        super(scene, props.x, props.y);

        scene.add.existing(this);

        this.team = props.team ?? 'default';
        this.bulletTexture = props.bulletTexture;
        this.bulletSpeed = props.bulletSpeed ?? 900;
        this.damage = props.damage ?? 10;

        this.maxHealth = 100;
        this.health = this.maxHealth;

        this.trackTextures = props.trackTextures;

        const { hull: hullParams } = tanksParams[props.hullType];
        const border = hullParams.border;

        this.hull = new Phaser.GameObjects.Sprite(scene, 0, 0, props.hullTexture);

        const bWidth = this.hull.width - border.x * 2;
        const bHeight = this.hull.height - border.y - border.dy;

        const bodyCenterX = border.x + bWidth / 2;
        const bodyCenterY = border.y + bHeight / 2;

        this.hull.setOrigin(
            bodyCenterX / this.hull.width,
            bodyCenterY / this.hull.height
        );

        const { gun: gunParams } = tanksParams[props.gunType];

        this.gunMountOffsetX = hullParams.center.x - bodyCenterX;
        this.gunMountOffsetY = hullParams.center.y - bodyCenterY;

        this.gun = new SimpleGun(scene, {
            gunPosition: {
                x: this.gunMountOffsetX,
                y: this.gunMountOffsetY
            }
        })


        // локальная (до поворота) координата дула относительно origin gun-спрайта
        this.gunLocalMuzzleY = gunParams.border.y - gunParams.center.y;

        // --- гусеницы (как раньше) ---
        const track = hullParams.track;
        const trackCenterOffsetX = track.x + track.w / 2 - bodyCenterX;
        const trackCenterOffsetY = track.y + track.h / 2 - bodyCenterY;

        this.trackRight = new Phaser.GameObjects.Sprite(scene, trackCenterOffsetX, trackCenterOffsetY, this.trackTextures[0]);
        this.trackRight.setDisplaySize(track.w, track.h);

        this.trackLeft = new Phaser.GameObjects.Sprite(scene, -trackCenterOffsetX, trackCenterOffsetY, this.trackTextures[1]);
        this.trackLeft.setDisplaySize(track.w, track.h);

        this.add([this.trackLeft, this.trackRight, this.hull, this.gun]);

        this.hpBarColor = this.team === 'player' ? 0x0000ff : 0xff0000;
        this.hpBarBgColor = this.team === 'player' ? 0x000088 : 0x880000;

        this.createHPBar();
        this.createRecoilBar();

        scene.matter.add.gameObject(this, {
            shape: { type: 'rectangle', width: bWidth, height: bHeight },
            friction: 0.05,
            frictionAir: 0.15,
            mass: 1000
        });

        // scene.matter.body.setInertia(this.body, Infinity);
        (this.body as any).gameObject = this;
    }

    public move(direction: number) {
        const angle = this.rotation - Math.PI / 2;
        const speed = (this.moveSpeed * direction) / 60;

        this.scene.matter.body.setVelocity(this.body, {
            x: Math.cos(angle) * speed,
            y: Math.sin(angle) * speed,
        });
    }

    public rotateHull(direction: number) {
        const angularSpeed = (direction * this.rotationSpeed) / 60;
        this.scene.matter.body.setAngularVelocity(this.body, angularSpeed);
    }

    public rotateGun(direction: number, delta: number) {
        this.gun.rotateGun(direction, delta);
    }

    public getGunWorldAngle(): number {
        return this.rotation + this.gun.getRotation();
    }

    /** Поворачивает локальную точку (lx, ly) на угол angle и сдвигает на (originX, originY) */
    private static rotateAndOffset(
        lx: number, ly: number,
        angle: number,
        originX: number, originY: number
    ): Phaser.Math.Vector2 {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        return new Phaser.Math.Vector2(
            originX + (lx * cos - ly * sin),
            originY + (lx * sin + ly * cos)
        );
    }

    private getMuzzleWorldPoint(): Phaser.Math.Vector2 {
        // 1) точка крепления пушки в мировых координатах (mountOffset повёрнут на угол корпуса)
        const mount = Tank.rotateAndOffset(
            this.gunMountOffsetX, this.gunMountOffsetY,
            this.rotation,
            this.x, this.y
        );

        // 2) точка дула относительно точки крепления, повёрнутая на суммарный угол (корпус + пушка)
        const totalAngle = this.rotation + this.gun.getRotation();

        return Tank.rotateAndOffset(
            0, this.gunLocalMuzzleY,
            totalAngle,
            mount.x, mount.y
        );
    }

    public fire(): void {
        if (!this.gun.canFire()) return;

        const muzzle = this.getMuzzleWorldPoint();
        const worldAngle = this.getGunWorldAngle();

        // const projectile = new Projectile(this.scene, {
        //     x: muzzle.x,
        //     y: muzzle.y,
        //     angle: worldAngle,
        //     speed: this.bulletSpeed,
        //     damage: this.damage,
        //     owner: this,
        //     team: this.team,
        //     texture: this.bulletTexture,
        //     impulseForce: 2,
        //     size: 16,
        // });

        this.gun.fire(
            muzzle.x, muzzle.y,
            worldAngle, this.team,
            this
        );

        // // откат — импульс на сам танк в обратную сторону выстрела
        // const dirAngle = worldAngle - Math.PI / 2;
        // this.scene.matter.body.applyForce(this.body, this.body.position, {
        //     x: -Math.cos(dirAngle) * this.recoilForce,
        //     y: -Math.sin(dirAngle) * this.recoilForce,
        // });

        // return projectile;
    }

    public takeDamage(amount: number) {
        // заглушка под будущую систему здоровья
        console.log(`${this.team} tank took ${amount} damage`);
        this.health -= amount;
        if (this.health <= 0) {
            this.health = 0;
            this.emit('tank-destroyed', this);
            this.destroy(true);
        }
        this.updateHPBar();
    }

    public applyImpulse(forceX: number, forceY: number, atPoint?: MatterJS.Vector) {
        if (!this.body) return;
        this.scene.matter.body.applyForce(this.body, atPoint ?? this.body.position, { x: forceX, y: forceY });
    }

    public applyKnockback(vx: number, vy: number) {
        if (!this.body) return;
        const currentVel = this.body.velocity;
        this.scene.matter.body.setVelocity(this.body, {
            x: currentVel.x + vx,
            y: currentVel.y + vy,
        });
    }

    public update(_time: number, delta: number) {
        this.gun.update(_time, delta);
        this.updateRecoilBar();

        const speed = this.body.speed + Math.abs(this.body.angularVelocity) * 20;

        if (speed > this.trackAnimSpeedThreshold) {
            this.trackAnimTimer += delta;

            if (this.trackAnimTimer >= this.trackAnimInterval) {
                this.trackAnimTimer = 0;
                this.trackFrame = 1 - this.trackFrame;

                this.trackRight.setTexture(this.trackTextures[this.trackFrame]);
                this.trackLeft.setTexture(this.trackTextures[1 - this.trackFrame]);
            }
        }

    }

    private createHPBar(): void {
        const barWidth: number = 90;
        const barHeight: number = 10;
        const offsetY: number = 50;
        // Фон полоски HP
        if (!this.hpBarBg) {
            this.hpBarBg = this.scene.add.graphics();
        }
        this.hpBarBg.fillStyle(this.hpBarBgColor, 1);
        this.hpBarBg.fillRect(-barWidth / 2, offsetY, barWidth, barHeight);

        // Активная полоска HP
        if (!this.hpBar) {
            this.hpBar = this.scene.add.graphics();
        }
        this.hpBar.fillStyle(this.hpBarColor, 1);
        this.hpBar.fillRect(-barWidth / 2, offsetY, barWidth, barHeight);

        this.add(this.hpBarBg);
        this.add(this.hpBar);
    }

    private createRecoilBar(): void {
        const barWidth: number = 90;
        const barHeight: number = 10;
        const offsetY: number = 65;
        // Фон полоски HP
        if (!this.recoilBarBg) {
            this.recoilBarBg = this.scene.add.graphics();
        }
        this.recoilBarBg.fillStyle(this.recoilBarBgColor, 1);
        this.recoilBarBg.fillRect(-barWidth / 2, offsetY, barWidth, barHeight);

        // Активная полоска RECOIL
        if (!this.recoilBar) {
            this.recoilBar = this.scene.add.graphics();
        }
        this.recoilBar.fillStyle(this.recoilBarColor, 1);
        this.recoilBar.fillRect(-barWidth / 2, offsetY, barWidth, barHeight);

        this.add(this.recoilBarBg);
        this.add(this.recoilBar);
    }

    private updateRecoilBar(): void {
        const barWidth: number = 90;
        const barHeight: number = 10;
        const offsetY: number = 65;
        this.recoilBar.clear();
        this.recoilBar.fillStyle(this.recoilBarColor, 1);
        this.recoilBar.fillRect(-barWidth / 2, offsetY, barWidth * (1 - this.gun.getReloadProgress()), barHeight);
    }

    private updateHPBar(): void {
        const barWidth: number = 90;
        const barHeight: number = 10;
        const offsetY: number = 50;
        this.hpBar.clear();
        this.hpBar.fillStyle(this.hpBarColor, 1);
        this.hpBar.fillRect(-barWidth / 2, offsetY, barWidth * this.health / this.maxHealth, barHeight);
    }
}