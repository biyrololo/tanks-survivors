import Phaser from "phaser";
import type Tank from "../Tank";

export type GunResourceType = 'cooldown' | 'energy' | 'heat';

export interface IGun extends Phaser.GameObjects.Container {
    readonly gunType: string;

    /** Current gun rotation relative to the tank hull (in radians) */
    getRotation(): number;
    /** Rotate gun by direction (-1 or 1) with speed and delta */
    rotateGun(direction: number, delta: number): void;
    /** Set gun rotation angle directly (for mouse aim / target tracking) */
    setGunRotation(angle: number): void;
    /** Multiplier on gun rotation speed (for overload / temperature slow-downs) */
    getTurnSpeedMultiplier?(): number;

    /** Trigger lifecycle: called when fire button/mouse is pressed (true) or released (false) */
    setTrigger(isDown: boolean): void;

    /** Legacy / instant fire helper */
    canFire(): boolean;

    /** Returns normalized resource value [0..1] for the tank HUD bar */
    getResourceProgress(): number;
    /** Returns resource semantic for HUD coloring/labeling */
    getResourceType(): GunResourceType;

    /** Calculates world coordinates of all muzzles (supports 1, 2 or more barrels) */
    getMuzzleWorldPoints(): Phaser.Math.Vector2[];

    /** Updates cooldowns, charging, recoil, flash, and continuous firing states */
    update(time: number, delta: number): void;

    /** Tints the gun sprite for visual temperature effects (freeze / burn) */
    setTint(tint: number): void;
    /** Clears the gun sprite tint */
    clearTint(): void;
}

export interface IGunProps {
    gunType: string;
    gunPosition: { x: number; y: number };
    ownerTank: Tank;
    hullColor?: string;
}