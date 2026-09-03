import Phaser from "phaser";

export interface IGun extends Phaser.GameObjects.Container {
    getReloadTime(): number;
    fire(
        x: number,
        y: number,
        angle: number,
        team: string,
        owner: Phaser.GameObjects.GameObject
    ): void;
    getRotation(): number;
    rotateGun(angle: number, delta: number): void;
    getReloadProgress(): number;
    canFire(): boolean;
}

export interface IGunProps {
    gunPosition: { x: number; y: number };
}