import { Head } from '@inertiajs/react';

import AppearanceTabs from '@/components/appearance-tabs';
import FontTabs from '@/components/font-tabs';
import HeadingSmall from '@/components/heading-small';
import LayoutTabs from '@/components/layout-tabs';
import { type BreadcrumbItem } from '@/types';

import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { edit as editAppearance } from '@/routes/appearance';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Appearance settings',
        href: editAppearance().url,
    },
];

export default function Appearance() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Appearance settings" />

            <h1 className="sr-only">Appearance Settings</h1>

            <SettingsLayout>
                <div className="space-y-6">
                    <HeadingSmall
                        title="Appearance settings"
                        description="Update your account's appearance settings"
                    />
                    <AppearanceTabs />
                </div>

                <div className="mt-8 space-y-6 border-t pt-6">
                    <HeadingSmall
                        title="Navigation style"
                        description="Choose how you want to navigate through the platform"
                    />
                    <LayoutTabs />
                </div>

                <div className="mt-8 space-y-6 border-t pt-6">
                    <HeadingSmall
                        title="Font"
                        description="Pick a typeface for the app. All options use tabular numerals so figures stay aligned in tables and reports."
                    />
                    <FontTabs />
                </div>
            </SettingsLayout>
        </AppLayout>
    );
}
