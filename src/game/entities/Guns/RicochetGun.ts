import Phaser from 'phaser';
import Projectile from "../Projectile";
import BaseGun from "./BaseGun";
import type { IGunProps, GunResourceType } from "./Gun";
import type Tank from "../Tank";

export interface IRicochetGunProps extends IGunProps {
    ownerTank: Tank;
    damage?: number;
    bulletSpeed?: number;
    bulletTexture?: string;
}

export default class RicochetGun extends BaseGun {
    // Energy pool matching index.js:1252, 1338, 3608
    private maxEnergy: number = 200;
    private currentEnergy: number = 200;
    private energyCostPerShot: number = 40;
    private energyRegenPerSec: number = 36; // 0.6 units/frame @ 60fps = 36/s

    // Inter-shot delay (rickCD: 30 frames = 500ms)
    private shotCooldownMs: number = 500;
    private shotCooldownTimer: number = 0;

    private bulletSpeed: number = 1200; // 20 px/frame @ 60fps = 1200 px/s (index.js:167)
    private damage: number = 30; // index.js:1252, 2917
    private bulletTexture: string = 'bullet';

    constructor(scene: Phaser.Scene, props: IRicochetGunProps) {
        const textureKey = `gun_${props.gunType}`;
        super(scene, props, textureKey);
        if (props.damage) this.damage = props.damage;
        if (props.bulletSpeed) this.bulletSpeed = props.bulletSpeed;
        if (props.bulletTexture) this.bulletTexture = props.bulletTexture;
    }

    public canFire(): boolean {
        return this.shotCooldownTimer <= 0 && this.currentEnergy >= this.energyCostPerShot;
    }

    public getResourceProgress(): number {
        // Return fraction of energy available [0..1]
        return this.currentEnergy / this.maxEnergy;
    }

    public getResourceType(): GunResourceType {
        return 'energy';
    }

    protected override onTriggerDown(): void {
        this.tryFire();
    }

    private tryFire(): boolean {
        if (!this.canFire()) return false;

        this.currentEnergy -= this.energyCostPerShot;
        this.shotCooldownTimer = this.shotCooldownMs;
        this.triggerRecoil();

        const muzzles = this.getMuzzleWorldPoints();
        const worldAngle = this.ownerTank.rotation + this.gunAngle;

        for (const muzzle of muzzles) {
            new Projectile(this.scene, {
                x: muzzle.x,
                y: muzzle.y,
                angle: worldAngle,
                speed: this.bulletSpeed,
                damage: this.damage,
                owner: this.ownerTank,
                team: this.ownerTank.team,
                texture: this.bulletTexture,
                impulseForce: 3,
                size: 20, // ricoBulletSize = 20 (index.js:159)
                lifespan: 1667, // mTimeRBullets = 100 frames = ~1667ms (index.js:94)
                bounces: 5, // Rich bouncing physics
            });
        }

        return true;
    }

    public override update(_time: number, delta: number): void {
        super.update(_time, delta);

        const dtSec = delta / 1000;

        // Passive energy regeneration (index.js:1111-1115: reload.t -= 0.6 per frame)
        if (this.currentEnergy < this.maxEnergy) {
            this.currentEnergy = Math.min(this.maxEnergy, this.currentEnergy + this.energyRegenPerSec * dtSec);
        }

        if (this.shotCooldownTimer > 0) {
            this.shotCooldownTimer -= delta;
            if (this.shotCooldownTimer < 0) this.shotCooldownTimer = 0;
        }

        // Auto-fire while trigger is held if energy and cooldown allow
        if (this.isTriggerDown && this.canFire()) {
            this.tryFire();
        }
    }
}
