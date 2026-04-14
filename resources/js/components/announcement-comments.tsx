import React, { useCallback, useRef, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { AtSign, Heart, MessageSquare, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useInitials } from '@/hooks/use-initials';
import { getAvatarColor } from '@/types/liquidation';
import { cn } from '@/lib/utils';

const MAX_DEPTH = 2;
const MENTION_REGEX = /@\[(.+?)\]\(([a-f0-9-]+)\)/g;

export interface AnnouncementCommentUser {
    id: string;
    name: string;
    role?: string | null;
}

export interface AnnouncementComment {
    id: string;
    parent_id: string | null;
    user_id: string;
    user_name: string | null;
    user_avatar_url: string | null;
    user_role: string | null;
    is_deleted: boolean;
    body: string | null;
    mentions: string[] | null;
    created_at: string;
    time_ago: string;
    reactions_count: number;
    has_reacted: boolean;
    replies: AnnouncementComment[];
}

interface Props {
    slug: string;
    initialComments: AnnouncementComment[];
    initialHasMore: boolean;
    initialTotal: number;
    currentUserId: string;
    canModerate: boolean;
}

/* ─── Helpers ─── */

function renderBody(body: string) {
    const parts: (string | React.ReactElement)[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    const regex = new RegExp(MENTION_REGEX.source, 'g');
    while ((match = regex.exec(body)) !== null) {
        if (match.index > lastIndex) parts.push(body.slice(lastIndex, match.index));
        parts.push(
            <span key={`${match.index}-${match[2]}`} className="font-semibold text-blue-600 dark:text-blue-400">
                @{match[1]}
            </span>,
        );
        lastIndex = regex.lastIndex;
    }
    if (lastIndex < body.length) parts.push(body.slice(lastIndex));
    return parts;
}

function countAllReplies(comment: AnnouncementComment): number {
    let count = comment.replies.length;
    for (const r of comment.replies) count += countAllReplies(r);
    return count;
}

function addReplyToTree(tree: AnnouncementComment[], parentId: string, reply: AnnouncementComment): AnnouncementComment[] {
    return tree.map((c) => {
        if (c.id === parentId) return { ...c, replies: [...c.replies, reply] };
        if (c.replies.length) return { ...c, replies: addReplyToTree(c.replies, parentId, reply) };
        return c;
    });
}

function removeFromTree(tree: AnnouncementComment[], id: string): AnnouncementComment[] {
    return tree.filter((c) => c.id !== id).map((c) => ({ ...c, replies: removeFromTree(c.replies, id) }));
}

function updateReactionInTree(tree: AnnouncementComment[], commentId: string, hasReacted: boolean, count: number): AnnouncementComment[] {
    return tree.map((c) => {
        if (c.id === commentId) return { ...c, has_reacted: hasReacted, reactions_count: count };
        if (c.replies.length) return { ...c, replies: updateReactionInTree(c.replies, commentId, hasReacted, count) };
        return c;
    });
}

/* ─── Inline composer (used in replies + main field) ─── */

interface ComposerProps {
    slug: string;
    parentId: string | null;
    placeholder?: string;
    autoFocus?: boolean;
    onPosted: (comment: AnnouncementComment) => void;
    onCancel?: () => void;
    compact?: boolean;
}

function CommentComposer({ slug, parentId, placeholder, autoFocus, onPosted, onCancel, compact }: ComposerProps) {
    const [body, setBody] = useState('');
    const [posting, setPosting] = useState(false);
    const [mentionQuery, setMentionQuery] = useState<string | null>(null);
    const [mentionUsers, setMentionUsers] = useState<AnnouncementCommentUser[]>([]);
    const [mentionIndex, setMentionIndex] = useState(0);
    const [mentionCursorStart, setMentionCursorStart] = useState(0);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const mentionCacheRef = useRef<AnnouncementCommentUser[] | null>(null);
    const mentionRegistryRef = useRef<Map<string, string>>(new Map());

    const fetchMentionUsers = useCallback(async () => {
        if (mentionCacheRef.current) return mentionCacheRef.current;
        try {
            const { data } = await axios.get(`/announcement/${slug}/mentionable-users`);
            mentionCacheRef.current = data;
            return data as AnnouncementCommentUser[];
        } catch {
            return [];
        }
    }, [slug]);

    const handleInputChange = useCallback(
        async (value: string) => {
            setBody(value);
            const textarea = textareaRef.current;
            if (!textarea) return;
            const cursor = textarea.selectionStart;
            const before = value.slice(0, cursor);
            const atIndex = before.lastIndexOf('@');
            if (atIndex === -1 || (atIndex > 0 && /\S/.test(before[atIndex - 1]))) {
                setMentionQuery(null);
                return;
            }
            const query = before.slice(atIndex + 1);
            if (query.length > 40) { setMentionQuery(null); return; }
            setMentionCursorStart(atIndex);
            setMentionQuery(query);
            setMentionIndex(0);
            const users = await fetchMentionUsers();
            const filtered = query
                ? users.filter((u) => u.name.toLowerCase().includes(query.toLowerCase()))
                : users;
            setMentionUsers(filtered.slice(0, 8));
        },
        [fetchMentionUsers],
    );

    const insertMention = useCallback(
        (user: AnnouncementCommentUser) => {
            const before = body.slice(0, mentionCursorStart);
            const after = body.slice(textareaRef.current?.selectionStart ?? body.length);
            const displayMention = `@${user.name} `;
            mentionRegistryRef.current.set(user.name, user.id);
            const next = before + displayMention + after;
            setBody(next);
            setMentionQuery(null);
            setMentionUsers([]);
            setTimeout(() => {
                const pos = before.length + displayMention.length;
                textareaRef.current?.focus();
                textareaRef.current?.setSelectionRange(pos, pos);
            }, 0);
        },
        [body, mentionCursorStart],
    );

    const toStorageFormat = (text: string): string => {
        let result = text;
        const entries = [...mentionRegistryRef.current.entries()].sort((a, b) => b[0].length - a[0].length);
        for (const [name, userId] of entries) {
            result = result.replaceAll(`@${name}`, `@[${name}](${userId})`);
        }
        return result;
    };

    const extractMentionIds = (storageText: string): string[] => {
        const ids: string[] = [];
        const regex = new RegExp(MENTION_REGEX.source, 'g');
        let m: RegExpExecArray | null;
        while ((m = regex.exec(storageText)) !== null) ids.push(m[2]);
        return Array.from(new Set(ids));
    };

    const handleSubmit = useCallback(async () => {
        const trimmed = body.trim();
        if (!trimmed || posting) return;
        setPosting(true);
        try {
            const storageBody = toStorageFormat(trimmed);
            const { data } = await axios.post(`/announcement/${slug}/comments`, {
                body: storageBody,
                parent_id: parentId,
                mentions: extractMentionIds(storageBody),
            });
            if (data.success) {
                const fresh: AnnouncementComment = { ...data.comment, replies: data.comment.replies ?? [] };
                setBody('');
                mentionRegistryRef.current.clear();
                onPosted(fresh);
            }
        } catch {
            toast.error('Failed to post comment');
        } finally {
            setPosting(false);
        }
    }, [body, posting, slug, parentId, onPosted]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (mentionQuery !== null && mentionUsers.length > 0) {
                if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex((i) => Math.min(i + 1, mentionUsers.length - 1)); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex((i) => Math.max(i - 1, 0)); }
                else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertMention(mentionUsers[mentionIndex]); }
                else if (e.key === 'Escape') { setMentionQuery(null); }
                return;
            }
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
            if (e.key === 'Escape' && onCancel) { onCancel(); }
        },
        [mentionQuery, mentionUsers, mentionIndex, insertMention, handleSubmit, onCancel],
    );

    return (
        <div className="relative">
            <div className="flex items-start gap-2">
                <div className="flex-1 relative">
                    <Textarea
                        ref={textareaRef}
                        value={body}
                        onChange={(e) => handleInputChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholder ?? 'Write a comment… use @ to mention someone'}
                        className={cn(
                            'resize-none pr-10 text-sm',
                            compact ? 'min-h-[40px] py-2' : 'min-h-[80px]',
                        )}
                        disabled={posting}
                        maxLength={2000}
                        autoFocus={autoFocus}
                    />
                    <Button
                        size="icon"
                        variant="ghost"
                        className="absolute bottom-1.5 right-1.5 h-7 w-7"
                        onClick={handleSubmit}
                        disabled={!body.trim() || posting}
                        title="Send (Enter)"
                    >
                        <Send className="h-3.5 w-3.5" />
                    </Button>

                    {mentionQuery !== null && mentionUsers.length > 0 && (
                        <div className="absolute bottom-full left-0 mb-1 w-64 max-h-56 overflow-y-auto rounded-md border bg-popover shadow-md z-50">
                            {mentionUsers.map((u, idx) => (
                                <button
                                    key={u.id}
                                    type="button"
                                    className={cn(
                                        'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent transition-colors',
                                        idx === mentionIndex && 'bg-accent',
                                    )}
                                    onMouseDown={(e) => { e.preventDefault(); insertMention(u); }}
                                >
                                    <AtSign className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    <div className="min-w-0">
                                        <p className="font-medium truncate">{u.name}</p>
                                        {u.role && <p className="text-[10px] text-muted-foreground">{u.role}</p>}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                {onCancel && (
                    <button type="button" onClick={onCancel} className="mt-2 text-muted-foreground hover:text-foreground">
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>
        </div>
    );
}

/* ─── Comment item (with collapsible replies, heart reaction + thread lines) ─── */

function CommentItem({
    comment,
    slug,
    currentUserId,
    canModerate,
    depth = 0,
    onDelete,
    onNewReply,
    onReaction,
    isLast,
}: {
    comment: AnnouncementComment;
    slug: string;
    currentUserId: string;
    canModerate: boolean;
    depth?: number;
    onDelete: (id: string) => void;
    onNewReply: (parentId: string, reply: AnnouncementComment) => void;
    onReaction: (commentId: string, hasReacted: boolean, count: number) => void;
    isLast?: boolean;
}) {
    const getInitials = useInitials();
    const canDelete = comment.user_id === currentUserId || canModerate;
    const [showReplyInput, setShowReplyInput] = useState(false);
    const [repliesExpanded, setRepliesExpanded] = useState(false);
    const [reacting, setReacting] = useState(false);
    const hasReplies = comment.replies.length > 0;
    const totalReplies = hasReplies ? countAllReplies(comment) : 0;

    const handleReplyPosted = (reply: AnnouncementComment) => {
        onNewReply(comment.id, reply);
        setShowReplyInput(false);
        setRepliesExpanded(true); // auto-expand after posting a reply
    };

    const handleToggleReaction = async () => {
        if (reacting) return;
        setReacting(true);
        try {
            const { data } = await axios.post(`/announcement/${slug}/comments/${comment.id}/react`);
            if (data.success) {
                onReaction(comment.id, data.has_reacted, data.reactions_count);
            }
        } catch {
            toast.error('Failed to react');
        } finally {
            setReacting(false);
        }
    };

    // Whether the vertical line from this comment's level should extend downward
    const showVerticalLine = (hasReplies && repliesExpanded) || showReplyInput;

    return (
        <div className={cn('relative', depth > 0 && 'ml-10')}>
            {/* Thread connector lines for nested comments */}
            {depth > 0 && (
                <>
                    {/* Curved elbow: from parent's vertical line, curves right into this comment's avatar */}
                    <div
                        className="absolute border-l-2 border-b-2 border-border rounded-bl-xl pointer-events-none"
                        style={{ left: -24, top: 0, width: 24, height: 20 }}
                    />
                    {/* Vertical continuation line for non-last siblings (extends full height for siblings below) */}
                    {!isLast && (
                        <div
                            className="absolute border-l-2 border-border pointer-events-none"
                            style={{ left: -24, top: 0, bottom: 0 }}
                        />
                    )}
                </>
            )}

            {/* Vertical line from this comment's avatar down through all its children.
                Placed on the outer wrapper so it spans replies + inline composer. */}
            {showVerticalLine && (
                <div
                    className="absolute border-l-2 border-border pointer-events-none"
                    style={{ left: 16, top: 36, bottom: 28 }}
                />
            )}

            <div className="group/comment flex gap-2 relative">
                {/* Avatar */}
                <div className="relative flex flex-col items-center" style={{ width: 32 }}>
                    <Avatar className="size-8 shrink-0">
                        {comment.user_avatar_url && <AvatarImage src={comment.user_avatar_url} alt={comment.user_name} />}
                        <AvatarFallback className={cn('text-[11px] font-medium', getAvatarColor(comment.user_name))}>
                            {getInitials(comment.user_name)}
                        </AvatarFallback>
                    </Avatar>
                </div>

                <div className="min-w-0 flex-1 pb-2">
                    <div className={cn('rounded-lg px-3 py-2', comment.is_deleted ? 'bg-muted/30' : 'bg-muted/50')}>
                        {comment.is_deleted ? (
                            <p className="text-xs text-muted-foreground/60 italic">[comment deleted]</p>
                        ) : (
                            <>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-semibold">{comment.user_name}</span>
                                    {comment.user_role && (
                                        <span className="text-[10px] rounded-full bg-primary/10 text-primary px-1.5 py-0.5">
                                            {comment.user_role}
                                        </span>
                                    )}
                                </div>
                                <p className="mt-1 text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                                    {renderBody(comment.body ?? '')}
                                </p>
                            </>
                        )}
                    </div>

                    {/* Reaction badge — hidden for deleted comments */}
                    {!comment.is_deleted && comment.reactions_count > 0 && (
                        <div className="flex justify-end -mt-2.5 mr-2 relative z-10">
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-background border shadow-sm px-1.5 py-0.5 text-[10px]">
                                <Heart className="h-2.5 w-2.5 fill-red-500 text-red-500" />
                                {comment.reactions_count}
                            </span>
                        </div>
                    )}

                    {/* Action row — hidden for deleted comments */}
                    {!comment.is_deleted && (
                        <div className={cn('flex items-center gap-3 px-1', comment.reactions_count > 0 ? 'mt-0.5' : 'mt-1')}>
                            <span className="text-[10px] text-muted-foreground">{comment.time_ago}</span>
                            <button
                                type="button"
                                onClick={handleToggleReaction}
                                disabled={reacting}
                                className={cn(
                                    'text-[10px] font-medium transition-colors',
                                    comment.has_reacted
                                        ? 'text-red-500 hover:text-red-600'
                                        : 'text-muted-foreground hover:text-red-500',
                                )}
                            >
                                {comment.has_reacted ? 'Liked' : 'Like'}
                            </button>
                            {depth < MAX_DEPTH && (
                                <button
                                    type="button"
                                    onClick={() => setShowReplyInput(true)}
                                    className="text-[10px] font-medium text-muted-foreground hover:text-primary transition-colors"
                                >
                                    Reply
                                </button>
                            )}
                            {canDelete && (
                                <button
                                    type="button"
                                    onClick={() => onDelete(comment.id)}
                                    className="text-[10px] font-medium text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover/comment:opacity-100"
                                >
                                    Delete
                                </button>
                            )}
                        </div>
                    )}

                    {/* "View N replies" toggle — only at depth 0 for top-level comments */}
                    {hasReplies && !repliesExpanded && (
                        <button
                            type="button"
                            onClick={() => setRepliesExpanded(true)}
                            className="flex items-center gap-1.5 text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors mt-1 px-1"
                        >
                            <span className="inline-block w-5 h-px bg-primary/40" />
                            View {totalReplies} {totalReplies === 1 ? 'reply' : 'replies'}
                        </button>
                    )}
                </div>
            </div>

            {/* Nested replies — shown only when expanded */}
            {hasReplies && repliesExpanded && (
                <div className="space-y-0">
                    {comment.replies.map((reply, i) => (
                        <CommentItem
                            key={reply.id}
                            comment={reply}
                            slug={slug}
                            currentUserId={currentUserId}
                            canModerate={canModerate}
                            depth={depth + 1}
                            onDelete={onDelete}
                            onNewReply={onNewReply}
                            onReaction={onReaction}
                            isLast={i === comment.replies.length - 1 && !showReplyInput}
                        />
                    ))}

                    {/* Collapse button */}
                    <button
                        type="button"
                        onClick={() => setRepliesExpanded(false)}
                        className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground hover:text-primary transition-colors ml-10 mt-1 px-1"
                    >
                        <span className="inline-block w-5 h-px bg-muted-foreground/40" />
                        Hide replies
                    </button>
                </div>
            )}

            {/* Inline reply composer — never shown for deleted comments */}
            {!comment.is_deleted && showReplyInput && (
                <div className={cn('relative', 'ml-10 mb-2')}>
                    {/* Curved connector for inline reply */}
                    <div
                        className="absolute border-l-2 border-b-2 border-border rounded-bl-xl pointer-events-none"
                        style={{ left: -24, top: 0, width: 24, height: 20 }}
                    />
                    <CommentComposer
                        slug={slug}
                        parentId={comment.id}
                        placeholder={`Reply to ${comment.user_name}…`}
                        autoFocus
                        compact
                        onPosted={handleReplyPosted}
                        onCancel={() => setShowReplyInput(false)}
                    />
                </div>
            )}
        </div>
    );
}

/* ─── Main section ─── */

export default function AnnouncementComments({ slug, initialComments, initialHasMore, initialTotal, currentUserId, canModerate }: Props) {
    const [comments, setComments] = useState<AnnouncementComment[]>(initialComments);
    const [hasMore, setHasMore] = useState(initialHasMore);
    const [page, setPage] = useState(1);
    const [loadingMore, setLoadingMore] = useState(false);
    const [totalCount, setTotalCount] = useState(initialTotal);

    const loadMore = useCallback(async () => {
        if (loadingMore || !hasMore) return;
        setLoadingMore(true);
        try {
            const nextPage = page + 1;
            const { data } = await axios.get(`/announcement/${slug}/comments`, { params: { page: nextPage } });
            setComments((prev) => [...prev, ...data.data]);
            setHasMore(data.has_more);
            setPage(nextPage);
            setTotalCount(data.total);
        } catch {
            toast.error('Failed to load comments');
        } finally {
            setLoadingMore(false);
        }
    }, [loadingMore, hasMore, page, slug]);

    const handleDelete = useCallback(
        async (commentId: string) => {
            try {
                await axios.delete(`/announcement/${slug}/comments/${commentId}`);
                setComments((prev) => removeFromTree(prev, commentId));
                setTotalCount((n) => Math.max(0, n - 1));
            } catch {
                toast.error('Failed to delete comment');
            }
        },
        [slug],
    );

    const handleNewReply = useCallback((parentId: string, reply: AnnouncementComment) => {
        setComments((prev) => addReplyToTree(prev, parentId, reply));
        setTotalCount((n) => n + 1);
    }, []);

    const handleReaction = useCallback((commentId: string, hasReacted: boolean, count: number) => {
        setComments((prev) => updateReactionInTree(prev, commentId, hasReacted, count));
    }, []);

    const handleTopLevelPosted = useCallback((comment: AnnouncementComment) => {
        setComments((prev) => [...prev, comment]);
        setTotalCount((n) => n + 1);
    }, []);

    return (
        <section className="mt-8 pt-8 border-t" id="discussion">
            <h2 className="flex items-center gap-2 text-base font-semibold mb-4">
                <MessageSquare className="h-4 w-4" />
                Discussion
                {totalCount > 0 && <span className="text-xs font-normal text-muted-foreground">({totalCount})</span>}
            </h2>

            {comments.length > 0 ? (
                <div className="space-y-1 mb-6">
                    {comments.map((c, i) => (
                        <CommentItem
                            key={c.id}
                            comment={c}
                            slug={slug}
                            currentUserId={currentUserId}
                            canModerate={canModerate}
                            onDelete={handleDelete}
                            onNewReply={handleNewReply}
                            onReaction={handleReaction}
                            isLast={i === comments.length - 1}
                        />
                    ))}

                    {loadingMore && (
                        <div className="space-y-3 animate-pulse pt-2">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="flex gap-2">
                                    <div className="size-8 rounded-full bg-muted shrink-0" />
                                    <div className="flex-1 space-y-2">
                                        <div className="h-14 rounded-lg bg-muted" />
                                        <div className="h-3 w-20 rounded bg-muted" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {hasMore && !loadingMore && (
                        <button
                            type="button"
                            onClick={loadMore}
                            className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors mx-auto pt-2"
                        >
                            Load more comments
                        </button>
                    )}
                </div>
            ) : (
                <p className="text-sm text-muted-foreground mb-6">No comments yet. Start the discussion.</p>
            )}

            {/* Main composer for top-level comments */}
            <CommentComposer
                slug={slug}
                parentId={null}
                onPosted={handleTopLevelPosted}
            />
            <p className="mt-1.5 text-[10px] text-muted-foreground">
                Press <kbd className="px-1 py-0.5 rounded bg-muted text-[9px] font-mono">Enter</kbd> to send ·{' '}
                <kbd className="px-1 py-0.5 rounded bg-muted text-[9px] font-mono">Shift+Enter</kbd> for new line ·{' '}
                type <kbd className="px-1 py-0.5 rounded bg-muted text-[9px] font-mono">@</kbd> to mention someone
            </p>
        </section>
    );
}
