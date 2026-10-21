import React, { useState, useEffect, useRef } from 'react';
import { useMobileControlsStore } from '@/game/bridge/useMobileControlsStore';
import { usePlayerStore } from '@/game/bridge/usePlayerStore';
import styles from './MobileControls.module.css';

const GUN_KEYS = ['01', '02', '03', '04', '05', '06', '07', '08'];
const MAX_RADIUS = 62; // Maximum knob displacement in pixels matching enlarged 176px joysticks

export const MobileControls: React.FC = () => {
    const [isMobile, setIsMobile] = useState<boolean>(false);

    const {
        setMoveVector,
        setAimVector,
        setIsFiring,
        isAutoFireEnabled,
        toggleAutoFire,
        requestGunSwitch,
        isFiring
    } = useMobileControlsStore();

    const { gunType } = usePlayerStore();

    // Knob offsets for visual rendering
    const [leftOffset, setLeftOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [rightOffset, setRightOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [leftActive, setLeftActive] = useState<boolean>(false);
    const [rightActive, setRightActive] = useState<boolean>(false);

    const leftBaseRef = useRef<HTMLDivElement>(null);
    const rightBaseRef = useRef<HTMLDivElement>(null);

    const leftTouchId = useRef<number | null>(null);
    const rightTouchId = useRef<number | null>(null);
    const manualFireActive = useRef<boolean>(false);

    // Detect mobile touch capability
    useEffect(() => {
        const checkMobile = () => {
            const hasTouch = (
                ('ontouchstart' in window) ||
                (navigator.maxTouchPoints > 0) ||
                window.matchMedia('(pointer: coarse)').matches ||
                window.innerWidth <= 1024
            );
            setIsMobile(hasTouch);
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    if (!isMobile) {
        return null; // Only displayed on mobile devices
    }

    // --- Left Joystick (Movement) Handlers ---
    const handleLeftPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        e.preventDefault();
        leftTouchId.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        setLeftActive(true);
        updateLeftStick(e.clientX, e.clientY);
    };

    const handleLeftPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (leftTouchId.current !== e.pointerId) return;
        e.preventDefault();
        updateLeftStick(e.clientX, e.clientY);
    };

    const handleLeftPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (leftTouchId.current !== e.pointerId) return;
        e.preventDefault();
        leftTouchId.current = null;
        setLeftActive(false);
        setLeftOffset({ x: 0, y: 0 });
        setMoveVector(0, 0, false);
    };

    const updateLeftStick = (clientX: number, clientY: number) => {
        if (!leftBaseRef.current) return;
        const rect = leftBaseRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const dx = clientX - centerX;
        const dy = clientY - centerY;
        const dist = Math.hypot(dx, dy);

        const clampedDist = Math.min(dist, MAX_RADIUS);
        const angle = Math.atan2(dy, dx);

        const knobX = Math.cos(angle) * clampedDist;
        const knobY = Math.sin(angle) * clampedDist;

        setLeftOffset({ x: knobX, y: knobY });

        const normX = clampedDist > 5 ? knobX / MAX_RADIUS : 0;
        const normY = clampedDist > 5 ? knobY / MAX_RADIUS : 0;
        setMoveVector(normX, normY, clampedDist > 5);
    };

    // --- Right Joystick (Turret Aiming & Optional Auto-Fire) Handlers ---
    const handleRightPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        e.preventDefault();
        rightTouchId.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        setRightActive(true);
        updateRightStick(e.clientX, e.clientY);
    };

    const handleRightPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (rightTouchId.current !== e.pointerId) return;
        e.preventDefault();
        updateRightStick(e.clientX, e.clientY);
    };

    const handleRightPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (rightTouchId.current !== e.pointerId) return;
        e.preventDefault();
        rightTouchId.current = null;
        setRightActive(false);
        setRightOffset({ x: 0, y: 0 });
        setAimVector(0, 0, false);

        // Turn off auto-fire on stick release if manual fire is not being held
        if (isAutoFireEnabled && !manualFireActive.current) {
            setIsFiring(false);
        }
    };

    const updateRightStick = (clientX: number, clientY: number) => {
        if (!rightBaseRef.current) return;
        const rect = rightBaseRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const dx = clientX - centerX;
        const dy = clientY - centerY;
        const dist = Math.hypot(dx, dy);

        const clampedDist = Math.min(dist, MAX_RADIUS);
        const angle = Math.atan2(dy, dx);

        const knobX = Math.cos(angle) * clampedDist;
        const knobY = Math.sin(angle) * clampedDist;

        setRightOffset({ x: knobX, y: knobY });

        const isAiming = clampedDist > 6;
        const normX = isAiming ? knobX / MAX_RADIUS : 0;
        const normY = isAiming ? knobY / MAX_RADIUS : 0;
        setAimVector(normX, normY, isAiming);

        // Auto-fire activates while actively steering/aiming turret past deadzone
        if (isAutoFireEnabled) {
            if (clampedDist > 10) {
                setIsFiring(true);
            } else if (!manualFireActive.current) {
                setIsFiring(false);
            }
        }
    };

    // --- Dedicated Manual Fire Button Handlers ---
    const handleFireDown = (e: React.PointerEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        manualFireActive.current = true;
        setIsFiring(true);
    };

    const handleFireUp = (e: React.PointerEvent<HTMLDivElement>) => {
        e.preventDefault();
        manualFireActive.current = false;
        // Keep firing only if right joystick is still actively aiming with auto-fire ON
        if (!isAutoFireEnabled || !rightActive) {
            setIsFiring(false);
        }
    };

    const handleToggleAutoFire = () => {
        const nextState = !isAutoFireEnabled;
        toggleAutoFire();
        if (!nextState && !manualFireActive.current) {
            setIsFiring(false);
        }
    };

    return (
        <div className={styles.mobileControlsContainer}>
            {/* Left Joystick: Movement & Steering */}
            <div
                ref={leftBaseRef}
                className={styles.leftJoystickArea}
                onPointerDown={handleLeftPointerDown}
                onPointerMove={handleLeftPointerMove}
                onPointerUp={handleLeftPointerUp}
                onPointerCancel={handleLeftPointerUp}
            >
                <div className={styles.leftJoystickRing} />
                <div
                    className={`${styles.leftKnob} ${leftActive ? styles.knobActive : ''}`}
                    style={{
                        transform: `translate(${leftOffset.x}px, ${leftOffset.y}px)`
                    }}
                />
            </div>

            {/* Auto-Fire Toggle Button */}
            <button
                type="button"
                className={`${styles.autoFireToggle} ${isAutoFireEnabled ? styles.autoFireOn : styles.autoFireOff}`}
                onClick={handleToggleAutoFire}
                title="Автоматическая стрельба при повороте башни"
            >
                <span className={styles.autoFireIndicator} />
                <span>АВТО-ОГОНЬ: {isAutoFireEnabled ? 'ВКЛ' : 'ВЫКЛ'}</span>
            </button>

            {/* Fire Action Button */}
            <div
                className={`${styles.fireButton} ${isFiring ? styles.fireButtonActive : ''}`}
                onPointerDown={handleFireDown}
                onPointerUp={handleFireUp}
                onPointerCancel={handleFireUp}
                title="Огонь вручную"
            >
                <span className={styles.fireIcon}>💥</span>
                <span className={styles.fireText}>Огонь</span>
            </div>

            {/* Right Joystick: Turret Aiming */}
            <div
                ref={rightBaseRef}
                className={styles.rightJoystickArea}
                onPointerDown={handleRightPointerDown}
                onPointerMove={handleRightPointerMove}
                onPointerUp={handleRightPointerUp}
                onPointerCancel={handleRightPointerUp}
            >
                <div className={styles.rightJoystickRing} />
                <div
                    className={`${styles.rightKnob} ${rightActive ? styles.knobActive : ''}`}
                    style={{
                        transform: `translate(${rightOffset.x}px, ${rightOffset.y}px)`
                    }}
                >
                    <span className={styles.crosshairIcon}>🎯</span>
                </div>
            </div>

            {/* Mobile Quick Weapon Switcher Row */}
            <div className={styles.mobileWeaponBar}>
                {GUN_KEYS.map((k, idx) => (
                    <button
                        key={k}
                        type="button"
                        className={`${styles.weaponBtn} ${gunType === k ? styles.weaponBtnActive : ''}`}
                        onClick={() => requestGunSwitch(k)}
                    >
                        {idx + 1}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default MobileControls;
