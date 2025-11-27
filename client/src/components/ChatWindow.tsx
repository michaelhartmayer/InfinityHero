import { useState, useEffect, useRef } from 'react';
import { type ChatMessage } from '@vibemaster/shared';

interface ChatWindowProps {
    messages: ChatMessage[];
    onSendMessage: (message: string) => void;
}

export function ChatWindow({ messages, onSendMessage, isChatMode, onSetChatMode }: ChatWindowProps & { isChatMode: boolean, onSetChatMode: (mode: boolean) => void }) {
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        if (isChatMode) {
            inputRef.current?.focus();
        } else {
            inputRef.current?.blur();
        }
    }, [isChatMode]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim()) {
            onSendMessage(input);
            setInput('');
        } else {
            onSetChatMode(false);
        }
    };

    return (
        <div className="chat-window">
            <div className="chat-messages">
                {messages.map((msg) => (
                    <div key={msg.id} className="chat-message">
                        <span className="chat-author">{msg.playerName}:</span>
                        <span className="chat-text">{msg.message}</span>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
            <form onSubmit={handleSubmit} className="chat-input-form" style={{ opacity: isChatMode ? 1 : 0.5, pointerEvents: 'auto' }}>
                <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onClick={() => onSetChatMode(true)}
                    placeholder={isChatMode ? "Type a message..." : "Press Enter to chat..."}
                    className="chat-input"
                />
            </form>
        </div>
    );
}
