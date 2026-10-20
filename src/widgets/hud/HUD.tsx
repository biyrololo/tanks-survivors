import React from 'react';
import { usePlayerStore } from '@/game/bridge/usePlayerStore';
import styles from './HUD.module.css';

const GUN_NAMES: Record<string, string> = {
    '01': 'Пушка',
    '02': 'Рельса',
    '03': 'Рикошет',
    '04': 'Огнемёт',
    '05': 'Фриз',
    '06': 'Двойная',
    '07': 'Гром',
    '08': 'Миниган'
};

const GUN_KEYS = ['01', '02', '03', '04', '05', '06', '07', '08'];

export const HUD: React.FC = () => {
    const {
        health,
        maxHealth,
        exp,
        level,
        expNeeded,
        temp,
        gunType,
        resourceProgress,
        resourceType,
        enemiesKilled,
        survivalTimeSec
    } = usePlayerStore();

    const hpRatio = Math.max(0, Math.min(1, health / (maxHealth || 1)));
    const expRatio = Math.max(0, Math.min(1, exp / (expNeeded || 1)));
    const isHpLow = hpRatio < 0.3;

    const minutes = Math.floor(survivalTimeSec / 60).toString().padStart(2, '0');
    const seconds = (survivalTimeSec % 60).toString().padStart(2, '0');

    let resourceFillClass = styles.resourceFillCooldown;
    if (resourceType === 'energy') resourceFillClass = styles.resourceFillEnergy;
    if (resourceType === 'heat') resourceFillClass = styles.resourceFillHeat;

    const resourcePercent = Math.round(resourceProgress * 100);

    return (
        <div className={styles.hudOverlay}>
            {/* Top Bar: Level, EXP and Stats */}
            <div className={styles.topBar}>
                <div className={styles.levelBadge}>
                    <span>LVL</span>
                    <span>{level}</span>
                </div>

                <div className={styles.expContainer}>
                    <div className={styles.expHeader}>
                        <span>Опыт</span>
                        <span>{exp} / {expNeeded} ({Math.round(expRatio * 100)}%)</span>
                    </div>
                    <div className={styles.expTrack}>
                        <div
                            className={styles.expFill}
                            style={{ width: `${expRatio * 100}%` }}
                        />
                    </div>
                </div>

                <div className={styles.topRightStats}>
                    <div className={styles.statItem} title="Время выживания">
                        <span>⏱️</span>
                        <span>{minutes}:{seconds}</span>
                    </div>
                    <div className={styles.statItem} title="Уничтожено врагов">
                        <span>💀</span>
                        <span>{enemiesKilled}</span>
                    </div>
                </div>
            </div>

            {/* Bottom-Left Panel: Health, Weapon Resource, Active Gun, Temperature */}
            <div className={styles.bottomLeftPanel}>
                <div className={styles.weaponHeader}>
                    <div className={styles.weaponName}>
                        {GUN_NAMES[gunType] ?? 'Пушка'}
                    </div>

                    {/* Temperature Indicator */}
                    {temp > 0 ? (
                        <div className={`${styles.tempBadge} ${styles.tempHot}`}>
                            <span>🔥</span>
                            <span>+{temp}°</span>
                        </div>
                    ) : temp < 0 ? (
                        <div className={`${styles.tempBadge} ${styles.tempCold}`}>
                            <span>❄️</span>
                            <span>{temp}°</span>
                        </div>
                    ) : (
                        <div className={`${styles.tempBadge} ${styles.tempNormal}`}>
                            <span>0°</span>
                        </div>
                    )}
                </div>

                {/* Health Bar */}
                <div className={styles.barGroup}>
                    <div className={styles.barLabel}>
                        <span>Прочность</span>
                        <span>{health} / {maxHealth}</span>
                    </div>
                    <div className={styles.barTrack}>
                        <div
                            className={`${styles.hpFill} ${isHpLow ? styles.hpFillLow : ''}`}
                            style={{ width: `${hpRatio * 100}%` }}
                        />
                    </div>
                </div>

                {/* Gun Resource Bar (Cooldown / Energy / Heat) */}
                <div className={styles.barGroup}>
                    <div className={styles.barLabel}>
                        <span>{resourceType === 'heat' ? 'Нагрев' : resourceType === 'energy' ? 'Энергия' : 'Перезарядка'}</span>
                        <span>{resourcePercent}%</span>
                    </div>
                    <div className={styles.barTrack}>
                        <div
                            className={resourceFillClass}
                            style={{ width: `${resourceProgress * 100}%` }}
                        />
                    </div>
                </div>

                {/* Weapon Hotkeys (1 - 8) */}
                <div className={styles.weaponKeysHint}>
                    {GUN_KEYS.map((k, idx) => (
                        <div
                            key={k}
                            className={`${styles.keyPill} ${gunType === k ? styles.keyPillActive : ''}`}
                            title={GUN_NAMES[k]}
                        >
                            {idx + 1}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
export default HUD;
