
import React, { useState, useRef, useEffect } from 'react';
import EmojiPicker, { type EmojiClickData, Theme, Categories } from 'emoji-picker-react';

interface IconSelectorProps {
    value: string;
    onChange: (iconName: string) => void;
}

const IconSelector: React.FC<IconSelectorProps> = ({ value, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const onEmojiClick = (emojiData: EmojiClickData) => {
        onChange(emojiData.emoji);
        setIsOpen(false);
    };

    return (
        <div className="icon-selector" ref={containerRef} style={{ position: 'relative' }}>
            <div
                className="selected-icon-display"
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px',
                    background: 'rgba(0, 0, 0, 0.2)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    cursor: 'pointer'
                }}
            >
                <div style={{
                    width: '40px',
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '4px',
                    fontSize: '24px'
                }}>
                    {value || '❓'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.8rem', color: '#aaa' }}>Selected Icon</span>
                    <span style={{ fontWeight: 'bold' }}>{value ? 'Change Icon' : 'Select Icon'}</span>
                </div>
            </div>

            {isOpen && (
                <>
                    <div
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            zIndex: 999,
                            background: 'rgba(0,0,0,0.5)'
                        }}
                        onClick={() => setIsOpen(false)}
                    />
                    <div
                        style={{
                            position: 'fixed',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            zIndex: 1000,
                            boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
                        }}
                    >
                        <EmojiPicker
                            onEmojiClick={onEmojiClick}
                            theme={Theme.DARK}
                            lazyLoadEmojis={true}
                            height={600}
                            width={600}
                            skinTonesDisabled={true}
                            categories={[
                                { category: Categories.OBJECTS, name: 'Objects' },
                                { category: Categories.SYMBOLS, name: 'Symbols' },
                                { category: Categories.ANIMALS_NATURE, name: 'Animals' },
                                { category: Categories.SMILEYS_PEOPLE, name: 'Smileys' },
                                { category: Categories.ACTIVITIES, name: 'Activities' }
                            ]}
                        />
                    </div>
                </>
            )}
        </div>
    );
};

export default IconSelector;
