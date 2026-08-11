import { Followups } from '@/components/report-assistant/followups';
import { LiquiAvatar } from '@/components/report-assistant/liqui-avatar';
import { Sources } from '@/components/report-assistant/sources';
import {
    ToolResultDisplay,
    type ToolResult,
} from '@/components/report-assistant/tool-result-display';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head, Link } from '@inertiajs/react';
import axios from 'axios';
import {
    FileBarChart,
    Send,
    ShieldCheck,
    UserRound,
    X,
} from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';

interface Props {
    isConfigured: boolean;
}

interface Message {
    role: 'user' | 'assistant';
    content: string;
    data?: ToolResult[];
    followups?: string[];
    /**
     * When true, the assistant chose to hide the structured data card
     * (a "compact" answer — typically a short factual reply).
     */
    compact?: boolean;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Liqui', href: '/report-assistant' },
];

const initialMessage: Message = {
    role: 'assistant',
    content:
        'Ask for liquidation totals or breakdowns by program, academic year, region, HEI, document status, liquidation status, or RC note status.',
};

const examples = [
    'Summarize all liquidation records by program.',
    'Show liquidation totals by academic year.',
    'Which regions have the highest unliquidated amount?',
    'Give me a status breakdown for TES.',
];

// Bump the version when the Message shape changes so stale local data is dropped cleanly.
const STORAGE_KEY = 'report-assistant:conversation:v1';

function loadStoredConversation(): Message[] {
    if (typeof window === 'undefined') return [initialMessage];

    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return [initialMessage];

        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [initialMessage];

        const valid = parsed
            .filter(
                (m): m is Message =>
                    !!m &&
                    typeof m === 'object' &&
                    (m as Message).role !== undefined &&
                    ((m as Message).role === 'user' || (m as Message).role === 'assistant') &&
                    typeof (m as Message).content === 'string',
            )
            .map((m): Message => ({
                role: m.role,
                content: m.content,
                data: Array.isArray(m.data) ? (m.data as ToolResult[]) : undefined,
                followups: Array.isArray(m.followups)
                    ? (m.followups as unknown[]).filter(
                          (q): q is string => typeof q === 'string',
                      )
                    : undefined,
                compact: m.compact === true,
            }));

        return valid.length > 0 ? valid : [initialMessage];
    } catch {
        return [initialMessage];
    }
}

function persistConversation(messages: Message[]): void {
    if (typeof window === 'undefined') return;

    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
        // Quota exceeded or storage disabled — silently ignore; the in-memory
        // state continues to work for the lifetime of the tab.
    }
}

function clearStoredConversation(): void {
    if (typeof window === 'undefined') return;

    try {
        window.localStorage.removeItem(STORAGE_KEY);
    } catch {
        // ignore
    }
}

