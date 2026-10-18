import Phaser from 'phaser';
import { tanksParams } from '../config/tankParams';
import { CHARACTERISTICS_HULLS, MAX_SPEED } from '../config/characteristics';
import type { IGun } from './Guns/Gun';
import { GunFactory } from './Guns/GunFactory';

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
    reloadTime?: number; // ms
    maxHealth?: number;
}

export default class Tank extends Phaser.GameObjects.Container {
    declare body: MatterJS.BodyType;

    public readonly hullType: string;
    public readonly gunType: string;

    private hull: Phaser.GameObjects.Sprite;
    private gun: IGun;

    private trackLeft: Phaser.GameObjects.Sprite;
    private trackRight: Phaser.GameObjects.Sprite;
    private trackTextures: [string, string];
    private trackFrame = 0;
    private trackAnimTimer = 0;
    private trackAnimInterval = 100; // ~6 frames @ 60fps (original: freq = 4..6 frames)
    private trackAnimSpeedThreshold = 0.05;

    public team: string;
    public bulletTexture: string;
    public bulletSpeed: number;
    public damage: number;

    // Movement & Rotation speeds matching characteristics.js
    public baseMoveSpeed: number;
    public baseRotationSpeed: number;

    private gunMountOffsetX: number;
    private gunMountOffsetY: number;

    // Health & HP bar
    private health: number;
    private maxHealth: number;
    private hpBarColor: number;
    private hpBarBgColor: number;
    private hpBarBg!: Phaser.GameObjects.Graphics;
    private hpBar!: Phaser.GameObjects.Graphics;

    // Gun Resource Bar (Cooldown / Energy / Heat)
    private resourceBar!: Phaser.GameObjects.Graphics;
    private resourceBarBg!: Phaser.GameObjects.Graphics;

    // Temperature System matching index.js:915-921, 2854-2860
    // Range: [-800 (Frozen Solid) .. +800 (Maximum Burn)]
    public temp: number = 0;

    public getHealth(): number {
        return this.health;
    }

    public getMaxHealth(): number {
        return this.maxHealth;
    }

    public getFreezeFactor(): number {
        if (this.temp < 0) {
            return Math.max(0, (800 + this.temp) / 800);
        }
        return 1;
    }

    constructor(scene: Phaser.Scene, props: ITankProps) {
        super(scene, props.x, props.y);

        this.hullType = props.hullType;
        this.gunType = props.gunType;
        this.team = props.team ?? 'default';
        this.bulletTexture = props.bulletTexture;
        this.bulletSpeed = props.bulletSpeed ?? 900;
        this.damage = props.damage ?? 10;
        this.trackTextures = props.trackTextures;

        // Health configuration from characteristics.js
        const hullChar = CHARACTERISTICS_HULLS[this.hullType] ?? CHARACTERISTICS_HULLS['01'];
        const baseHp = hullChar.maxHealth;
        // In original game: player has max_health * 2
        this.maxHealth = props.maxHealth ?? (this.team === 'player' ? baseHp * 2 : baseHp);
        this.health = this.maxHealth;

        // Speed from characteristics.js (hull speed 2..8)
        // Scaled to pixel movement: hullChar.speed * 80 px/sec
        this.baseMoveSpeed = hullChar.speed * 80;

        // Angular rotation formula from index.js:3437
        // p.angle.hull += 5 * (speed / MAX_SPEED) deg/frame @ 60fps
        const degPerSec = 5 * (hullChar.speed / MAX_SPEED) * 60;
        this.baseRotationSpeed = Phaser.Math.DegToRad(degPerSec);

        const { hull: hullParams } = tanksParams[this.hullType] ?? tanksParams['01'];
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

        this.gunMountOffsetX = hullParams.center.x - bodyCenterX;
        this.gunMountOffsetY = hullParams.center.y - bodyCenterY;

        // Create gun via GunFactory with owner reference
        this.gun = GunFactory.create(scene, {
            gunType: this.gunType,
            gunPosition: {
                x: this.gunMountOffsetX,
                y: this.gunMountOffsetY
            },
            ownerTank: this,
            bulletSpeed: this.bulletSpeed,
            damage: this.damage,
            bulletTexture: this.bulletTexture,
            reloadTimeMs: props.reloadTime
        });


        // Tracks offset from tankParams
        const track = hullParams.track;
        const trackCenterOffsetX = track.x + track.w / 2 - bodyCenterX;
        const trackCenterOffsetY = track.y + track.h / 2 - bodyCenterY;

        this.trackRight = new Phaser.GameObjects.Sprite(scene, trackCenterOffsetX, trackCenterOffsetY, this.trackTextures[0]);
        this.trackRight.setDisplaySize(track.w, track.h);

        this.trackLeft = new Phaser.GameObjects.Sprite(scene, -trackCenterOffsetX, trackCenterOffsetY, this.trackTextures[1]);
        this.trackLeft.setDisplaySize(track.w, track.h);

        this.add([this.trackLeft, this.trackRight, this.hull, this.gun]);

        this.hpBarColor = this.team === 'player' ? 0x00cc44 : 0xee2222;
        this.hpBarBgColor = 0x222222;

        this.createHPBar();
        this.createResourceBar();

        scene.add.existing(this);

        scene.matter.add.gameObject(this, {
            shape: { type: 'rectangle', width: bWidth, height: bHeight },
            friction: 0.05,
            frictionAir: 0.15,
            mass: 1000
        });

        (this.body as any).gameObject = this;
    }

