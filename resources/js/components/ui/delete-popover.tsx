import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Trash2 } from 'lucide-react';

interface DeletePopoverProps {
    itemName: string;
    onConfirm: () => void;
    triggerClassName?: string;
}

export function DeletePopover({ itemName, onConfirm, triggerClassName }: DeletePopoverProps) {
    const [open, setOpen] = useState(false);

    const handleConfirm = () => {
        onConfirm();
        setOpen(false);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className={triggerClassName || "h-8 w-8 text-muted-foreground hover:text-destructive"}
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
                <div className="space-y-3">
                    <div className="space-y-1">
                        <h4 className="font-semibold text-sm">Delete {itemName}?</h4>
                        <p className="text-sm text-muted-foreground">
                            This action cannot be undone.
                        </p>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleConfirm}
                        >
                            Delete
                        </Button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
