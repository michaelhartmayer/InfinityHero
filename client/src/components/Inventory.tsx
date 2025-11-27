import { type Item } from '@vibemaster/shared';

interface InventoryProps {
    items: Item[];
    isOpen: boolean;
    onClose: () => void;
    onItemClick?: (item: Item) => void;
}

export function Inventory({ items, isOpen, onClose, onItemClick }: InventoryProps) {
    if (!isOpen) return null;

    const slots = Array(20).fill(null); // Fixed 20 slots
    items.forEach((item, i) => {
        if (i < 20) slots[i] = item;
    });

    return (
        <div className="inventory-modal">
            <div className="inventory-header">
                <h3>Inventory</h3>
                <button className="close-btn" onClick={onClose}>×</button>
            </div>
            <div className="inventory-grid">
                {slots.map((item, index) => (
                    <div
                        key={index}
                        className={`inventory-slot ${item ? 'has-item' : ''}`}
                        title={item?.description}
                        onClick={() => item && onItemClick?.(item)}
                    >
                        {item && <span className="item-icon">{item.icon}</span>}
                        {item && <span className="item-count">1</span>}
                    </div>
                ))}
            </div>
        </div>
    );
}
