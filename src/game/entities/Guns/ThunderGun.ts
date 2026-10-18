import Projectile from "../Projectile";
import BaseGun from "./BaseGun";
import type { IGunProps, GunResourceType } from "./Gun";
import { CHARACTERISTICS_GUNS } from "@/game/config/characteristics";
import type Tank from "../Tank";

export interface IThunderGunProps extends IGunProps {
    ownerTank: Tank;
    damage?: number;
    bulletSpeed?: number;
    bulletTexture?: string;
    reloadTimeMs?: number;
}

export default class ThunderGun extends BaseGun {
    private reloadTime: number;
    private reloadTimer = 0;

    private bulletSpeed: number = 1800; // Fast artillery shell
    private damage: number = 50; // index.js:1250, start_menu.js:85
    private splashRadius: number = 112.5; // (bulletParams.size * thunderSize) / 2 = (75 * 3) / 2 = 112.5 px (index.js:151, 3849)
    private bulletTexture: string = 'bullet';
    private ownerTank: Tank;

    constructor(scene: Phaser.Scene, props: IThunderGunProps) {
        const textureKey = `gun_${props.gunType}`;
        super(scene, props, textureKey);

        this.ownerTank = props.ownerTank;

        const char = CHARACTERISTICS_GUNS['07'];
        this.damage = props.damage ?? char.playerDamage;

        // In original game: 70 frames @ 60fps = ~1167ms
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
                impulseForce: 4,
                size: 24,
                splashRadius: this.splashRadius // 112.5 px AoE blast radius
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

        if (this.isTriggerDown && this.reloadTimer <= 0) {
            this.tryFire();
        }
    }
}
