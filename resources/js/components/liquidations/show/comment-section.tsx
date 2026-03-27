import React, { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useInitials } from '@/hooks/use-initials';
import { cn } from '@/lib/utils';
import type { LiquidationComment, LiquidationCommentUser } from '@/types/liquidation';
import { getAvatarColor } from '@/types/liquidation';
import axios from 'axios';
import { toast } from '@/lib/toast';
import {
    MessageSquare,
    Reply,
    Send,
    AtSign,
    X,
} from 'lucide-react';

const MAX_DEPTH = 2; // 3 levels: 0, 1, 2

interface CommentSectionProps {
    liquidationId: number;
    initialComments: LiquidationComment[];
    currentUserId: string;
    currentUserName: string;
}

// Regex to parse @[Name](userId) in comment body
const MENTION_REGEX = /@\[(.+?)\]\(([a-f0-9-]+)\)/g;

function renderCommentBody(body: string) {
    const parts: (string | React.ReactElement)[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    const regex = new RegExp(MENTION_REGEX.source, 'g');

    while ((match = regex.exec(body)) !== null) {
        if (match.index > lastIndex) {
            parts.push(body.slice(lastIndex, match.index));
        }
        parts.push(
            <span
                key={match.index}
                className="font-semibold text-blue-600 dark:text-blue-400"
            >
                @{match[1]}
            </span>,
        );
        lastIndex = regex.lastIndex;
    }

    if (lastIndex < body.length) {
        parts.push(body.slice(lastIndex));
    }

    return parts;
}

// Recursive tree helpers
function addReplyToTree(
    comments: LiquidationComment[],
    parentId: string,
    reply: LiquidationComment,
): LiquidationComment[] {
    return comments.map((c) => {
        if (c.id === parentId) {
            return { ...c, replies: [...c.replies, reply] };
        }
        if (c.replies.length > 0) {
            return { ...c, replies: addReplyToTree(c.replies, parentId, reply) };
        }
        return c;
    });
}

function removeFromTree(
    comments: LiquidationComment[],
    commentId: string,
): LiquidationComment[] {
    return comments
        .filter((c) => c.id !== commentId)
        .map((c) => ({
            ...c,
            replies: removeFromTree(c.replies, commentId),
        }));
}

const DEPTH_INDENT = ['', 'ml-8', 'ml-6'];

function CommentItem({
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
    onDelete: (commentId: string) => void;
    onReply: (parentId: string, userName: string) => void;
    depth?: number;
}) {
    const getInitials = useInitials();
    const canDelete = comment.user_id === currentUserId;
    const indent = DEPTH_INDENT[Math.min(depth, DEPTH_INDENT.length - 1)];

    return (
        <div className={cn('group/comment flex gap-2', indent)}>
            <Avatar className="size-7 shrink-0 mt-0.5">
                <AvatarFallback
                    className={cn('text-[10px] font-medium', getAvatarColor(comment.user_name))}
                >
                    {getInitials(comment.user_name)}
                </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1">
                <div className="rounded-lg bg-muted/50 px-3 py-2">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold">{comment.user_name}</span>
                        {comment.user_role && (
                            <span className="text-[10px] rounded-full bg-primary/10 text-primary px-1.5 py-0.5">
                                {comment.user_role}
                            </span>
                        )}
                    </div>
                    <p className="mt-1 text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                        {renderCommentBody(comment.body)}
                    </p>
                </div>

                <div className="flex items-center gap-3 mt-1 px-1">
                    <span className="text-[10px] text-muted-foreground">
                        {comment.time_ago}
                    </span>
                    <button
                        type="button"
                        onClick={() => onReply(comment.id, comment.user_name)}
                        className="text-[10px] font-medium text-muted-foreground hover:text-primary transition-colors"
                    >
                        Reply
                    </button>
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

                {/* Nested replies */}
                {comment.replies?.length > 0 && (
                    <div className="mt-2 space-y-2">
                        {comment.replies.map((reply) => (
                            <CommentItem
                                key={reply.id}
                                comment={reply}
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

export default function CommentSection({
    liquidationId,
    initialComments,
    currentUserId,
    currentUserName,
}: CommentSectionProps) {
    const [comments, setComments] = useState<LiquidationComment[]>(initialComments);
    const [body, setBody] = useState('');
    const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
    const [isPosting, setIsPosting] = useState(false);
    const [mentionQuery, setMentionQuery] = useState<string | null>(null);
    const [mentionUsers, setMentionUsers] = useState<LiquidationCommentUser[]>([]);
    const [mentionIndex, setMentionIndex] = useState(0);
    const [mentionCursorStart, setMentionCursorStart] = useState(0);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const mentionCacheRef = useRef<LiquidationCommentUser[] | null>(null);

    // Fetch mentionable users (cached after first load)
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

    // Handle @mention detection on input change
    const handleInputChange = useCallback(
        async (value: string) => {
            setBody(value);

            const textarea = textareaRef.current;
            if (!textarea) return;

            const cursor = textarea.selectionStart;
            const textBefore = value.slice(0, cursor);

            // Find the last unmatched @ symbol
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
            const filtered = query
                ? users.filter((u: LiquidationCommentUser) =>
                      u.name.toLowerCase().includes(query.toLowerCase()),
                  )
                : users;
            setMentionUsers(filtered);
        },
        [fetchMentionUsers],
    );

    // Insert mention into body
    const insertMention = useCallback(
        (user: LiquidationCommentUser) => {
            const before = body.slice(0, mentionCursorStart);
            const after = body.slice(textareaRef.current?.selectionStart ?? body.length);
            const mention = `@[${user.name}](${user.id}) `;
            const newBody = before + mention + after;
            setBody(newBody);
            setMentionQuery(null);
            setMentionUsers([]);

            setTimeout(() => {
                const pos = before.length + mention.length;
                textareaRef.current?.focus();
                textareaRef.current?.setSelectionRange(pos, pos);
            }, 0);
        },
        [body, mentionCursorStart],
    );

    // Keyboard navigation for mention dropdown
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

            // Ctrl+Enter to submit
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                handleSubmit();
            }
        },
        [mentionQuery, mentionUsers, mentionIndex, insertMention],
    );

    // Extract mention IDs from body
    const extractMentionIds = (text: string): string[] => {
        const ids: string[] = [];
        const regex = new RegExp(MENTION_REGEX.source, 'g');
        let m: RegExpExecArray | null;
        while ((m = regex.exec(text)) !== null) {
            ids.push(m[2]);
        }
        return ids;
    };

    // Submit comment
    const handleSubmit = useCallback(async () => {
        const trimmed = body.trim();
        if (!trimmed || isPosting) return;

        setIsPosting(true);
        try {
            const { data } = await axios.post(`/liquidation/${liquidationId}/comments`, {
                body: trimmed,
                parent_id: replyTo?.id ?? null,
                mentions: extractMentionIds(trimmed),
            });

            if (data.success) {
                const newComment: LiquidationComment = {
                    ...data.comment,
                    replies: data.comment.replies ?? [],
                };

                if (replyTo) {
                    // Use the actual parent_id from backend (may differ due to depth flattening)
                    const actualParentId = newComment.parent_id;
                    if (actualParentId) {
                        setComments((prev) => addReplyToTree(prev, actualParentId, newComment));
                    } else {
                        setComments((prev) => [...prev, newComment]);
                    }
                } else {
                    setComments((prev) => [...prev, newComment]);
                }

                setBody('');
                setReplyTo(null);
                toast.success('Comment posted');
            }
        } catch {
            toast.error('Failed to post comment');
        } finally {
            setIsPosting(false);
        }
    }, [body, isPosting, liquidationId, replyTo]);

    // Delete comment (recursive tree removal)
    const handleDelete = useCallback(
        async (commentId: string) => {
            try {
                await axios.delete(`/liquidation/${liquidationId}/comments/${commentId}`);
                setComments((prev) => removeFromTree(prev, commentId));
                toast.success('Comment deleted');
            } catch {
                toast.error('Failed to delete comment');
            }
        },
        [liquidationId],
    );

    // Handle reply click
    const handleReply = useCallback((parentId: string, userName: string) => {
        setReplyTo({ id: parentId, name: userName });
        textareaRef.current?.focus();
    }, []);

    // Cancel reply
    const cancelReply = useCallback(() => {
        setReplyTo(null);
    }, []);

    return (
        <Card className="mt-3" id="comments">
            <CardHeader className="pb-2 pt-3">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <MessageSquare className="h-4 w-4" />
                    Comments
                    {comments.length > 0 && (
                        <span className="text-xs font-normal text-muted-foreground">
                            ({comments.length})
                        </span>
                    )}
                </CardTitle>
            </CardHeader>

            <CardContent className="pt-0">
                {/* Comment list */}
                {comments.length > 0 ? (
                    <ScrollArea className={comments.length > 5 ? 'max-h-[400px]' : ''}>
                        <div className="space-y-3 mb-4">
                            {comments.map((comment) => (
                                <CommentItem
                                    key={comment.id}
                                    comment={comment}
                                    currentUserId={currentUserId}
                                    liquidationId={liquidationId}
                                    onDelete={handleDelete}
                                    onReply={handleReply}
                                    depth={0}
                                />
                            ))}
                        </div>
                    </ScrollArea>
                ) : (
                    <p className="text-xs text-muted-foreground mb-4">
                        No comments yet. Start a conversation.
                    </p>
                )}

                {/* Reply indicator */}
                {replyTo && (
                    <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground bg-muted/30 rounded px-2.5 py-1.5">
                        <Reply className="h-3 w-3" />
                        <span>
                            Replying to <span className="font-semibold">{replyTo.name}</span>
                        </span>
                        <button
                            type="button"
                            onClick={cancelReply}
                            className="ml-auto hover:text-foreground transition-colors"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </div>
                )}

                {/* Comment input */}
                <div className="relative">
                    <Textarea
                        ref={textareaRef}
                        value={body}
                        onChange={(e) => handleInputChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Write a comment... (use @ to mention someone)"
                        className="min-h-[72px] resize-none pr-12 text-sm"
                        disabled={isPosting}
                    />

                    {/* Send button */}
                    <Button
                        size="icon"
                        variant="ghost"
                        className="absolute bottom-2 right-2 h-7 w-7"
                        onClick={handleSubmit}
                        disabled={!body.trim() || isPosting}
                    >
                        <Send className="h-4 w-4" />
                    </Button>

                    {/* Mention dropdown */}
                    {mentionQuery !== null && mentionUsers.length > 0 && (
                        <div className="absolute bottom-full left-0 mb-1 w-64 max-h-48 overflow-y-auto rounded-md border bg-popover shadow-md z-50">
                            {mentionUsers.map((user, idx) => (
                                <button
                                    key={user.id}
                                    type="button"
                                    className={cn(
                                        'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent transition-colors',
                                        idx === mentionIndex && 'bg-accent',
                                    )}
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        insertMention(user);
                                    }}
                                >
                                    <AtSign className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    <div className="min-w-0">
                                        <p className="font-medium truncate">{user.name}</p>
                                        {user.role && (
                                            <p className="text-[10px] text-muted-foreground">
                                                {user.role}
                                            </p>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <p className="mt-1.5 text-[10px] text-muted-foreground">
                    Press <kbd className="px-1 py-0.5 rounded bg-muted text-[9px] font-mono">Ctrl+Enter</kbd> to send
                    {' · '}Type <kbd className="px-1 py-0.5 rounded bg-muted text-[9px] font-mono">@</kbd> to mention someone
                </p>
            </CardContent>
        </Card>
    );
}
