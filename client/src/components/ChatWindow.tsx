import { useState, useEffect, useRef } from 'react';
import { type ChatMessage } from '@vibemaster/shared';

interface ChatWindowProps {
    messages: ChatMessage[];
    onSendMessage: (message: string) => void;
}

export function ChatWindow({ messages, onSendMessage }: ChatWindowProps) {
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim()) {
            onSendMessage(input);
            setInput('');
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
            <form onSubmit={handleSubmit} className="chat-input-form">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Press Enter to chat..."
                    className="chat-input"
                />
            </form>
        </div>
    );
}
