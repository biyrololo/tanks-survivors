import { tanksParams } from "@/game/config/tankParams";
import Projectile from "../Projectile";
import type { IGun, IGunProps } from "./Gun";
import Phaser from "phaser";

export default class SimpleGun extends Phaser.GameObjects.Container implements IGun {
    private reloadTime: number;
    private reloadTimer = 0;

    private bulletSpeed: number = 900;
    private damage: number = 10;
    private bulletTexture: string = 'bullet';

    private gun: Phaser.GameObjects.Sprite;

    private gunAngle = 0;
    public gunRotationSpeed = 4;

    public getRotation(): number {
        return this.gunAngle;
    }

    constructor(scene: Phaser.Scene, props: IGunProps) {
        super(scene, 0, 0);
        this.reloadTime = 1000;
        this.gun = new Phaser.GameObjects.Sprite(scene, 0, 0, 'gun_01');

        const { gun: gunParams } = tanksParams['01'];

        this.gun.setOrigin(
            gunParams.center.x / this.gun.width,
            gunParams.center.y / this.gun.height
        );
        this.gun.setPosition(props.gunPosition.x, props.gunPosition.y);
        this.add(this.gun);

        scene.add.existing(this);
    }

    public rotateGun(direction: number, delta: number) {
        const dt = delta / 1000;
        this.gunAngle += direction * this.gunRotationSpeed * dt;
        this.gun.setRotation(this.gunAngle);
    }

    public getReloadTime(): number {
        return this.reloadTimer;
    }

    public canFire(): boolean {
        return this.reloadTimer <= 0;
    }

    public fire(
        x: number,
        y: number,
        angle: number,
        team: string,
        owner: Phaser.GameObjects.GameObject
    ): void {
        if (!this.canFire()) return;

        this.reloadTimer = this.reloadTime;

        new Projectile(this.scene, {
            x: x,
            y: y,
            angle: angle,
            speed: this.bulletSpeed,
            damage: this.damage,
            owner,
            team,
            texture: this.bulletTexture,
            impulseForce: 2,
            size: 16,
        });
    }

    public update(_time: number, delta: number): void {
        if (this.reloadTimer > 0) {
            this.reloadTimer -= delta;
            if (this.reloadTimer < 0) {
                this.reloadTimer = 0;
            }
        }
    }

    public getReloadProgress(): number {
        return this.reloadTimer / this.reloadTime;
    }
}