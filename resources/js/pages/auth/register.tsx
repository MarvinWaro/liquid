import InputError from '@/components/input-error';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Card, CardContent } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { login } from '@/routes';
import { store } from '@/routes/register';
import { Form, Head } from '@inertiajs/react';

interface HEI {
    id: number;
    name: string;
    code: string;
    uii: string | null;
}

interface Props {
    heis: HEI[];
}

export default function Register({ heis }: Props) {
    return (
        <div className="relative min-h-svh flex flex-col items-center justify-center p-6 md:p-10 overflow-hidden bg-background">
            <Head title="Register" />

            {/* BACKGROUND LAYER 1: Image Texture */}
            <div className="absolute inset-0 z-0">
                <img
                    src="/assets/img/unifastbg.jpg"
                    alt=""
                    className="h-full w-full object-cover opacity-20 dark:opacity-10"
                />
            </div>

            {/* BACKGROUND LAYER 2: Gradient Overlay */}
            <div className="absolute inset-0 z-10 bg-gradient-to-br from-blue-50/90 via-white/80 to-blue-100/50 dark:from-gray-900/90 dark:via-gray-950/80 dark:to-gray-900/50 mix-blend-overlay dark:mix-blend-normal" />

            {/* CONTENT LAYER */}
            <div className="relative z-20 w-full max-w-sm md:max-w-4xl">
                <Card className="overflow-hidden shadow-2xl border-0 rounded-2xl">
                    <CardContent className="grid p-0 md:grid-cols-2 h-full">

                        {/* LEFT SIDE: REGISTER FORM */}
                        <div className="flex flex-col justify-center p-8 md:p-12 bg-background">

                            {/* LOGO HEADER */}
                            <div className="flex justify-center items-center gap-4 mb-8">
                                <img src="/assets/img/ched-logo.png" alt="CHED" className="h-11 w-auto" />
                                <img src="/assets/img/unifast.png" alt="UniFAST" className="h-10 w-auto" />
                            </div>

                            <div className="flex flex-col items-center gap-1 text-center mb-6">
                                <h2 className="text-xs font-bold tracking-widest text-muted-foreground uppercase">Create HEI Account</h2>
                                <p className="text-xs text-muted-foreground">
                                    Register your Higher Education Institution account
                                </p>
                            </div>

                            <Form
                                {...store.form()}
                                resetOnSuccess={['password', 'password_confirmation']}
                                className="flex flex-col gap-4"
                            >
                                {({ processing, errors }) => (
                                    <>
                                        <div className="grid gap-2">
                                            <Label htmlFor="hei_id" className="text-xs uppercase font-medium text-muted-foreground">Institution *</Label>
                                            <Select name="hei_id" required>
                                                <SelectTrigger id="hei_id" className="bg-muted/50 border-border">
                                                    <SelectValue placeholder="Select your institution" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {heis.map((hei) => (
                                                        <SelectItem key={hei.id} value={hei.id.toString()}>
                                                            {hei.name} ({hei.code})
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <InputError message={errors.hei_id} />
                                        </div>

                                        <div className="grid gap-2">
                                            <Label htmlFor="name" className="text-xs uppercase font-medium text-muted-foreground">Contact Person Name</Label>
                                            <Input
                                                id="name"
                                                name="name"
                                                required
                                                placeholder="Full name"
                                                className="bg-muted/50 border-border"
                                            />
                                            <InputError message={errors.name} />
                                        </div>

                                        <div className="grid gap-2">
                                            <Label htmlFor="email" className="text-xs uppercase font-medium text-muted-foreground">Institutional Email</Label>
                                            <Input
                                                id="email"
                                                type="email"
                                                name="email"
                                                required
                                                placeholder="email@institution.edu.ph"
                                                className="bg-muted/50 border-border"
                                            />
                                            <InputError message={errors.email} />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="grid gap-2">
                                                <Label htmlFor="password" title="Password" className="text-xs uppercase font-medium text-muted-foreground">Password</Label>
                                                <Input
                                                    id="password"
                                                    type="password"
                                                    name="password"
                                                    required
                                                    className="bg-muted/50 border-border"
                                                />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label htmlFor="password_confirmation" className="text-xs uppercase font-medium text-muted-foreground">Confirm</Label>
                                                <Input
                                                    id="password_confirmation"
                                                    type="password"
                                                    name="password_confirmation"
                                                    required
                                                    className="bg-muted/50 border-border"
                                                />
                                            </div>
                                        </div>
                                        <InputError message={errors.password} />

                                        <Button
                                            type="submit"
                                            className="w-full mt-2 bg-blue-900 hover:bg-blue-800 text-white rounded-md"
                                            disabled={processing}
                                        >
                                            {processing && <Spinner className="mr-2" />}
                                            Create account
                                        </Button>

                                        <div className="text-center text-xs mt-4 text-muted-foreground">
                                            Already have an account?{' '}
                                            <TextLink href={login()} className="font-bold text-foreground hover:underline">
                                                Log in
                                            </TextLink>
                                        </div>
                                    </>
                                )}
                            </Form>
                        </div>

                        {/* RIGHT SIDE: BRAND IMAGE (Swapped order) */}
                        <div
                            className="relative hidden md:flex flex-col justify-end bg-cover bg-center text-white me-5 my-5 rounded-2xl overflow-hidden"
                            style={{ backgroundImage: `url('/assets/img/unifastbg.jpg')` }}
                        >
                            <div className="absolute inset-0 bg-black/20 z-0"></div>
                        </div>

                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
