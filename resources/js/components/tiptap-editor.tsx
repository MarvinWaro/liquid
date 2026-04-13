import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
    Bold, Italic, Strikethrough, Code, List, ListOrdered,
    Quote, Heading1, Heading2, Heading3, Link as LinkIcon,
    Undo, Redo, Minus,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TipTapEditorProps {
    value: string;
    onChange: (html: string) => void;
    placeholder?: string;
    className?: string;
}

const ToolbarButton = ({
    onClick, active, disabled, children, title,
}: {
    onClick: () => void;
    active?: boolean;
    disabled?: boolean;
    children: React.ReactNode;
    title: string;
}) => (
    <Button
        type="button"
        size="sm"
        variant={active ? 'default' : 'ghost'}
        onClick={onClick}
        disabled={disabled}
        title={title}
        className="h-8 w-8 p-0"
    >
        {children}
    </Button>
);

const Toolbar = ({ editor }: { editor: Editor }) => {
    const setLink = () => {
        const prev = editor.getAttributes('link').href as string | undefined;
        const url = window.prompt('URL', prev ?? 'https://');
        if (url === null) return;
        if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            return;
        }
        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    };

    return (
        <div className="flex flex-wrap items-center gap-1 border-b bg-muted/30 p-2">
            <ToolbarButton title="Heading 1" active={editor.isActive('heading', { level: 1 })}
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
                <Heading1 className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton title="Heading 2" active={editor.isActive('heading', { level: 2 })}
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
                <Heading2 className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton title="Heading 3" active={editor.isActive('heading', { level: 3 })}
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
                <Heading3 className="h-4 w-4" />
            </ToolbarButton>
            <div className="mx-1 h-5 w-px bg-border" />
            <ToolbarButton title="Bold" active={editor.isActive('bold')}
                onClick={() => editor.chain().focus().toggleBold().run()}>
                <Bold className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton title="Italic" active={editor.isActive('italic')}
                onClick={() => editor.chain().focus().toggleItalic().run()}>
                <Italic className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton title="Strikethrough" active={editor.isActive('strike')}
                onClick={() => editor.chain().focus().toggleStrike().run()}>
                <Strikethrough className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton title="Inline code" active={editor.isActive('code')}
                onClick={() => editor.chain().focus().toggleCode().run()}>
                <Code className="h-4 w-4" />
            </ToolbarButton>
            <div className="mx-1 h-5 w-px bg-border" />
            <ToolbarButton title="Bullet list" active={editor.isActive('bulletList')}
                onClick={() => editor.chain().focus().toggleBulletList().run()}>
                <List className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton title="Numbered list" active={editor.isActive('orderedList')}
                onClick={() => editor.chain().focus().toggleOrderedList().run()}>
                <ListOrdered className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton title="Blockquote" active={editor.isActive('blockquote')}
                onClick={() => editor.chain().focus().toggleBlockquote().run()}>
                <Quote className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton title="Horizontal rule"
                onClick={() => editor.chain().focus().setHorizontalRule().run()}>
                <Minus className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton title="Link" active={editor.isActive('link')} onClick={setLink}>
                <LinkIcon className="h-4 w-4" />
            </ToolbarButton>
            <div className="mx-1 h-5 w-px bg-border" />
            <ToolbarButton title="Undo" disabled={!editor.can().undo()}
                onClick={() => editor.chain().focus().undo().run()}>
                <Undo className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton title="Redo" disabled={!editor.can().redo()}
                onClick={() => editor.chain().focus().redo().run()}>
                <Redo className="h-4 w-4" />
            </ToolbarButton>
        </div>
    );
};

export function TipTapEditor({ value, onChange, placeholder, className }: TipTapEditorProps) {
    const editor = useEditor({
        extensions: [
            StarterKit,
            Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } }),
            Placeholder.configure({ placeholder: placeholder ?? 'Write your announcement…' }),
        ],
        content: value || '',
        editorProps: {
            attributes: {
                class: 'prose prose-sm dark:prose-invert max-w-none min-h-[240px] px-4 py-3 focus:outline-none',
            },
        },
        onUpdate: ({ editor }) => onChange(editor.getHTML()),
    });

    // Keep editor in sync when value is reset externally (e.g. form reset after submit).
    useEffect(() => {
        if (!editor) return;
        if (value !== editor.getHTML()) {
            editor.commands.setContent(value || '', { emitUpdate: false });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value, editor]);

    if (!editor) return null;

    return (
        <div className={cn('rounded-md border bg-background overflow-hidden', className)}>
            <Toolbar editor={editor} />
            <EditorContent editor={editor} />
        </div>
    );
}