    public move(direction: number) {
        if (!this.body) return;
        const freeze = this.getFreezeFactor();
        if (freeze <= 0) return; // Completely frozen in ice

        const angle = this.rotation - Math.PI / 2;
        const currentSpeed = (this.baseMoveSpeed * freeze * direction) / 60;

        this.scene.matter.body.setVelocity(this.body, {
            x: Math.cos(angle) * currentSpeed,
            y: Math.sin(angle) * currentSpeed,
        });
    }

    public rotateHull(direction: number) {
        if (!this.body) return;
        const freeze = this.getFreezeFactor();
        if (freeze <= 0) return;

        const angularSpeed = (direction * this.baseRotationSpeed * freeze) / 60;
        this.scene.matter.body.setAngularVelocity(this.body, angularSpeed);
    }

    public rotateGun(direction: number, delta: number) {
        const freeze = this.getFreezeFactor();
        this.gun.rotateGun(direction * freeze, delta);
    }

    public setGunRotation(angle: number) {
        this.gun.setGunRotation(angle);
    }

    public getGunWorldAngle(): number {
        return this.rotation + this.gun.getRotation();
    }

    public setTrigger(isDown: boolean) {
        this.gun.setTrigger(isDown);
    }

    public fire() {
        this.gun.setTrigger(true);
    }

    public equipGun(newGunType: string): void {
        const currentAngle = this.gun.getRotation();
        this.remove(this.gun as unknown as Phaser.GameObjects.GameObject, true);

        this.gun = GunFactory.create(this.scene, {
            gunType: newGunType,
            gunPosition: {
                x: this.gunMountOffsetX,
                y: this.gunMountOffsetY
            },
            ownerTank: this,
            bulletSpeed: this.bulletSpeed,
            damage: this.damage,
            bulletTexture: this.bulletTexture
        });

        this.gun.setGunRotation(currentAngle);
        this.add(this.gun as unknown as Phaser.GameObjects.GameObject);
    }


    /**
     * Applies temperature delta (positive = heat/burn, negative = chill/freeze)
     * Matches original game mechanics (index.js:2854-2860, 3769)
     */
    public applyTemperature(deltaTemp: number): void {
        const prevTemp = this.temp;
        this.temp = Phaser.Math.Clamp(this.temp + deltaTemp, -800, 800);

        // Shatter Bonus Damage: when target freezes down to maximum (-800)
        // index.js:2858: if (target.temp <= -800) { target.health.cur -= target.health.max * 0.13; }
        if (this.temp <= -800 && prevTemp > -800) {
            const shatterDamage = this.maxHealth * 0.13;
            this.takeDamage(shatterDamage);
        }
    }

    public takeDamage(amount: number) {
        this.health -= amount;
        if (this.health <= 0) {
            this.health = 0;
            this.emit('tank-destroyed', this);
            this.destroy(true);
            return;
        }
        this.updateHPBar();
    }

