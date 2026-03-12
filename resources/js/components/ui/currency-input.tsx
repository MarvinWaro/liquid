import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Calculator-style currency input.
 *
 * Digits are entered from right-to-left (cents → hundreds → thousands).
 * The display value is always formatted with commas and two decimal places.
 *
 * Props:
 *  - value: raw numeric string (e.g. "50000.00" or "0") stored in parent state
 *  - onValueChange: callback with the raw numeric string (e.g. "500.00")
 *  - className: optional extra classes
 *  - All other native input props are forwarded
 */

interface CurrencyInputProps extends Omit<React.ComponentProps<'input'>, 'value' | 'onChange' | 'type'> {
    value: string;
    onValueChange: (raw: string) => void;
}

function rawToDisplay(raw: string): string {
    // Convert raw numeric string to formatted display (e.g. "12345.67" → "12,345.67")
    const num = parseFloat(raw);
    if (isNaN(num) || num === 0) return '0.00';
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function centsToRaw(cents: number): string {
    // Convert integer cents to raw string (e.g. 12345 → "123.45")
    const val = (cents / 100).toFixed(2);
    return val;
}

function rawToCents(raw: string): number {
    const num = parseFloat(raw);
    if (isNaN(num)) return 0;
    return Math.round(num * 100);
}

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
    ({ value, onValueChange, className, placeholder, ...props }, ref) => {
        const cents = rawToCents(value);
        const displayValue = rawToDisplay(value);

        const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
            // Allow: Tab, Enter, Escape, arrow keys
            if (['Tab', 'Enter', 'Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
                return;
            }

            e.preventDefault();

            if (e.key === 'Backspace' || e.key === 'Delete') {
                // Remove last digit: shift right (divide by 10, drop remainder)
                const newCents = Math.floor(cents / 10);
                onValueChange(centsToRaw(newCents));
                return;
            }

            // Only accept digit keys
            if (/^\d$/.test(e.key)) {
                // Prevent unreasonably large numbers (max ~999,999,999.99)
                if (cents > 9999999999) return;
                // Append digit: shift left and add
                const newCents = cents * 10 + parseInt(e.key, 10);
                onValueChange(centsToRaw(newCents));
            }
        };

        const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
            e.preventDefault();
            const pasted = e.clipboardData.getData('text');
            // Strip non-numeric chars except dot
            const cleaned = pasted.replace(/[^0-9.]/g, '');
            const num = parseFloat(cleaned);
            if (!isNaN(num)) {
                onValueChange(num.toFixed(2));
            }
        };

        return (
            <input
                ref={ref}
                type="text"
                inputMode="numeric"
                data-slot="input"
                className={cn(
                    'border-input file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
                    'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
                    'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
                    className,
                )}
                value={displayValue}
                placeholder={placeholder ?? '0.00'}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                onChange={() => {}} // controlled — all input handled via onKeyDown
                {...props}
            />
        );
    },
);

CurrencyInput.displayName = 'CurrencyInput';

export { CurrencyInput };
