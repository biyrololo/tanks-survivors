import Projectile from "../Projectile";
import BaseGun from "./BaseGun";
import type { IGunProps, GunResourceType } from "./Gun";
import { CHARACTERISTICS_GUNS } from "@/game/config/characteristics";
import type Tank from "../Tank";

export interface ISimpleGunProps extends IGunProps {
    ownerTank: Tank;
    damage?: number;
    bulletSpeed?: number;
    bulletTexture?: string;
    reloadTimeMs?: number;
}

export default class SimpleGun extends BaseGun {
    private reloadTime: number; // in milliseconds
    private reloadTimer = 0;

    private bulletSpeed: number = 1500; // px/sec (original: 25 px/frame @ 60fps = 1500 px/s)
    private damage: number = 30; // original: 30
    private bulletTexture: string = 'bullet';
    private ownerTank: Tank;

    constructor(scene: Phaser.Scene, props: ISimpleGunProps) {
        const textureKey = `gun_${props.gunType}`;
        super(scene, props, textureKey);

        this.ownerTank = props.ownerTank;

        const char = CHARACTERISTICS_GUNS[props.gunType] ?? CHARACTERISTICS_GUNS['01'];
        this.damage = props.damage ?? char.playerDamage;

        // In original game: 50 frames @ 60fps = ~833ms
        const frames = char.playerReloadTimeFrames;
        this.reloadTime = props.reloadTimeMs ?? Math.round((frames / 60) * 1000);

        if (props.bulletSpeed) this.bulletSpeed = props.bulletSpeed;
        if (props.bulletTexture) this.bulletTexture = props.bulletTexture;
    }

    public canFire(): boolean {
        return this.reloadTimer <= 0;
    }

    public getResourceProgress(): number {
        return this.reloadTimer / this.reloadTime;
    }

    public getResourceType(): GunResourceType {
        return 'cooldown';
    }

    protected override onTriggerDown(): void {
        this.tryFire();
    }

    private tryFire(): boolean {
        if (!this.canFire()) return false;

        this.reloadTimer = this.reloadTime;
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
                impulseForce: 2,
                size: 16,
            });
        }

        return true;
    }

    public override update(_time: number, delta: number): void {
        super.update(_time, delta);

        if (this.reloadTimer > 0) {
            this.reloadTimer -= delta;
            if (this.reloadTimer < 0) {
                this.reloadTimer = 0;
            }
        }

        // If trigger is held down, auto-fire as soon as cooldown finishes
        if (this.isTriggerDown && this.reloadTimer <= 0) {
            this.tryFire();
        }
    }
}