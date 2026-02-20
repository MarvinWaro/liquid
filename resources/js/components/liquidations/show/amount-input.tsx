import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';

interface AmountInputProps {
    value: number | null | undefined;
    onValueChange: (val: number | null) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
}

/**
 * Calculator-style amount input: digits build right-to-left (like ATM/POS terminal)
 * e.g. type "5" → 0.05, type "0" → 0.50, type "0" → 5.00, type "0" → 50.00
 */
export default function AmountInput({
    value,
    onValueChange,
    placeholder = '0.00',
    className = '',
    disabled = false,
}: AmountInputProps) {
    const isFocused = useRef(false);

    const [digits, setDigits] = useState<string>(() =>
        value ? Math.round(value * 100).toString() : ''
    );

    useEffect(() => {
        if (!isFocused.current) {
            setDigits(value ? Math.round(value * 100).toString() : '');
        }
    }, [value]);

    const display = useMemo(() => {
        if (!digits) return '';
        const cents = parseInt(digits, 10);
        return (cents / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }, [digits]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key >= '0' && e.key <= '9') {
            e.preventDefault();
            const newDigits = digits + e.key;
            setDigits(newDigits);
            onValueChange(parseInt(newDigits, 10) / 100);
        } else if (e.key === 'Backspace' || e.key === 'Delete') {
            e.preventDefault();
            const newDigits = digits.slice(0, -1);
            setDigits(newDigits);
            onValueChange(newDigits ? parseInt(newDigits, 10) / 100 : null);
        }
    };

    return (
        <Input
            type="text"
            value={display}
            onFocus={() => { isFocused.current = true; }}
            onBlur={() => { isFocused.current = false; }}
            onKeyDown={handleKeyDown}
            onChange={() => {}}
            disabled={disabled}
            className={`text-right ${className}`}
            placeholder={placeholder}
        />
    );
}
