import Phaser from 'phaser';
import { tanksParams } from '../config/tankParams';
import Projectile from './Projectile';

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
    private gun: Phaser.GameObjects.Sprite;

    private trackLeft: Phaser.GameObjects.Sprite;
    private trackRight: Phaser.GameObjects.Sprite;
    private trackTextures: [string, string];
    private trackFrame = 0;
    private trackAnimTimer = 0;
    private trackAnimInterval = 120;
    private trackAnimSpeedThreshold = 0.05;

    private gunAngle = 0;
    private gunLocalMuzzleY: number; // локальный y дула относительно origin gun-спрайта

    public team: string;
    public bulletTexture: string;
    public bulletSpeed: number;
    public damage: number;
    public reloadTime: number;
    private reloadTimer = 0;

    public moveSpeed = 600;
    public rotationSpeed = 2;
    public gunRotationSpeed = 4;

    private recoilForce = 0.015;

    private gunMountOffsetX: number;
    private gunMountOffsetY: number;

    constructor(scene: Phaser.Scene, props: ITankProps) {
        super(scene, props.x, props.y);

        scene.add.existing(this);

        this.team = props.team ?? 'default';
        this.bulletTexture = props.bulletTexture;
        this.bulletSpeed = props.bulletSpeed ?? 900;
        this.damage = props.damage ?? 10;
        this.reloadTime = props.reloadTime ?? 800;

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

        this.gun = new Phaser.GameObjects.Sprite(scene, 0, 0, props.gunTexture);
        this.gun.setOrigin(
            gunParams.center.x / this.gun.width,
            gunParams.center.y / this.gun.height
        );

        this.gunMountOffsetX = hullParams.center.x - bodyCenterX;
        this.gunMountOffsetY = hullParams.center.y - bodyCenterY;
        this.gun.setPosition(this.gunMountOffsetX, this.gunMountOffsetY);

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
        const dt = delta / 1000;
        this.gunAngle += direction * this.gunRotationSpeed * dt;
        this.gun.setRotation(this.gunAngle);
    }

    public getGunWorldAngle(): number {
        return this.rotation + this.gunAngle;
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
        const totalAngle = this.rotation + this.gunAngle;

        return Tank.rotateAndOffset(
            0, this.gunLocalMuzzleY,
            totalAngle,
            mount.x, mount.y
        );
    }

    public canFire(): boolean {
        return this.reloadTimer <= 0;
    }

    public fire(): Projectile | null {
        if (!this.canFire()) return null;

        this.reloadTimer = this.reloadTime;

        const muzzle = this.getMuzzleWorldPoint();
        const worldAngle = this.getGunWorldAngle();

        const projectile = new Projectile(this.scene, {
            x: muzzle.x,
            y: muzzle.y,
            angle: worldAngle,
            speed: this.bulletSpeed,
            damage: this.damage,
            owner: this,
            team: this.team,
            texture: this.bulletTexture,
            impulseForce: 2,
            size: 16,
        });

        // откат — импульс на сам танк в обратную сторону выстрела
        const dirAngle = worldAngle - Math.PI / 2;
        this.scene.matter.body.applyForce(this.body, this.body.position, {
            x: -Math.cos(dirAngle) * this.recoilForce,
            y: -Math.sin(dirAngle) * this.recoilForce,
        });

        return projectile;
    }

    public takeDamage(amount: number) {
        // заглушка под будущую систему здоровья
        console.log(`${this.team} tank took ${amount} damage`);
    }

    public applyImpulse(forceX: number, forceY: number, atPoint?: MatterJS.Vector) {
        this.scene.matter.body.applyForce(this.body, atPoint ?? this.body.position, { x: forceX, y: forceY });
    }

    public applyKnockback(vx: number, vy: number) {
        const currentVel = this.body.velocity;
        this.scene.matter.body.setVelocity(this.body, {
            x: currentVel.x + vx,
            y: currentVel.y + vy,
        });
    }

    public update(_time: number, delta: number) {
        if (this.reloadTimer > 0) {
            this.reloadTimer -= delta;
        }

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
}