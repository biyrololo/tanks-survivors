import { create } from 'zustand';

export interface IPlayerState {
    health: number;
    maxHealth: number;
    exp: number;
    level: number;
    expNeeded: number;
    temp: number;
    gunType: string;
    resourceProgress: number;
    resourceType: 'cooldown' | 'energy' | 'heat';
    enemiesKilled: number;
    survivalTimeSec: number;

    // Actions
    updatePlayerStats: (stats: Partial<IPlayerState>) => void;
    incrementKills: () => void;
    resetStats: () => void;
}

export const usePlayerStore = create<IPlayerState>((set) => ({
    health: 420,
    maxHealth: 420,
    exp: 0,
    level: 1,
    expNeeded: 1,
    temp: 0,
    gunType: '01',
    resourceProgress: 0,
    resourceType: 'cooldown',
    enemiesKilled: 0,
    survivalTimeSec: 0,

    updatePlayerStats: (stats) => set((state) => ({ ...state, ...stats })),
    incrementKills: () => set((state) => ({ enemiesKilled: state.enemiesKilled + 1 })),
    resetStats: () => set({
        health: 420,
        maxHealth: 420,
        exp: 0,
        level: 1,
        expNeeded: 1,
        temp: 0,
        gunType: '01',
        resourceProgress: 0,
        resourceType: 'cooldown',
        enemiesKilled: 0,
        survivalTimeSec: 0
    })
}));
