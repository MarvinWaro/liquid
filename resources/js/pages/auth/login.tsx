import InputError from '@/components/input-error';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Card, CardContent } from "@/components/ui/card";
import { register } from '@/routes';
import { store } from '@/routes/login';
import { request } from '@/routes/password';
import { Form, Head } from '@inertiajs/react';

interface LoginProps {
    status?: string;
    canResetPassword: boolean;
    canRegister: boolean;
}

export default function Login({
    status,
    canResetPassword,
    canRegister,
}: LoginProps) {
    return (
        <div className="relative min-h-svh flex flex-col items-center justify-center p-6 md:p-10 overflow-hidden bg-background">
            <Head title="Log in" />

            {/* BACKGROUND LAYER 1: Image Texture */}
            <div className="absolute inset-0 z-0">
                <img
                    src="/assets/img/unifastbg.jpg"
                    alt=""
                    className="h-full w-full object-cover opacity-20 dark:opacity-10"
                />
            </div>

            {/* BACKGROUND LAYER 2: Gradient Overlay (Light Blue/White theme) */}
            <div className="absolute inset-0 z-10 bg-gradient-to-br from-blue-50/90 via-white/80 to-blue-100/50 dark:from-gray-900/90 dark:via-gray-950/80 dark:to-gray-900/50 mix-blend-overlay dark:mix-blend-normal" />

            {/* CONTENT LAYER */}
            <div className="relative z-20 w-full max-w-sm md:max-w-4xl">
                <Card className="overflow-hidden shadow-2xl border-0 rounded-2xl">
                    <CardContent className="grid p-0 md:grid-cols-2 h-full">

                        {/* LEFT SIDE: BRAND IMAGE (Flipped from previous) */}
                        <div
                        className="relative hidden md:flex flex-col justify-end bg-cover bg-center text-white ms-5 rounded-2xl overflow-hidden"
                        style={{ backgroundImage: `url('/assets/img/unifastbg.jpg')` }}
                        >
                            {/* Dark overlay for contrast */}
                            <div className="absolute inset-0 bg-black/20 z-0"></div>
                        </div>

                        {/* RIGHT SIDE: LOGIN FORM */}
                        <div className="flex flex-col justify-center p-8 md:p-12 bg-background">

                            {/* LOGO HEADER */}
                            <div className="flex justify-center items-center gap-4 mb-8">
                                {/* <img src="/assets/img/bagong-pilipinas.png" alt="Bagong Pilipinas" className="h-10 w-auto" /> */}
                                <img src="/assets/img/ched-logo.png" alt="CHED" className="h-11 w-auto" />
                                <img src="/assets/img/unifast.png" alt="UniFAST" className="h-10 w-auto" />
                            </div>

                            <div className="flex flex-col items-center gap-1 text-center mb-6">
                                <h2 className="text-xs font-bold tracking-widest text-muted-foreground uppercase">User Login</h2>
                                <p className="text-xs text-muted-foreground">
                                    Enter your email and password to continue
                                </p>
                            </div>

                            <Form
                                {...store.form()}
                                resetOnSuccess={['password']}
                                className="flex flex-col gap-5"
                            >
                                {({ processing, errors }) => (
                                    <>
                                        <div className="grid gap-2">
                                            <Label htmlFor="email" className="text-xs uppercase font-medium text-muted-foreground">Email address</Label>
                                            <Input
                                                id="email"
                                                type="email"
                                                name="email"
                                                required
                                                autoFocus
                                                tabIndex={1}
                                                autoComplete="email"
                                                placeholder="email@example.com"
                                                className="bg-muted/50 border-border"
                                            />
                                            <InputError message={errors.email} />
                                        </div>

                                        <div className="grid gap-2">
                                            <Label htmlFor="password" className="text-xs uppercase font-medium text-muted-foreground">Password</Label>
                                            <Input
                                                id="password"
                                                type="password"
                                                name="password"
                                                required
                                                tabIndex={2}
                                                autoComplete="current-password"
                                                placeholder="Password"
                                                className="bg-muted/50 border-border"
                                            />
                                            <InputError message={errors.password} />
                                        </div>

                                        <Button
                                            type="submit"
                                            className="w-full mt-2 bg-blue-900 hover:bg-blue-800 text-white rounded-md"
                                            tabIndex={4}
                                            disabled={processing}
                                        >
                                            {processing && <Spinner className="mr-2" />}
                                            Log in
                                        </Button>

                                        {canRegister && (
                                            <div className="text-center text-xs mt-4 text-muted-foreground">
                                                Don&apos;t have an account?{' '}
                                                <TextLink href={register()} className="font-bold text-foreground hover:underline" tabIndex={5}>
                                                    Sign up
                                                </TextLink>
                                            </div>
                                        )}
                                    </>
                                )}
                            </Form>
                            {status && (
                                <div className="mt-4 text-center text-sm font-medium text-green-600">
                                    {status}
                                </div>
                            )}
                        </div>

                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
