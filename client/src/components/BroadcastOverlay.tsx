import { useEffect, useState } from 'react';
import type { BroadcastMessage } from '@vibemaster/shared';

interface BroadcastOverlayProps {
    message: BroadcastMessage | null;
}

export function BroadcastOverlay({ message }: BroadcastOverlayProps) {
    const [visible, setVisible] = useState(false);
    const [currentMessage, setCurrentMessage] = useState<string>('');

    useEffect(() => {
        if (message) {
            setCurrentMessage(message.message);
            setVisible(true);

            // Hide after 5 seconds
            const timer = setTimeout(() => {
                setVisible(false);
            }, 5000);

            return () => clearTimeout(timer);
        }
    }, [message]);

    if (!visible) return null;

    return (
        <div className="broadcast-overlay">
            <div className="broadcast-message">
                {currentMessage}
            </div>
        </div>
    );
}
