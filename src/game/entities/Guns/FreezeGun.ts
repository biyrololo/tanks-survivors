import Phaser from 'phaser';
import Projectile from "../Projectile";
import BaseGun from "./BaseGun";
import type { IGunProps, GunResourceType } from "./Gun";
import type Tank from "../Tank";

export interface IFreezeGunProps extends IGunProps {
    ownerTank: Tank;
    damage?: number;
    bulletSpeed?: number;
    bulletTexture?: string;
}

export default class FreezeGun extends BaseGun {
    // Energy pool matching index.js:1254, 1330, 3583
    private maxEnergy: number = 180;
    private currentEnergy: number = 180;
    private energyCostPerShot: number = 30;
    private energyRegenPerSec: number = 48; // 0.8 units/frame @ 60fps = 48/s (index.js:1116)

    // Inter-shot delay (frCD: 15 frames = 250ms, index.js:508)
    private shotCooldownMs: number = 250;
    private shotCooldownTimer: number = 0;

    private bulletSpeed: number = 420; // 7 px/frame @ 60fps = 420 px/s (index.js:167)
    private damage: number = 17; // index.js:1254, 1331
    private bulletTexture: string = 'freezeBullet';

    constructor(scene: Phaser.Scene, props: IFreezeGunProps) {
        const textureKey = `gun_${props.gunType}`;
        super(scene, props, textureKey);
        if (props.damage) this.damage = props.damage;
        if (props.bulletSpeed) this.bulletSpeed = props.bulletSpeed;
        this.bulletTexture = 'freezeBullet';
        this.recoil.maxShift = 12;

        // FreezeGun suppresses generic cannon Flash_A (index.js:3580-3605)
        this.flashSprite.setVisible(false);
        this.flashSprite.setActive(false);
    }

    public override triggerFlash(): void {
        // FreezeGun does not use Flash_A
    }

    public canFire(): boolean {
        return this.shotCooldownTimer <= 0 && this.currentEnergy >= this.energyCostPerShot;
    }

    public getResourceProgress(): number {
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
        this.triggerRecoil(12, false);

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
                impulseForce: 1,
                size: 40, // freezeBullet size = 40 (index.js:2835)
                lifespan: 1000, // 60 frames = 1000ms (index.js:94)
                statusEffect: {
                    type: 'freeze',
                    amount: -300 // Chills target by 300 temp (index.js:2854)
                }
            });
        }

        return true;
    }

    public override update(_time: number, delta: number): void {
        super.update(_time, delta);

        const dtSec = delta / 1000;

        // Passive energy regeneration (index.js:1116: reload.t -= 0.8 per frame)
        if (this.currentEnergy < this.maxEnergy) {
            this.currentEnergy = Math.min(this.maxEnergy, this.currentEnergy + this.energyRegenPerSec * dtSec);
        }

        if (this.shotCooldownTimer > 0) {
            this.shotCooldownTimer -= delta;
            if (this.shotCooldownTimer < 0) this.shotCooldownTimer = 0;
        }

        if (this.isTriggerDown && this.canFire()) {
            this.tryFire();
        }
    }
}
