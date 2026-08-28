import InitialPasswordController from '@/actions/App/Http/Controllers/Auth/InitialPasswordController';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { edit } from '@/routes/user-password';
import { type SharedData } from '@/types';
import { Form, router, usePage } from '@inertiajs/react';
import { Eye, EyeOff, ShieldAlert } from 'lucide-react';
import { useState } from 'react';

/**
 * Asks a user who is still on the password an administrator gave them to choose
 * their own.
 *
 * Whether to show it is decided by the server (the mustChangePassword shared
 * prop), never here - the browser has no business ruling on account state.
 *
 * Mounted once by the app layout, so it follows the user to whichever page they
 * land on after signing in rather than being tied to one route.
 */
export default function ChangePasswordDialog() {
    const page = usePage<SharedData>();
    const { mustChangePassword } = page.props;
    const [skipping, setSkipping] = useState(false);

    // Nothing to nag about on the page that already does this job.
    const onPasswordSettings = page.url.split('?')[0] === edit().url;

    if (!mustChangePassword || onPasswordSettings) {
        return null;
    }

    const skipForNow = () => {
        setSkipping(true);

        router.post(
            InitialPasswordController.postpone.url(),
            {},
            {
                preserveScroll: true,
                onFinish: () => setSkipping(false),
            },
        );
    };

    return (
        <Dialog open>
            <DialogContent
                showCloseButton={false}
                // The two buttons below are the only ways out. A stray click on
                // the backdrop or a reflex press of Escape should not count as
                // "I have dealt with this".
                onInteractOutside={(event) => event.preventDefault()}
                onEscapeKeyDown={(event) => event.preventDefault()}
                className="sm:max-w-md"
            >
                <DialogHeader>
                    <div className="mb-1 flex size-10 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
                        <ShieldAlert className="size-5" />
                    </div>
                    <DialogTitle>Set your own password</DialogTitle>
                    <DialogDescription>
                        You are still using the password your administrator
                        created for you. Choose a new one that only you know.
                    </DialogDescription>
                </DialogHeader>

                <Form
                    {...InitialPasswordController.update.form()}
                    options={{ preserveScroll: true }}
                    resetOnError={['password', 'password_confirmation']}
                    className="space-y-4"
                >
                    {({ errors, processing }) => (
                        <>
                            <PasswordField
                                id="password"
                                name="password"
                                label="New password"
                                error={errors.password}
                                autoFocus
                            />

                            <PasswordField
                                id="password_confirmation"
                                name="password_confirmation"
                                label="Confirm password"
                                error={errors.password_confirmation}
                            />

                            <DialogFooter className="gap-2 pt-2">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={skipForNow}
                                    disabled={processing || skipping}
                                >
                                    {skipping && <Spinner className="mr-2" />}
                                    Skip for now
                                </Button>

                                <Button
                                    type="submit"
                                    disabled={processing || skipping}
                                >
                                    {processing && <Spinner className="mr-2" />}
                                    Save password
                                </Button>
                            </DialogFooter>

                            <p className="text-center text-xs text-muted-foreground">
                                If you skip, we will ask again the next time you
                                log in.
                            </p>
                        </>
                    )}
                </Form>
            </DialogContent>
        </Dialog>
    );
}

/**
 * A labelled password box with a show/hide toggle. Local to this dialog because
 * the repo hand-rolls the toggle per page (see pages/auth/login.tsx); this keeps
 * the two fields here from repeating the same markup twice.
 */
function PasswordField({
    id,
    name,
    label,
    error,
    autoFocus = false,
}: {
    id: string;
    name: string;
    label: string;
    error?: string;
    autoFocus?: boolean;
}) {
    const [shown, setShown] = useState(false);

    return (
        <div className="grid gap-2">
            <Label htmlFor={id}>{label}</Label>

            <div className="relative">
                <Input
                    id={id}
                    name={name}
                    type={shown ? 'text' : 'password'}
                    autoComplete="new-password"
                    autoFocus={autoFocus}
                    required
                    className="pr-10"
                    placeholder={label}
                />
                <button
                    type="button"
                    onClick={() => setShown((value) => !value)}
                    // Kept out of the tab order so it never sits between the two
                    // fields and the Save button.
                    tabIndex={-1}
                    aria-label={shown ? 'Hide password' : 'Show password'}
                    aria-pressed={shown}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                    {shown ? (
                        <EyeOff className="h-4 w-4" />
                    ) : (
                        <Eye className="h-4 w-4" />
                    )}
                </button>
            </div>

            <InputError message={error} />
        </div>
    );
}
