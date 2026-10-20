import Phaser from "phaser";
import Projectile from "../Projectile";
import BaseGun from "./BaseGun";
import type { IGunProps, GunResourceType } from "./Gun";
import { CHARACTERISTICS_GUNS } from "@/game/config/characteristics";
import type Tank from "../Tank";

export interface ITwinGunProps extends IGunProps {
    ownerTank: Tank;
    damage?: number;
    bulletSpeed?: number;
    bulletTexture?: string;
    reloadTimeMs?: number;
}

export default class TwinGun extends BaseGun {
    private reloadTime: number;
    private reloadTimer = 0;

    private bulletSpeed: number = 1500;
    private damage: number = 30; // 30 per barrel in player start_menu.js / characteristics.js
    private bulletTexture: string = 'bullet';

    // Original game constant: angleShiftMultishots = 10 deg (index.js:98)
    private spreadAngleRad = Phaser.Math.DegToRad(5); // -5 deg and +5 deg

    private flashSpriteRight: Phaser.GameObjects.Sprite;

    constructor(scene: Phaser.Scene, props: ITwinGunProps) {
        const textureKey = `gun_${props.gunType}`;
        super(scene, props, textureKey);

        const localMuzzleY = 29 - 144;
        this.flashSprite.setX(-10);
        this.flashSprite.setY(localMuzzleY);

        this.flashSpriteRight = new Phaser.GameObjects.Sprite(scene, 10, localMuzzleY, 'flash_A_0');
        this.flashSpriteRight.setOrigin(0.5, 0.84);
        this.flashSpriteRight.setVisible(false);
        this.add(this.flashSpriteRight);

        const char = CHARACTERISTICS_GUNS['06'];
        this.damage = props.damage ?? char.playerDamage;

        // In original game: 50 frames @ 60fps = ~833ms
        const frames = char.playerReloadTimeFrames;
        this.reloadTime = props.reloadTimeMs ?? Math.round((frames / 60) * 1000);

        if (props.bulletSpeed) this.bulletSpeed = props.bulletSpeed;
        if (props.bulletTexture) this.bulletTexture = props.bulletTexture;
        this.recoil.maxShift = 15;
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

    /**
     * Dual barrels: returns two muzzle points offset to left and right of barrel center
     */
    public override getMuzzleWorldPoints(): Phaser.Math.Vector2[] {
        const localMuzzleY = 29 - 144; // border.y - center.y from tankParams['06']
        const barrelSeparation = 10; // 10px left and right in local space

        if (this.ownerTank) {
            return [
                this.ownerTank.getMuzzleWorldPoint(-barrelSeparation, localMuzzleY),
                this.ownerTank.getMuzzleWorldPoint(barrelSeparation, localMuzzleY)
            ];
        }

        const matrix = this.getWorldTransformMatrix();
        const p1 = new Phaser.Math.Vector2(
            matrix.getX(-barrelSeparation, localMuzzleY),
            matrix.getY(-barrelSeparation, localMuzzleY)
        );
        const p2 = new Phaser.Math.Vector2(
            matrix.getX(barrelSeparation, localMuzzleY),
            matrix.getY(barrelSeparation, localMuzzleY)
        );

        return [p1, p2];
    }

    protected override onTriggerDown(): void {
        this.tryFire();
    }

    private tryFire(): boolean {
        if (!this.canFire()) return false;

        this.reloadTimer = this.reloadTime;
        this.triggerRecoil();

        const muzzles = this.getMuzzleWorldPoints();
        const baseWorldAngle = this.ownerTank.rotation + this.gunAngle;

        // Left barrel: angle - 5 deg
        // Right barrel: angle + 5 deg
        const angles = [baseWorldAngle - this.spreadAngleRad, baseWorldAngle + this.spreadAngleRad];

        for (let i = 0; i < muzzles.length; i++) {
            const muzzle = muzzles[i];
            const angle = angles[i] ?? baseWorldAngle;

            new Projectile(this.scene, {
                x: muzzle.x,
                y: muzzle.y,
                angle: angle,
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

    public override triggerFlash(): void {
        super.triggerFlash();
        if (this.flashSpriteRight) {
            this.flashSpriteRight.setTexture('flash_A_0');
            this.flashSpriteRight.setVisible(true);
        }
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

        // Advance right barrel muzzle flash
        if (this.flashSpriteRight) {
            this.flashSpriteRight.setY(this.baseMuzzleY + this.gunSprite.y);
            if (this.isFlash) {
                const progress = 1 - (this.flashTimer / this.flashDurationMs);
                const frame = Math.min(4, Math.floor(progress * 5));
                this.flashSpriteRight.setTexture(`flash_A_${frame}`);
                this.flashSpriteRight.setVisible(true);
            } else {
                this.flashSpriteRight.setVisible(false);
            }
        }
    }
}
