import Phaser from 'phaser';
import Tank from './Tank';
import BotController from './BotController';
import type MapManager from '../map/MapManager';
import { CHARACTERISTICS_HULLS, CHARACTERISTICS_GUNS } from '../config/characteristics';

export interface ISpawnedBot {
    tank: Tank;
    controller: BotController;
}

export default class WaveSpawner {
    private scene: Phaser.Scene;
    private mapManager: MapManager;
    private player: Tank;

    public baseMaxEnemies: number = 3;
    public maxAllies: number = 2;
    public spawnIntervalMs: number = 4500;

    private spawnTimer: number = 2000; // First bot spawns after 2s
    public spawnedBots: ISpawnedBot[] = [];

    private readonly availableHulls = ['01', '02', '03', '04', '05', '06', '07', '08'];
    private readonly availableGuns = ['01', '02', '03', '04', '05', '06', '07', '08'];
    private readonly availableTracks = ['1', '2', '3', '4'];

    constructor(scene: Phaser.Scene, mapManager: MapManager, player: Tank) {
        this.scene = scene;
        this.mapManager = mapManager;
        this.player = player;
    }

    public update(delta: number, allTanks: Tank[]): void {
        // Clean up destroyed bots
        this.spawnedBots = this.spawnedBots.filter(b => b.tank.active && b.tank.body);

        // Update active bot controllers
        for (const bot of this.spawnedBots) {
            if (bot.tank.active && bot.tank.body) {
                bot.controller.update(delta, allTanks);
            }
        }

        // Timer for periodic spawns
        this.spawnTimer -= delta;
        if (this.spawnTimer <= 0) {
            this.spawnTimer = this.spawnIntervalMs;
            this.trySpawnWave(allTanks);
        }
    }

    private trySpawnWave(allTanks: Tank[]): void {
        // Dynamic cap: starts at 3, increases by 1 every 2 player levels up to 7 max (matching index.js)
        const currentCap = Math.min(7, this.baseMaxEnemies + Math.floor((this.player.level - 1) / 2));
        const currentEnemies = allTanks.filter(t => t.active && t.team === 'enemy').length;
        const currentAllies = allTanks.filter(t => t.active && (t.team === 'player' || t.team === 'ally')).length - 1; // excluding player

        // Spawn 1 enemy if below cap
        if (currentEnemies < currentCap) {
            this.spawnBot('enemy', allTanks);
        }

        // Friendly ally bot spawn (e.g. 20% chance per tick if below ally cap)
        if (currentAllies < this.maxAllies && Math.random() < 0.2) {
            this.spawnBot('ally', allTanks);
        }
    }

    private spawnBot(team: 'enemy' | 'ally', allTanks: Tank[]): Tank | null {
        // Find valid spawn point not too close to player (< 400px) or overlapping existing tanks (< 120px)
        let bestSpawn: { x: number; y: number } | null = null;
        for (let attempts = 0; attempts < 20; attempts++) {
            const pt = this.mapManager.getRandomSpawnPoint();
            const distToPlayer = Phaser.Math.Distance.Between(pt.x, pt.y, this.player.x, this.player.y);
            if (distToPlayer < 400) continue;

            const isOverlapping = allTanks.some(t =>
                t.active && Phaser.Math.Distance.Between(pt.x, pt.y, t.x, t.y) < 120
            );
            if (isOverlapping) continue;

            bestSpawn = pt;
            break;
        }

        if (!bestSpawn) return null;

        const hullType = Phaser.Utils.Array.GetRandom(this.availableHulls);
        const gunType = Phaser.Utils.Array.GetRandom(this.availableGuns);
        const trackType = Phaser.Utils.Array.GetRandom(this.availableTracks);

        const hullChar = CHARACTERISTICS_HULLS[hullType] ?? CHARACTERISTICS_HULLS['01'];
        const gunChar = CHARACTERISTICS_GUNS[gunType] ?? CHARACTERISTICS_GUNS['01'];

        let maxHealth = hullChar.maxHealth;
        let damage = gunChar.damage;

        // Dynamic enemy difficulty scaling based on player level (index.js:1321-1326)
        if (team === 'enemy' && this.player.level > 10) {
            const levelTier = Math.floor((this.player.level - 10) / 5) + 1;
            maxHealth += 40 * levelTier;
            damage += levelTier;
        }

        const botTank = new Tank(this.scene, {
            x: bestSpawn.x,
            y: bestSpawn.y,
            hullTexture: `hull_${hullType}`,
            gunTexture: `gun_${gunType}`,
            hullType: hullType,
            gunType: gunType,
            trackTextures: [`track_${trackType}A`, `track_${trackType}B`],
            bulletTexture: 'bullet',
            bulletSpeed: 1200,
            damage: damage,
            maxHealth: maxHealth,
            team: team
        });

        const controller = new BotController(botTank, this.mapManager.navigationGrid);
        this.spawnedBots.push({ tank: botTank, controller });

        this.scene.events.emit('bot-spawned', botTank);
        return botTank;
    }
}