export default function ReportAssistant({ isConfigured }: Props) {
    const [messages, setMessages] = useState<Message[]>(loadStoredConversation);
    const [draft, setDraft] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isSending]);

    useEffect(() => {
        persistConversation(messages);
    }, [messages]);

    const ask = async (event?: FormEvent) => {
        event?.preventDefault();

        const content = draft.trim();
        if (!content || isSending || !isConfigured) return;

        const userMessage: Message = { role: 'user', content };
        const updatedMessages = [...messages, userMessage].slice(-12);

        setMessages(updatedMessages);
        setDraft('');
        setError(null);
        setIsSending(true);

        // The backend validator only accepts {role, content}; strip the local
        // `data` field (it's render-only, not part of the chat history Groq sees).
        const requestPayload = updatedMessages.map(({ role, content }) => ({
            role,
            content,
        }));

        try {
            const { data } = await axios.post<{
                answer: string;
                data?: ToolResult[];
                followups?: string[];
                compact?: boolean;
            }>('/report-assistant/messages', {
                messages: requestPayload,
            });

            setMessages((current) => [
                ...current,
                {
                    role: 'assistant',
                    content: data.answer,
                    data: data.data && data.data.length > 0 ? data.data : undefined,
                    followups:
                        data.followups && data.followups.length > 0
                            ? data.followups
                            : undefined,
                    compact: data.compact === true,
                },
            ]);
        } catch (requestError: unknown) {
            setError(
                axios.isAxiosError<{ message?: string }>(requestError)
                    ? (requestError.response?.data?.message ??
                          'The report assistant could not complete this request.')
                    : 'The report assistant could not complete this request.',
            );
        } finally {
            setIsSending(false);
        }
    };

    const startExample = (prompt: string) => {
        setDraft(prompt);
        setError(null);
    };

    const clearConversation = () => {
        clearStoredConversation();
        setMessages([initialMessage]);
        setDraft('');
        setError(null);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Liqui" />

            <div className="flex w-full flex-col gap-5 p-4 md:p-8">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                    <div>
                        <div className="flex items-center gap-2">
                            {/* 320px WebP (11 KB). The uploaded source is
                                3331x3610 / 1350 KB — far more than is shown. */}
                            <img
                                src="/assets/img/liqui-with-name.webp"
                                alt="Liqui"
                                className="h-9 w-auto object-contain"
                            />
                            <Badge variant="outline">Admin preview</Badge>
                        </div>
                        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                            Generate read-only liquidation summaries from system
                            data. Answers use bounded reporting queries and do
                            not modify records.
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" asChild>
                            <Link href="/report">
                                <FileBarChart className="mr-1.5 h-4 w-4" />
                                Export Report
                            </Link>
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearConversation}
                        >
                            <X className="mr-1.5 h-4 w-4" />
                            Clear
                        </Button>
                    </div>
                </div>

                {!isConfigured && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                        The assistant is not configured yet. Set{' '}
                        <code>OPENAI_API_KEY</code> on the server before sending
                        prompts.
                    </div>
                )}

                <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
                    <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                    Restricted to Admin and Super Admin accounts. Conversation
                    history is stored locally in your browser only — not on the
                    server. Prompts and bounded report results are sent to
                    OpenAI to generate insights.
                </div>

                <div className="min-h-[560px]">
                    <div className="flex min-h-[560px] flex-col overflow-hidden rounded-xl border bg-card">
                        <div className="flex-1 space-y-4 overflow-y-auto p-4 md:p-6">
                            {messages.map((message, index) => {
                                if (message.role === 'user') {
                                    return (
                                        <div
                                            key={`user-${index}`}
                                            className="flex justify-end gap-3"
                                        >
                                            <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-primary px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap text-primary-foreground">
                                                {message.content}
                                            </div>
                                            <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                                <UserRound className="h-4 w-4" />
                                            </div>
                                        </div>
                                    );
                                }

                                const hasData =
                                    !!message.data && message.data.length > 0;
                                const toolNames = hasData
                                    ? message.data!.map((d) => d.tool)
                                    : [];
                                // The model marked this turn as a short answer
                                // (e.g. a count question); suppress the
                                // structured table so the prose stands alone.
                                const showData =
                                    hasData && message.compact !== true;
                                const isLastAssistant =
                                    index === messages.length - 1 &&
                                    !isSending;
                                const showFollowups =
                                    isLastAssistant &&
                                    !!message.followups &&
                                    message.followups.length > 0;

                                return (
                                    <div
                                        key={`assistant-${index}`}
                                        className="flex gap-3"
                                    >
                                        <LiquiAvatar />
                                        <div className="flex min-w-0 flex-1 flex-col gap-3">
                                            {toolNames.length > 0 && (
                                                <Sources tools={toolNames} />
                                            )}
                                            <div
                                                className={cn(
                                                    'rounded-2xl rounded-tl-md bg-muted px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap',
                                                    showData
                                                        ? 'self-start max-w-full'
                                                        : 'self-start max-w-[85%]',
                                                )}
                                            >
                                                {message.content}
                                            </div>
                                            {showData && (
                                                <ToolResultDisplay
                                                    results={message.data!}
                                                />
                                            )}
                                            {showFollowups && (
                                                <Followups
                                                    items={message.followups!}
                                                    onSelect={startExample}
                                                    disabled={
                                                        !isConfigured ||
                                                        isSending
                                                    }
                                                />
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            {messages.length === 1 && !isSending && (
                                <div className="flex gap-3">
                                    <LiquiAvatar />
                                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                                        <Followups
                                            items={examples}
                                            onSelect={startExample}
                                            disabled={!isConfigured}
                                            label="Try asking..."
                                        />
                                    </div>
                                </div>
                            )}
                            {isSending && (
                                <div className="flex gap-3">
                                    <LiquiAvatar />
                                    <div className="flex min-w-0 flex-1 flex-col gap-3">
                                        <div className="flex flex-wrap gap-1.5">
                                            <Skeleton className="h-5 w-28 rounded-full" />
                                            <Skeleton className="h-5 w-40 rounded-full" />
                                            <Skeleton className="h-5 w-20 rounded-full" />
                                        </div>
                                        <div className="space-y-2 self-start rounded-2xl rounded-tl-md bg-muted p-4">
                                            <Skeleton className="h-3 w-72 max-w-full" />
                                            <Skeleton className="h-3 w-96 max-w-full" />
                                            <Skeleton className="h-3 w-56 max-w-full" />
                                        </div>
                                        <div className="overflow-hidden rounded-lg border bg-background">
                                            <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2">
                                                <Skeleton className="h-3 w-32" />
                                                <Skeleton className="h-4 w-24 rounded" />
                                            </div>
                                            <div className="space-y-3 p-3">
                                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                                    {Array.from({ length: 6 }).map(
                                                        (_, i) => (
                                                            <Skeleton
                                                                key={i}
                                                                className="h-14 rounded-md"
                                                            />
                                                        ),
                                                    )}
                                                </div>
                                                <Skeleton className="h-[200px] w-full" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div ref={bottomRef} />
                        </div>

                        <form onSubmit={ask} className="border-t p-4">
                            {error && (
                                <p className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                                    {error}
                                </p>
                            )}
                            <div className="flex items-end gap-2">
                                <Textarea
                                    value={draft}
                                    onChange={(event) =>
                                        setDraft(event.target.value)
                                    }
                                    placeholder="Ask for a liquidation summary..."
                                    disabled={!isConfigured || isSending}
                                    className="min-h-[72px] resize-none"
                                    maxLength={2000}
                                    onKeyDown={(event) => {
                                        if (
                                            event.key === 'Enter' &&
                                            !event.shiftKey
                                        ) {
                                            event.preventDefault();
                                            void ask();
                                        }
                                    }}
                                />
                                <Button
                                    type="submit"
                                    size="icon"
                                    disabled={
                                        !draft.trim() ||
                                        !isConfigured ||
                                        isSending
                                    }
                                    aria-label="Send prompt"
                                >
                                    <Send className="h-4 w-4" />
                                </Button>
                            </div>
                            <p className="mt-2 text-xs text-muted-foreground">
                                Enter to send. Shift+Enter for a new line.
                            </p>
                        </form>
                    </div>

                </div>
            </div>
        </AppLayout>
    );
}
