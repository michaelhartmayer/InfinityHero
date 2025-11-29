import React, { useEffect, useRef, useState } from 'react';

interface DebugPanelProps {
    sessionId: string;
    animationInfo?: string;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({ sessionId, animationInfo }) => {
    const [fps, setFps] = useState(0);
    const frameCount = useRef(0);
    const lastTime = useRef(performance.now());
    const requestRef = useRef<number | null>(null);

    useEffect(() => {
        const animate = (time: number) => {
            frameCount.current++;
            const diff = time - lastTime.current;

            if (diff >= 1000) {
                setFps(Math.round((frameCount.current * 1000) / diff));
                frameCount.current = 0;
                lastTime.current = time;
            }

            requestRef.current = requestAnimationFrame(animate);
        };

        requestRef.current = requestAnimationFrame(animate);

        return () => {
            if (requestRef.current) {
                cancelAnimationFrame(requestRef.current);
            }
        };
    }, []);

    return (
        <div style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            background: 'rgba(0, 0, 0, 0.5)',
            color: 'white',
            padding: '8px',
            borderRadius: '4px',
            fontSize: '12px',
            fontFamily: 'monospace',
            pointerEvents: 'none',
            zIndex: 1000,
            backdropFilter: 'blur(2px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            minWidth: '700px'
        }}>
            <div>FPS: {fps}</div>
            <div style={{ marginTop: '4px', opacity: 0.8 }}>Session: {sessionId}</div>
            {animationInfo && <div style={{ marginTop: '4px', color: '#aaa' }}>{animationInfo}</div>}
        </div>
    );
};
