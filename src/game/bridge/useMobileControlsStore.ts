import { create } from 'zustand';

export interface IMobileControlsState {
    // Left stick (movement)
    moveVector: { x: number; y: number }; // normalized -1 to 1
    isMoving: boolean;

    // Right stick (turret aiming)
    aimVector: { x: number; y: number }; // normalized -1 to 1
    isAiming: boolean;

    // Fire state
    isFiring: boolean;
    isAutoFireEnabled: boolean;

    // Weapon switch request (gunType '01' - '08')
    requestedGun: string | null;

    // Actions
    setMoveVector: (x: number, y: number, isMoving: boolean) => void;
    setAimVector: (x: number, y: number, isAiming: boolean) => void;
    setIsFiring: (isFiring: boolean) => void;
    toggleAutoFire: () => void;
    requestGunSwitch: (gunType: string) => void;
    clearRequestedGun: () => void;
}

export const useMobileControlsStore = create<IMobileControlsState>((set) => ({
    moveVector: { x: 0, y: 0 },
    isMoving: false,

    aimVector: { x: 0, y: 0 },
    isAiming: false,

    isFiring: false,
    isAutoFireEnabled: true, // Default ON for smooth mobile twin-stick shooting
    requestedGun: null,

    setMoveVector: (x, y, isMoving) => set({ moveVector: { x, y }, isMoving }),
    setAimVector: (x, y, isAiming) => set({ aimVector: { x, y }, isAiming }),
    setIsFiring: (isFiring) => set({ isFiring }),
    toggleAutoFire: () => set((state) => ({ isAutoFireEnabled: !state.isAutoFireEnabled })),
    requestGunSwitch: (gunType) => set({ requestedGun: gunType }),
    clearRequestedGun: () => set({ requestedGun: null })
}));
