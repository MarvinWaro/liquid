import { toast as sonnerToast, type ExternalToast } from 'sonner';

function formatTimestamp(): string {
    return new Date().toLocaleString('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });
}

function withTimestamp(options?: ExternalToast): ExternalToast {
    return {
        ...options,
        description: options?.description ?? formatTimestamp(),
    };
}

export const toast = Object.assign(
    (message: string | React.ReactNode, options?: ExternalToast) =>
        sonnerToast(message, withTimestamp(options)),
    {
        success: (message: string | React.ReactNode, options?: ExternalToast) =>
            sonnerToast.success(message, withTimestamp(options)),
        error: (message: string | React.ReactNode, options?: ExternalToast) =>
            sonnerToast.error(message, withTimestamp(options)),
        info: (message: string | React.ReactNode, options?: ExternalToast) =>
            sonnerToast.info(message, withTimestamp(options)),
        warning: (message: string | React.ReactNode, options?: ExternalToast) =>
            sonnerToast.warning(message, withTimestamp(options)),
        loading: (message: string | React.ReactNode, options?: ExternalToast) =>
            sonnerToast.loading(message, withTimestamp(options)),
        message: (message: string | React.ReactNode, options?: ExternalToast) =>
            sonnerToast.message(message, withTimestamp(options)),
        promise: sonnerToast.promise,
        dismiss: sonnerToast.dismiss,
        custom: sonnerToast.custom,
    }
);
