import { MAP_WIDTH, MAP_HEIGHT, TILE_SIZE, WALL_RECTS, WATER_RECTS, type IMapRect } from './mapData';

export interface IWaypoint {
    x: number;
    y: number;
}

export default class NavigationGrid {
    public static readonly COLS = Math.floor(MAP_WIDTH / TILE_SIZE); // 70
    public static readonly ROWS = Math.floor(MAP_HEIGHT / TILE_SIZE); // 70
    public static readonly TILE = TILE_SIZE; // 48

    // 0 = walkable, 1 = blocked
    private grid: Uint8Array;

    constructor() {
        this.grid = new Uint8Array(NavigationGrid.COLS * NavigationGrid.ROWS);
        this.buildGrid();
    }

    private buildGrid(): void {
        const obstacles: IMapRect[] = [...WALL_RECTS, ...WATER_RECTS];
        const cols = NavigationGrid.COLS;
        const rows = NavigationGrid.ROWS;
        const tile = NavigationGrid.TILE;

        // Clearance margin: 24px clearance gives half-tank leeway without closing narrow corridors
        const margin = 24;

        for (const obs of obstacles) {
            const minX = Math.max(0, Math.floor((obs.x - margin) / tile));
            const maxX = Math.min(cols - 1, Math.floor((obs.x + obs.w + margin - 1) / tile));
            const minY = Math.max(0, Math.floor((obs.y - margin) / tile));
            const maxY = Math.min(rows - 1, Math.floor((obs.y + obs.h + margin - 1) / tile));

            for (let y = minY; y <= maxY; y++) {
                for (let x = minX; x <= maxX; x++) {
                    this.grid[y * cols + x] = 1;
                }
            }
        }
    }

    public isWalkable(gridX: number, gridY: number): boolean {
        if (gridX < 0 || gridX >= NavigationGrid.COLS || gridY < 0 || gridY >= NavigationGrid.ROWS) {
            return false;
        }
        return this.grid[gridY * NavigationGrid.COLS + gridX] === 0;
    }

    /**
     * Checks if a straight line between two world coordinates is free of obstacles
     */
    public hasLineOfSight(x0: number, y0: number, x1: number, y1: number): boolean {
        const dist = Math.hypot(x1 - x0, y1 - y0);
        if (dist <= 1) return true;

        const steps = Math.ceil(dist / 24);
        const cols = NavigationGrid.COLS;
        const rows = NavigationGrid.ROWS;
        const tile = NavigationGrid.TILE;

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const px = x0 + (x1 - x0) * t;
            const py = y0 + (y1 - y0) * t;
            const gx = Math.floor(px / tile);
            const gy = Math.floor(py / tile);

            if (gx < 0 || gx >= cols || gy < 0 || gy >= rows || this.grid[gy * cols + gx] === 1) {
                return false;
            }
        }
        return true;
    }

    public findNearestWalkable(gx: number, gy: number): { x: number; y: number } {
        const cols = NavigationGrid.COLS;
        const rows = NavigationGrid.ROWS;

        if (gx >= 0 && gx < cols && gy >= 0 && gy < rows && this.grid[gy * cols + gx] === 0) {
            return { x: gx, y: gy };
        }

        for (let r = 1; r <= 5; r++) {
            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    const nx = gx + dx;
                    const ny = gy + dy;
                    if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && this.grid[ny * cols + nx] === 0) {
                        return { x: nx, y: ny };
                    }
                }
            }
        }
        return { x: Math.max(0, Math.min(cols - 1, gx)), y: Math.max(0, Math.min(rows - 1, gy)) };
    }

    /**
     * Finds a smooth obstacle-avoiding waypoint path from world (fromX, fromY) to (toX, toY)
     */
    public findPath(fromX: number, fromY: number, toX: number, toY: number): IWaypoint[] {
        const tile = NavigationGrid.TILE;
        const cols = NavigationGrid.COLS;
        const rows = NavigationGrid.ROWS;

        // If direct line of sight exists, no intermediate waypoints needed
        if (this.hasLineOfSight(fromX, fromY, toX, toY)) {
            return [{ x: toX, y: toY }];
        }

        const start = this.findNearestWalkable(Math.floor(fromX / tile), Math.floor(fromY / tile));
        const goal = this.findNearestWalkable(Math.floor(toX / tile), Math.floor(toY / tile));

        interface INode {
            x: number;
            y: number;
            g: number;
            f: number;
            parent: INode | null;
        }

        const openSet: INode[] = [
            {
                x: start.x,
                y: start.y,
                g: 0,
                f: Math.hypot(goal.x - start.x, goal.y - start.y),
                parent: null
            }
        ];
        const closedSet = new Uint8Array(cols * rows);

        const dirs = [
            { dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 },
            { dx: 1, dy: -1 }, { dx: 1, dy: 1 }, { dx: -1, dy: 1 }, { dx: -1, dy: -1 }
        ];

        let foundNode: INode | null = null;
        let iterations = 0;

        while (openSet.length > 0 && iterations++ < 1200) {
            let bestIdx = 0;
            for (let i = 1; i < openSet.length; i++) {
                if (openSet[i].f < openSet[bestIdx].f) bestIdx = i;
            }

            const current = openSet.splice(bestIdx, 1)[0];
            const idx = current.y * cols + current.x;

            if (closedSet[idx]) continue;
            closedSet[idx] = 1;

            if (current.x === goal.x && current.y === goal.y) {
                foundNode = current;
                break;
            }

            for (const d of dirs) {
                const nx = current.x + d.dx;
                const ny = current.y + d.dy;
                if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;

                const nIdx = ny * cols + nx;
                if (closedSet[nIdx] || this.grid[nIdx] === 1) continue;

                // Diagonal movement clearance check (both adjacent orthogonal cells must be clear)
                if (d.dx !== 0 && d.dy !== 0) {
                    if (this.grid[current.y * cols + nx] === 1 || this.grid[ny * cols + current.x] === 1) {
                        continue;
                    }
                }

                const stepCost = (d.dx !== 0 && d.dy !== 0) ? 1.414 : 1.0;
                const g = current.g + stepCost;
                const h = Math.hypot(goal.x - nx, goal.y - ny);

                openSet.push({
                    x: nx,
                    y: ny,
                    g,
                    f: g + h,
                    parent: current
                });
            }
        }

        if (!foundNode) {
            return [{ x: toX, y: toY }];
        }

        const rawPath: IWaypoint[] = [];
        let curr: INode | null = foundNode;
        while (curr) {
            rawPath.push({
                x: curr.x * tile + tile / 2,
                y: curr.y * tile + tile / 2
            });
            curr = curr.parent;
        }
        rawPath.reverse();

        // Path smoothing via raycast string-pulling: skips redundant waypoints
        if (rawPath.length <= 2) {
            rawPath[rawPath.length - 1] = { x: toX, y: toY };
            return rawPath;
        }

        const smoothed: IWaypoint[] = [rawPath[0]];
        let curIdx = 0;

        while (curIdx < rawPath.length - 1) {
            let furthest = curIdx + 1;
            for (let testIdx = rawPath.length - 1; testIdx > curIdx + 1; testIdx--) {
                if (this.hasLineOfSight(rawPath[curIdx].x, rawPath[curIdx].y, rawPath[testIdx].x, rawPath[testIdx].y)) {
                    furthest = testIdx;
                    break;
                }
            }
            smoothed.push(rawPath[furthest]);
            curIdx = furthest;
        }

        // Snap last waypoint to the exact destination
        smoothed[smoothed.length - 1] = { x: toX, y: toY };
        return smoothed;
    }
}
