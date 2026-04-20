import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Contact & Support', href: '/contact-support' }];

export default function ContactSupport() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Contact & Support" />
            <div className="flex min-h-[calc(100vh-10rem)] flex-col items-center justify-center gap-6 px-6 py-12 text-center">
                <img
                    src="/assets/img/alerts/under-construction.png"
                    alt="Under Construction"
                    className="w-full max-w-md"
                />
                <div className="space-y-2">
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                        Contact & Support is Under Development
                    </h1>
                    <p className="max-w-xl text-sm text-muted-foreground">
                        This feature is yet to be developed. We're working hard to bring you a
                        dedicated space for help, guides, and support requests. Please check back
                        soon.
                    </p>
                </div>
            </div>
        </AppLayout>
    );
}
