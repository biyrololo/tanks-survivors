export interface TankParams {
    hull: {
        center: {
            x: number;
            y: number;
        };

        track: {
            x: number;
            y: number;
            w: number;
            h: number;
        };

        border: {
            x: number;
            y: number;
            dy: number;
        };

        fire: number;
    };

    gun: {
        center: {
            x: number;
            y: number;
        };

        border: {
            y: number;
        };
    };
}
export const tanksParams: Record<string, TankParams> = {
    '01': {
        hull: {
            center: { x: 128, y: 174 },
            track: { x: 39, w: 43, h: 256, y: 6 },
            border: { x: 39, y: 6, dy: -6 },
            fire: 245
        },
        gun: {
            center: { x: 128, y: 160 },
            border: { y: 0 }
        }
    },

    '02': {
        hull: {
            center: { x: 128, y: 150 },
            track: { x: 39, w: 43, h: 256, y: 6 },
            border: { x: 39, y: 6, dy: -6 },
            fire: 229
        },
        gun: {
            center: { x: 128, y: 148 },
            border: { y: 0 }
        }
    },

    '03': {
        hull: {
            center: { x: 128, y: 157 },
            track: { x: 51, w: 41, h: 246, y: 5 },
            border: { x: 51, y: 5, dy: 4 },
            fire: 241
        },
        gun: {
            center: { x: 128, y: 153 },
            border: { y: 21 }
        }
    },

    '04': {
        hull: {
            center: { x: 128, y: 174 },
            track: { x: 67, w: 34, h: 210, y: 37 },
            border: { x: 67, y: 37, dy: 9 },
            fire: 239
        },
        gun: {
            center: { x: 128, y: 163 },
            border: { y: 16 }
        }
    },

    '05': {
        hull: {
            center: { x: 128, y: 153 },
            track: { x: 45, w: 43, h: 252, y: 2 },
            border: { x: 45, y: 2, dy: 2 },
            fire: 244
        },
        gun: {
            center: { x: 128, y: 157 },
            border: { y: 0 }
        }
    },

    '06': {
        hull: {
            center: { x: 128, y: 148 },
            track: { x: 45, w: 49, h: 257, y: 0 },
            border: { x: 45, y: 0, dy: -1 },
            fire: 241
        },
        gun: {
            center: { x: 128, y: 144 },
            border: { y: 29 }
        }
    },

    '07': {
        hull: {
            center: { x: 128, y: 152 },
            track: { x: 51, w: 41, h: 246, y: 9 },
            border: { x: 53, y: 9, dy: 0 },
            fire: 251
        },
        gun: {
            center: { x: 128, y: 159 },
            border: { y: 0 }
        }
    },

    '08': {
        hull: {
            center: { x: 128, y: 150 },
            track: { x: 63, w: 40, h: 221, y: 22 },
            border: { x: 63, y: 22, dy: 13 },
            fire: 238
        },
        gun: {
            center: { x: 128, y: 140 },
            border: { y: 17 }
        }
    }
};