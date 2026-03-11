import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useInitials } from '@/hooks/use-initials';
import { cn } from '@/lib/utils';
import type { LiquidationComment, LiquidationCommentUser, CommentAttachment } from '@/types/liquidation';
import { getAvatarColor } from '@/types/liquidation';
import axios from 'axios';
import { toast } from 'sonner';
import { Send, Reply, AtSign, X, MessageSquare, Paperclip, FileText, Download, Image as ImageIcon } from 'lucide-react';

const MAX_DEPTH = 2;
const MENTION_REGEX = /@\[(.+?)\]\(([a-f0-9-]+)\)/g;
const URL_REGEX = /(https?:\/\/[^\s<>]+)/g;
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 3;
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'];

interface RequirementCommentThreadProps {
    liquidationId: number;
    documentRequirementId: string;
    initialCount: number;
    currentUserId: string;
    defaultExpanded?: boolean;
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageFile(name: string): boolean {
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(name);
}

function renderBody(body: string) {
    // First pass: split by mentions
    const mentionParts: (string | JSX.Element)[] = [];
    let lastIndex = 0;
    const mentionRegex = new RegExp(MENTION_REGEX.source, 'g');
    let match: RegExpExecArray | null;

    while ((match = mentionRegex.exec(body)) !== null) {
        if (match.index > lastIndex) mentionParts.push(body.slice(lastIndex, match.index));
        mentionParts.push(
            <span key={`m-${match.index}`} className="font-semibold text-blue-600 dark:text-blue-400">
                @{match[1]}
            </span>,
        );
        lastIndex = mentionRegex.lastIndex;
    }
    if (lastIndex < body.length) mentionParts.push(body.slice(lastIndex));

    // Second pass: split string parts by URLs
    const result: (string | JSX.Element)[] = [];
    let keyIdx = 0;

    for (const part of mentionParts) {
        if (typeof part !== 'string') {
            result.push(part);
            continue;
        }

        let urlLastIndex = 0;
        let urlMatch: RegExpExecArray | null;
        const urlRegex = new RegExp(URL_REGEX.source, 'g');

        while ((urlMatch = urlRegex.exec(part)) !== null) {
            if (urlMatch.index > urlLastIndex) result.push(part.slice(urlLastIndex, urlMatch.index));
            result.push(
                <a
                    key={`u-${keyIdx++}`}
                    href={urlMatch[1]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline break-all"
                    onClick={(e) => e.stopPropagation()}
                >
                    {urlMatch[1]}
                </a>,
            );
            urlLastIndex = urlRegex.lastIndex;
        }
        if (urlLastIndex < part.length) result.push(part.slice(urlLastIndex));
    }

    return result;
}

function addReply(comments: LiquidationComment[], parentId: string, reply: LiquidationComment): LiquidationComment[] {
    return comments.map((c) => {
        if (c.id === parentId) return { ...c, replies: [...c.replies, reply] };
        if (c.replies.length > 0) return { ...c, replies: addReply(c.replies, parentId, reply) };
        return c;
    });
}

function removeComment(comments: LiquidationComment[], id: string): LiquidationComment[] {
    return comments
        .filter((c) => c.id !== id)
        .map((c) => ({ ...c, replies: removeComment(c.replies, id) }));
}

const DEPTH_INDENT = ['', 'ml-6', 'ml-5'];

function CommentAttachment({ url, name, size }: { url: string; name: string; size: number }) {
    const isImage = isImageFile(name);

    return (
        <div className="mt-1.5 rounded border bg-background/50 overflow-hidden">
            {isImage ? (
                <a href={url} target="_blank" rel="noopener noreferrer" className="block">
                    <img src={url} alt={name} className="max-h-40 max-w-full object-contain" />
                </a>
            ) : (
                <a
                    href={url}
                    className="flex items-center gap-2 px-2.5 py-1.5 text-xs hover:bg-accent/50 transition-colors"
                    download
                >
                    <FileText className="h-3.5 w-3.5 text-red-500 shrink-0" />
                    <span className="truncate font-medium">{name}</span>
                    <span className="text-muted-foreground shrink-0">{formatFileSize(size)}</span>
                    <Download className="h-3 w-3 text-muted-foreground shrink-0 ml-auto" />
                </a>
            )}
        </div>
    );
}

function InlineComment({
    comment,
    currentUserId,
    liquidationId,
    onDelete,
    onReply,
    depth = 0,
}: {
    comment: LiquidationComment;
    currentUserId: string;
    liquidationId: number;
    onDelete: (id: string) => void;
    onReply: (id: string, name: string) => void;
    depth?: number;
}) {
    const getInitials = useInitials();
    const indent = DEPTH_INDENT[Math.min(depth, DEPTH_INDENT.length - 1)];

    return (
        <div className={cn('group/cmt flex gap-2', indent)}>
            <Avatar className="size-6 shrink-0 mt-0.5">
                <AvatarImage src={comment.user_avatar_url || undefined} alt={comment.user_name} />
                <AvatarFallback className={cn('text-[9px] font-medium', getAvatarColor(comment.user_name))}>
                    {getInitials(comment.user_name)}
                </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
                <div className="rounded-md bg-muted/40 px-2.5 py-1.5">
                    <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-semibold">{comment.user_name}</span>
                        {comment.user_role && (
                            <span className="text-[9px] rounded-full bg-primary/10 text-primary px-1.5 py-0.5">
                                {comment.user_role}
                            </span>
                        )}
                    </div>
                    {comment.body && (
                        <p className="mt-0.5 text-xs whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                            {renderBody(comment.body)}
                        </p>
                    )}
                    {comment.attachments?.length > 0 && (
                        <div className="mt-1 space-y-1">
                            {comment.attachments.map((att, i) => (
                                <CommentAttachment key={i} url={att.url} name={att.name} size={att.size} />
                            ))}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2.5 mt-0.5 px-0.5">
                    <span className="text-[9px] text-muted-foreground">{comment.time_ago}</span>
                    <button
                        type="button"
                        onClick={() => onReply(comment.id, comment.user_name)}
                        className="text-[9px] font-medium text-muted-foreground hover:text-primary transition-colors"
                    >
                        Reply
                    </button>
                    {comment.user_id === currentUserId && (
                        <button
                            type="button"
                            onClick={() => onDelete(comment.id)}
                            className="text-[9px] font-medium text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover/cmt:opacity-100"
                        >
                            Delete
                        </button>
                    )}
                </div>
                {comment.replies?.length > 0 && (
                    <div className="mt-1.5 space-y-1.5">
                        {comment.replies.map((r) => (
                            <InlineComment
                                key={r.id}
                                comment={r}
                                currentUserId={currentUserId}
                                liquidationId={liquidationId}
                                onDelete={onDelete}
                                onReply={onReply}
                                depth={depth + 1}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function RequirementCommentThread({
    liquidationId,
    documentRequirementId,
    initialCount,
    currentUserId,
    defaultExpanded = false,
}: RequirementCommentThreadProps) {
    const [expanded, setExpanded] = useState(false);
    const [comments, setComments] = useState<LiquidationComment[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [loading, setLoading] = useState(false);
    const [count, setCount] = useState(initialCount);

    const [body, setBody] = useState('');
    const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
    const [isPosting, setIsPosting] = useState(false);

    // File attachments state (max 3)
    const [attachments, setAttachments] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [mentionQuery, setMentionQuery] = useState<string | null>(null);
    const [mentionUsers, setMentionUsers] = useState<LiquidationCommentUser[]>([]);
    const [mentionIndex, setMentionIndex] = useState(0);
    const [mentionCursorStart, setMentionCursorStart] = useState(0);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const mentionCacheRef = useRef<LiquidationCommentUser[] | null>(null);
    const trackedMentionsRef = useRef<Map<string, string>>(new Map()); // name → id

    const loadComments = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await axios.get(
                `/liquidation/${liquidationId}/comments?document_requirement_id=${documentRequirementId}`,
            );
            setComments(data);
            setLoaded(true);
        } catch {
            toast.error('Failed to load comments');
        } finally {
            setLoading(false);
        }
    }, [liquidationId, documentRequirementId]);

    // Auto-expand when navigating from notification deep-link
    useEffect(() => {
        if (defaultExpanded) {
            if (!loaded) {
                loadComments().then(() => setExpanded(true));
            } else {
                setExpanded(true);
            }
        }
    }, [defaultExpanded]);

    const toggle = useCallback(async () => {
        if (!expanded && !loaded) {
            await loadComments();
        }
        setExpanded((v) => !v);
    }, [expanded, loaded, loadComments]);

    const fetchMentionUsers = useCallback(async () => {
        if (mentionCacheRef.current) return mentionCacheRef.current;
        try {
            const { data } = await axios.get(`/liquidation/${liquidationId}/mentionable-users`);
            mentionCacheRef.current = data;
            return data as LiquidationCommentUser[];
        } catch {
            return [];
        }
    }, [liquidationId]);

    const handleInputChange = useCallback(
        async (value: string) => {
            setBody(value);
            const textarea = textareaRef.current;
            if (!textarea) return;

            const cursor = textarea.selectionStart;
            const textBefore = value.slice(0, cursor);
            const atIndex = textBefore.lastIndexOf('@');

            if (atIndex === -1 || (atIndex > 0 && /\S/.test(textBefore[atIndex - 1]))) {
                setMentionQuery(null);
                return;
            }

            const query = textBefore.slice(atIndex + 1);
            if (query.includes(']') || query.includes('(')) {
                setMentionQuery(null);
                return;
            }

            setMentionCursorStart(atIndex);
            setMentionQuery(query);
            setMentionIndex(0);

            const users = await fetchMentionUsers();
            setMentionUsers(
                query ? users.filter((u: LiquidationCommentUser) => u.name.toLowerCase().includes(query.toLowerCase())) : users,
            );
        },
        [fetchMentionUsers],
    );

    const insertMention = useCallback(
        (user: LiquidationCommentUser) => {
            const before = body.slice(0, mentionCursorStart);
            const after = body.slice(textareaRef.current?.selectionStart ?? body.length);
            const display = `@${user.name} `;
            setBody(before + display + after);
            trackedMentionsRef.current.set(user.name, user.id);
            setMentionQuery(null);
            setMentionUsers([]);
            setTimeout(() => {
                const pos = before.length + display.length;
                textareaRef.current?.focus();
                textareaRef.current?.setSelectionRange(pos, pos);
            }, 0);
        },
        [body, mentionCursorStart],
    );

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (mentionQuery !== null && mentionUsers.length > 0) {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setMentionIndex((i) => Math.min(i + 1, mentionUsers.length - 1));
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setMentionIndex((i) => Math.max(i - 1, 0));
                } else if (e.key === 'Enter' || e.key === 'Tab') {
                    e.preventDefault();
                    insertMention(mentionUsers[mentionIndex]);
                } else if (e.key === 'Escape') {
                    setMentionQuery(null);
                }
                return;
            }
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                handleSubmit();
            }
        },
        [mentionQuery, mentionUsers, mentionIndex, insertMention],
    );

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? []);
        if (!files.length) return;

        for (const file of files) {
            if (!ALLOWED_TYPES.includes(file.type)) {
                toast.error(`"${file.name}" is not allowed. Only PDF and image files accepted.`);
                if (fileInputRef.current) fileInputRef.current.value = '';
                return;
            }
            if (file.size > MAX_ATTACHMENT_SIZE) {
                toast.error(`"${file.name}" exceeds the 10MB limit.`);
                if (fileInputRef.current) fileInputRef.current.value = '';
                return;
            }
        }

        setAttachments((prev) => {
            const combined = [...prev, ...files];
            if (combined.length > MAX_FILES) {
                toast.error(`Maximum ${MAX_FILES} files allowed.`);
                return prev;
            }
            return combined;
        });

        if (fileInputRef.current) fileInputRef.current.value = '';
    }, []);

    const removeAttachment = useCallback((index: number) => {
        setAttachments((prev) => prev.filter((_, i) => i !== index));
    }, []);

    const handleSubmit = useCallback(async () => {
        let trimmed = body.trim();
        if ((!trimmed && attachments.length === 0) || isPosting) return;

        // Convert display @Name to storage @[Name](id) format
        const mentionIds: string[] = [];
        for (const [name, id] of trackedMentionsRef.current) {
            if (trimmed.includes(`@${name}`)) {
                trimmed = trimmed.split(`@${name}`).join(`@[${name}](${id})`);
                mentionIds.push(id);
            }
        }

        setIsPosting(true);
        try {
            const formData = new FormData();
            formData.append('body', trimmed);
            if (replyTo?.id) formData.append('parent_id', replyTo.id);
            formData.append('document_requirement_id', documentRequirementId);
            mentionIds.forEach((id) => formData.append('mentions[]', id));
            attachments.forEach((file) => formData.append('attachments[]', file));

            const { data } = await axios.post(`/liquidation/${liquidationId}/comments`, formData);

            if (data.success) {
                const newComment: LiquidationComment = { ...data.comment, replies: data.comment.replies ?? [] };
                if (replyTo && newComment.parent_id) {
                    setComments((prev) => addReply(prev, newComment.parent_id!, newComment));
                } else {
                    setComments((prev) => [...prev, newComment]);
                }
                setCount((c) => c + 1);
                setBody('');
                setReplyTo(null);
                setAttachments([]);
                trackedMentionsRef.current.clear();
                toast.success('Comment posted');
            }
        } catch {
            toast.error('Failed to post comment');
        } finally {
            setIsPosting(false);
        }
    }, [body, attachments, isPosting, liquidationId, documentRequirementId, replyTo]);

    const handleDelete = useCallback(
        async (commentId: string) => {
            try {
                await axios.delete(`/liquidation/${liquidationId}/comments/${commentId}`);
                setComments((prev) => removeComment(prev, commentId));
                setCount((c) => Math.max(0, c - 1));
                toast.success('Comment deleted');
            } catch {
                toast.error('Failed to delete comment');
            }
        },
        [liquidationId],
    );

    const handleReply = useCallback((parentId: string, userName: string) => {
        setReplyTo({ id: parentId, name: userName });
        textareaRef.current?.focus();
    }, []);

    return (
        <div className="mt-2">
            {/* Toggle button */}
            <button
                type="button"
                onClick={toggle}
                className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-primary transition-colors"
            >
                <MessageSquare className="h-3.5 w-3.5" />
                {loading ? 'Loading...' : expanded ? 'Hide Comments' : count > 0 ? `Comments (${count})` : 'Add Comment'}
            </button>

            {/* Expanded comment thread */}
            {expanded && (
                <div className="mt-2 pl-1 border-l-2 border-muted ml-1">
                    <div className="pl-3 space-y-2">
                        {/* Comment list */}
                        {comments.length > 0 && (
                            <div className="space-y-2">
                                {comments.map((c) => (
                                    <InlineComment
                                        key={c.id}
                                        comment={c}
                                        currentUserId={currentUserId}
                                        liquidationId={liquidationId}
                                        onDelete={handleDelete}
                                        onReply={handleReply}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Reply indicator */}
                        {replyTo && (
                            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground bg-muted/30 rounded px-2 py-1">
                                <Reply className="h-3 w-3" />
                                <span>Replying to <span className="font-semibold">{replyTo.name}</span></span>
                                <button type="button" onClick={() => setReplyTo(null)} className="ml-auto hover:text-foreground">
                                    <X className="h-3 w-3" />
                                </button>
                            </div>
                        )}

                        {/* Attachment previews */}
                        {attachments.length > 0 && (
                            <div className="space-y-1">
                                {attachments.map((file, i) => (
                                    <div key={i} className="flex items-center gap-2 text-[10px] text-muted-foreground bg-blue-50 dark:bg-blue-950/20 rounded px-2 py-1.5 border border-blue-200 dark:border-blue-800/50">
                                        {isImageFile(file.name) ? (
                                            <ImageIcon className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                        ) : (
                                            <FileText className="h-3.5 w-3.5 text-red-500 shrink-0" />
                                        )}
                                        <span className="truncate font-medium">{file.name}</span>
                                        <span className="shrink-0">({formatFileSize(file.size)})</span>
                                        <button
                                            type="button"
                                            onClick={() => removeAttachment(i)}
                                            className="ml-auto hover:text-foreground"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Input */}
                        <div className="relative">
                            <Textarea
                                ref={textareaRef}
                                value={body}
                                onChange={(e) => handleInputChange(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Write a comment... (@ to mention)"
                                className="min-h-[52px] resize-none pr-16 text-xs"
                                disabled={isPosting}
                            />
                            <div className="absolute bottom-1.5 right-1.5 flex items-center gap-0.5">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
                                    className="hidden"
                                    onChange={handleFileSelect}
                                    multiple
                                />
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isPosting || attachments.length >= MAX_FILES}
                                    title={attachments.length >= MAX_FILES ? `Maximum ${MAX_FILES} files` : 'Attach file (max 3)'}
                                >
                                    <Paperclip className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6"
                                    onClick={handleSubmit}
                                    disabled={(!body.trim() && attachments.length === 0) || isPosting}
                                >
                                    <Send className="h-3.5 w-3.5" />
                                </Button>
                            </div>

                            {/* Mention dropdown */}
                            {mentionQuery !== null && mentionUsers.length > 0 && (
                                <div className="absolute bottom-full left-0 mb-1 w-56 max-h-40 overflow-y-auto rounded-md border bg-popover shadow-md z-50">
                                    {mentionUsers.map((user, idx) => (
                                        <button
                                            key={user.id}
                                            type="button"
                                            className={cn(
                                                'flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-accent transition-colors',
                                                idx === mentionIndex && 'bg-accent',
                                            )}
                                            onMouseDown={(e) => {
                                                e.preventDefault();
                                                insertMention(user);
                                            }}
                                        >
                                            <AtSign className="h-3 w-3 text-muted-foreground shrink-0" />
                                            <div className="min-w-0">
                                                <p className="font-medium truncate">{user.name}</p>
                                                {user.role && <p className="text-[9px] text-muted-foreground">{user.role}</p>}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