    public heal(amount: number) {
        this.health = Math.min(this.maxHealth, this.health + amount);
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
        this.updateResourceBar();

        const dtFrames = delta / (1000 / 60);

        // Temperature dynamics (index.js:915-921)
        if (this.temp > 0) {
            // Burn DoT: 0.2 damage per frame @ 60 FPS (12 DPS)
            this.takeDamage(0.2 * dtFrames);
            // Cool down by 1.0 unit per frame
            this.temp = Math.max(0, this.temp - 1.0 * dtFrames);
        } else if (this.temp < 0) {
            // Passive thawing: +0.5 units per frame (30 units/sec)
            this.temp = Math.min(0, this.temp + 0.5 * dtFrames);
        }

        // Visual temperature tinting
        this.updateTemperatureVisuals();

        // Animated tracks
        if (this.body) {
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

    private updateTemperatureVisuals(): void {
        if (this.temp < 0) {
            // Frozen / Cold tint (Cyan / Ice blue)
            const intensity = Math.abs(this.temp) / 800;
            const r = Math.round(255 * (1 - intensity * 0.6));
            const g = Math.round(255 * (1 - intensity * 0.2));
            const b = 255;
            const tint = (r << 16) | (g << 8) | b;
            this.hull.setTint(tint);
            this.trackLeft.setTint(tint);
            this.trackRight.setTint(tint);
        } else if (this.temp > 0) {
            // Burning / Heat tint (Fiery Orange / Red)
            const intensity = this.temp / 800;
            const r = 255;
            const g = Math.round(255 * (1 - intensity * 0.5));
            const b = Math.round(255 * (1 - intensity * 0.7));
            const tint = (r << 16) | (g << 8) | b;
            this.hull.setTint(tint);
            this.trackLeft.setTint(tint);
            this.trackRight.setTint(tint);
        } else {
            this.hull.clearTint();
            this.trackLeft.clearTint();
            this.trackRight.clearTint();
        }
    }

    private createHPBar(): void {
        const barWidth = 90;
        const barHeight = 10;
        const offsetY = 50;

        this.hpBarBg = this.scene.add.graphics();
        this.hpBarBg.fillStyle(this.hpBarBgColor, 1);
        this.hpBarBg.fillRect(-barWidth / 2, offsetY, barWidth, barHeight);

        this.hpBar = this.scene.add.graphics();
        this.hpBar.fillStyle(this.hpBarColor, 1);
        this.hpBar.fillRect(-barWidth / 2, offsetY, barWidth, barHeight);

        this.add([this.hpBarBg, this.hpBar]);
    }

    private createResourceBar(): void {
        const barWidth = 90;
        const barHeight = 8;
        const offsetY = 64;

        this.resourceBarBg = this.scene.add.graphics();
        this.resourceBarBg.fillStyle(0x222222, 1);
        this.resourceBarBg.fillRect(-barWidth / 2, offsetY, barWidth, barHeight);

        this.resourceBar = this.scene.add.graphics();
        this.add([this.resourceBarBg, this.resourceBar]);
    }

    private updateResourceBar(): void {
        const barWidth = 90;
        const barHeight = 8;
        const offsetY = 64;

        this.resourceBar.clear();

        const type = this.gun.getResourceType();
        let color = 0x00ff00; // Cooldown ready / loading
        if (type === 'energy') {
            color = 0x00ddff; // Cyan energy
        } else if (type === 'heat') {
            color = 0xff6600; // Orange heat
        }

        const progress = this.gun.getResourceProgress(); // 0 to 1
        const filledWidth = type === 'cooldown'
            ? barWidth * (1 - progress) // Cooldown fills up as timer goes to 0
            : barWidth * (1 - progress); // Energy or heat remaining

        this.resourceBar.fillStyle(color, 1);
        this.resourceBar.fillRect(-barWidth / 2, offsetY, Math.max(0, filledWidth), barHeight);
    }

    private updateHPBar(): void {
        const barWidth = 90;
        const barHeight = 10;
        const offsetY = 50;
        this.hpBar.clear();
        this.hpBar.fillStyle(this.hpBarColor, 1);
        const ratio = Phaser.Math.Clamp(this.health / this.maxHealth, 0, 1);
        this.hpBar.fillRect(-barWidth / 2, offsetY, barWidth * ratio, barHeight);
    }
}