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
    public gunType: string;

    private hull: Phaser.GameObjects.Sprite;
    private gun: IGun;

    private trackLeft: Phaser.GameObjects.Sprite;
    private trackRight: Phaser.GameObjects.Sprite;
    private trackTextures: [string, string];
    private trackFrame = 0;
    private trackAnimTimer = 0;
    private trackAnimInterval = 100; // ~6 frames @ 60fps (original: freq = 4..6 frames)
    private trackAnimSpeedThreshold = 0.05;

    // Exhaust fire effects (index.js:1008-1018)
    private exhaustLeft: Phaser.GameObjects.Sprite;
    private exhaustRight: Phaser.GameObjects.Sprite;
    private exhaustFrame = 0;
    private exhaustTimer = 0;
    private exhaustInterval = 100; // 6 frames @ 60fps

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

        // Exhaust flames from hullParams.fire (index.js:1008-1018)
        const exhaustY = hullParams.fire - bodyCenterY;
        const exhaustSeparationX = 19.2; // -center.x*0.85 and -center.x*1.15 in index.js:1017-1018

        this.exhaustLeft = new Phaser.GameObjects.Sprite(scene, -exhaustSeparationX, exhaustY, 'exhaust_0');
        this.exhaustLeft.setOrigin(0.5, 0.535);
        this.exhaustLeft.setVisible(false);

        this.exhaustRight = new Phaser.GameObjects.Sprite(scene, exhaustSeparationX, exhaustY, 'exhaust_0');
        this.exhaustRight.setOrigin(0.5, 0.535);
        this.exhaustRight.setVisible(false);

        this.add([this.exhaustLeft, this.exhaustRight, this.trackLeft, this.trackRight, this.hull, this.gun]);

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
        const turnMultiplier = this.gun.getTurnSpeedMultiplier ? this.gun.getTurnSpeedMultiplier() : 1.0;
        this.gun.rotateGun(direction * freeze * turnMultiplier, delta);
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
        this.gunType = newGunType;
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
            damage: this.damage
        });

        this.gun.setGunRotation(currentAngle);
        this.add(this.gun as unknown as Phaser.GameObjects.GameObject);

        // Keep HP & resource HUD bars above gun
        if (this.hpBarBg) this.bringToTop(this.hpBarBg);
        if (this.hpBar) this.bringToTop(this.hpBar);
        if (this.resourceBarBg) this.bringToTop(this.resourceBarBg);
        if (this.resourceBar) this.bringToTop(this.resourceBar);

        this.updateTemperatureVisuals();
    }

    /**
     * Calculates the exact world coordinates of a point on the gun barrel / muzzle tip.
     * Takes into account tank world position, hull rotation, turret mount offset,
     * and total gun aim angle (hull rotation + gun relative angle).
     *
     * @param localOffsetX Offset perpendicular to gun barrel (e.g. for twin barrels)
     * @param localOffsetY Offset along gun barrel (defaults to gunParams.border.y - gunParams.center.y)
     */
    public getMuzzleWorldPoint(localOffsetX: number = 0, localOffsetY?: number): Phaser.Math.Vector2 {
        const cosHull = Math.cos(this.rotation);
        const sinHull = Math.sin(this.rotation);

        // 1. Mount point in world space rotated by hull rotation
        const mountX = this.x + (this.gunMountOffsetX * cosHull - this.gunMountOffsetY * sinHull);
        const mountY = this.y + (this.gunMountOffsetX * sinHull + this.gunMountOffsetY * cosHull);

        // 2. Total barrel aim angle
        const totalAngle = this.rotation + this.gun.getRotation();
        const cosTotal = Math.cos(totalAngle);
        const sinTotal = Math.sin(totalAngle);

        // 3. Local muzzle offset along barrel
        const { gun: gunParams } = tanksParams[this.gunType] ?? tanksParams['01'];
        const muzzleDistY = localOffsetY ?? (gunParams.border.y - gunParams.center.y);

        // 4. Muzzle world coordinate
        return new Phaser.Math.Vector2(
            mountX + (localOffsetX * cosTotal - muzzleDistY * sinTotal),
            mountY + (localOffsetX * sinTotal + muzzleDistY * cosTotal)
        );
    }

    /**
     * Overrides getWorldTransformMatrix to ensure Phaser containers and transforms
     * always have the current physics rotation synchronized.
     */
    public override getWorldTransformMatrix(
        tempMatrix?: Phaser.GameObjects.Components.TransformMatrix,
        parentMatrix?: Phaser.GameObjects.Components.TransformMatrix
    ): Phaser.GameObjects.Components.TransformMatrix {
        (this as any)._rotation = this.rotation;
        return super.getWorldTransformMatrix(tempMatrix, parentMatrix);
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
        (this as any)._rotation = this.rotation;
        this.gun.update(_time, delta);
        this.updateResourceBar();

        const dtFrames = delta / (1000 / 60);

        // Temperature dynamics (index.js:915-921)
        if (this.temp > 0) {
            // Burn DoT: 0.1 damage per frame
            this.takeDamage(0.1 * dtFrames);
            // Passive cooldown: 0.7 units per frame
            this.temp = Math.max(0, this.temp - 0.7 * dtFrames);
        } else if (this.temp < 0) {
            // Passive thawing: +0.5 units per frame (30 units/sec)
            this.temp = Math.min(0, this.temp + 0.5 * dtFrames);
        }

        // Visual temperature tinting
        this.updateTemperatureVisuals();

        // Animated tracks & exhaust fire effects (index.js:1001-1018)
        if (this.body) {
            const speed = this.body.speed + Math.abs(this.body.angularVelocity) * 20;
            const isMoving = speed > this.trackAnimSpeedThreshold;

            if (isMoving) {
                // Tracks animation
                this.trackAnimTimer += delta;
                if (this.trackAnimTimer >= this.trackAnimInterval) {
                    this.trackAnimTimer = 0;
                    this.trackFrame = 1 - this.trackFrame;
                    this.trackRight.setTexture(this.trackTextures[this.trackFrame]);
                    this.trackLeft.setTexture(this.trackTextures[1 - this.trackFrame]);
                }

                // Exhaust flames animation
                this.exhaustTimer += delta;
                if (this.exhaustTimer >= this.exhaustInterval) {
                    this.exhaustTimer = 0;
                    this.exhaustFrame = (this.exhaustFrame + 1) % 5;
                    const tex = `exhaust_${this.exhaustFrame}`;
                    this.exhaustLeft.setTexture(tex);
                    this.exhaustRight.setTexture(tex);
                }

                if (!this.exhaustLeft.visible) {
                    this.exhaustLeft.setVisible(true);
                    this.exhaustRight.setVisible(true);
                }
            } else {
                if (this.exhaustLeft.visible) {
                    this.exhaustLeft.setVisible(false);
                    this.exhaustRight.setVisible(false);
                }
            }
        }
    }

    private updateTemperatureVisuals(): void {
        const absTemp = Math.abs(this.temp);
        if (absTemp < 1) {
            this.hull.clearTint();
            this.trackLeft.clearTint();
            this.trackRight.clearTint();
            this.gun.clearTint();
            return;
        }

        // Linear normalization: reaches full color saturation at 400 temp
        const norm = Math.min(1, absTemp / 400);

        if (this.temp < 0) {
            // Cold / Freeze tint: linear progression to intense ice blue / cyan
            const r = Math.round(255 * (1 - norm));
            const g = Math.round(255 * (1 - 0.3 * norm));
            const b = 255;
            const tint = (r << 16) | (g << 8) | b;
            this.hull.setTint(tint);
            this.trackLeft.setTint(tint);
            this.trackRight.setTint(tint);
            this.gun.setTint(tint);
        } else {
            // Heat / Fire tint: linear progression to pure, vivid RED (as requested by user)
            const r = 255;
            const g = Math.round(255 * (1 - norm));
            const b = Math.round(255 * (1 - norm));
            const tint = (r << 16) | (g << 8) | b;
            this.hull.setTint(tint);
            this.trackLeft.setTint(tint);
            this.trackRight.setTint(tint);
            this.gun.setTint(tint);
        }
    }

    private createHPBar(): void {
        const barWidth = 90;
        const barHeight = 10;
        const offsetY = 50;

        this.hpBarBg = this.scene.add.graphics();
        this.hpBarBg.fillStyle(this.hpBarBgColor, 1);
        this.hpBarBg.fillRect(-barWidth / 2, offsetY, barWidth, barHeight);
        this.hpBarBg.setDepth(100);

        this.hpBar = this.scene.add.graphics();
        this.hpBar.fillStyle(this.hpBarColor, 1);
        this.hpBar.fillRect(-barWidth / 2, offsetY, barWidth, barHeight);
        this.hpBar.setDepth(101);

        this.add([this.hpBarBg, this.hpBar]);
    }

    private createResourceBar(): void {
        const barWidth = 90;
        const barHeight = 8;
        const offsetY = 64;

        this.resourceBarBg = this.scene.add.graphics();
        this.resourceBarBg.fillStyle(0x222222, 1);
        this.resourceBarBg.fillRect(-barWidth / 2, offsetY, barWidth, barHeight);
        this.resourceBarBg.setDepth(100);

        this.resourceBar = this.scene.add.graphics();
        this.resourceBar.setDepth(101);
        this.add([this.resourceBarBg, this.resourceBar]);
    }

    private updateResourceBar(): void {
        const barWidth = 90;
        const barHeight = 8;
        const offsetY = 64;

        this.resourceBar.clear();

        const type = this.gun.getResourceType();
        const progress = this.gun.getResourceProgress();

        let color = 0x00ff00;
        let filledWidth = 0;

        if (type === 'cooldown') {
            color = 0x00ff00; // Ready / loading green
            filledWidth = barWidth * progress;
        } else if (type === 'energy') {
            color = 0x00ddff; // Cyan energy
            filledWidth = barWidth * progress;
        } else if (type === 'heat') {
            if (progress >= 1.0) {
                // Overload / Перегруз: flashing warning red / bright fiery orange
                color = (Math.floor(Date.now() / 120) % 2 === 0) ? 0xff0000 : 0xff5500;
                filledWidth = barWidth;
            } else {
                color = 0xff6600; // Orange heat
                filledWidth = barWidth * (1 - progress); // Remaining safe fire capacity
            }
        }

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