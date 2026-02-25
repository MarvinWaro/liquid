<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

// php artisan db:seed --class=PermissionSeeder

class PermissionSeeder extends Seeder
{
    public function run(): void
    {
        // Define all permissions
        $permissions = [
            'Roles & Permissions' => [
                ['name' => 'view_roles', 'description' => 'View roles list'],
                ['name' => 'create_roles', 'description' => 'Create new roles'],
                ['name' => 'edit_roles', 'description' => 'Edit existing roles'],
                ['name' => 'delete_roles', 'description' => 'Delete roles'],
            ],
            'User Management' => [
                ['name' => 'view_users', 'description' => 'View users list'],
                ['name' => 'create_users', 'description' => 'Create new users'],
                ['name' => 'edit_users', 'description' => 'Edit existing users'],
                ['name' => 'delete_users', 'description' => 'Delete users'],
                ['name' => 'change_user_status', 'description' => 'Activate/deactivate users'],
            ],
            'HEI' => [
                ['name' => 'view_hei', 'description' => 'View HEI list'],
                ['name' => 'create_hei', 'description' => 'Create new HEI'],
                ['name' => 'edit_hei', 'description' => 'Edit existing HEI'],
                ['name' => 'delete_hei', 'description' => 'Delete HEI'],
                ['name' => 'sync_hei_api', 'description' => 'Sync HEI from API'],
            ],
            'Regions' => [
                ['name' => 'view_regions', 'description' => 'View regions list'],
                ['name' => 'create_regions', 'description' => 'Create new regions'],
                ['name' => 'edit_regions', 'description' => 'Edit existing regions'],
                ['name' => 'delete_regions', 'description' => 'Delete regions'],
            ],
            'Liquidation' => [
                ['name' => 'view_liquidation', 'description' => 'View liquidation records'],
                ['name' => 'create_liquidation', 'description' => 'Create liquidation records'],
                ['name' => 'edit_liquidation', 'description' => 'Edit liquidation records'],
                ['name' => 'delete_liquidation', 'description' => 'Delete liquidation records'],
                ['name' => 'review_liquidation', 'description' => 'Review liquidation documents'],
                ['name' => 'endorse_liquidation', 'description' => 'Endorse liquidation to accounting'],
            ],
            'Programs' => [
                ['name' => 'view_programs', 'description' => 'View programs list'],
                ['name' => 'create_programs', 'description' => 'Create new programs'],
                ['name' => 'edit_programs', 'description' => 'Edit existing programs'],
                ['name' => 'delete_programs', 'description' => 'Delete programs'],
            ],
            'Semesters' => [
                ['name' => 'view_semesters', 'description' => 'View semesters list'],
                ['name' => 'create_semesters', 'description' => 'Create new semesters'],
                ['name' => 'edit_semesters', 'description' => 'Edit existing semesters'],
                ['name' => 'delete_semesters', 'description' => 'Delete semesters'],
            ],
            'Academic Years' => [
                ['name' => 'view_academic_years', 'description' => 'View academic years list'],
                ['name' => 'create_academic_years', 'description' => 'Create new academic years'],
                ['name' => 'edit_academic_years', 'description' => 'Edit existing academic years'],
                ['name' => 'delete_academic_years', 'description' => 'Delete academic years'],
            ],
            'Document Requirements' => [
                ['name' => 'view_document_requirements', 'description' => 'View document requirements list'],
                ['name' => 'create_document_requirements', 'description' => 'Create new document requirements'],
                ['name' => 'edit_document_requirements', 'description' => 'Edit existing document requirements'],
                ['name' => 'delete_document_requirements', 'description' => 'Delete document requirements'],
            ],
            'Reports' => [
                ['name' => 'view_reports', 'description' => 'View reports'],
                ['name' => 'export_reports', 'description' => 'Export reports to Excel'],
                ['name' => 'view_dashboard', 'description' => 'View dashboard statistics'],
            ],
            'Activity Logs' => [
                ['name' => 'view_activity_logs', 'description' => 'View system activity logs'],
            ],
        ];

        // Create or update permissions
        foreach ($permissions as $module => $perms) {
            foreach ($perms as $perm) {
                Permission::updateOrCreate(
                    ['name' => $perm['name']],
                    [
                        'module' => $module,
                        'description' => $perm['description'],
                    ]
                );
            }
        }

        // Create or update Super Admin role with ALL permissions
        $superAdminRole = Role::updateOrCreate(
            ['name' => 'Super Admin'],
            ['description' => 'Has complete access to all system features']
        );
        $superAdminRole->permissions()->sync(Permission::all()->pluck('id'));

        // Create some example roles (optional - Super Admin can create more via UI)
        $this->createExampleRole('Admin', 'System administrator', [
            'view_roles', 'create_roles', 'edit_roles', 'delete_roles',
            'view_users', 'create_users', 'edit_users', 'delete_users', 'change_user_status',
            'view_hei', 'create_hei', 'edit_hei', 'delete_hei', 'sync_hei_api',
            'view_regions', 'create_regions', 'edit_regions', 'delete_regions',
            'view_liquidation', 'create_liquidation', 'edit_liquidation', 'delete_liquidation',
            'view_programs', 'create_programs', 'edit_programs', 'delete_programs',
            'view_semesters', 'create_semesters', 'edit_semesters', 'delete_semesters',
            'view_academic_years', 'create_academic_years', 'edit_academic_years', 'delete_academic_years',
            'view_document_requirements', 'create_document_requirements', 'edit_document_requirements', 'delete_document_requirements',
            'view_reports', 'export_reports', 'view_dashboard',
            'view_activity_logs',
        ]);

        $this->createExampleRole('Regional Coordinator', 'Reviews and endorses liquidation', [
            'view_hei',
            'view_liquidation', 'create_liquidation', 'edit_liquidation', 'review_liquidation', 'endorse_liquidation',
            'view_reports', 'view_dashboard',
        ]);

        $this->createExampleRole('Accountant', 'Reviews and endorses to COA', [
            'view_hei',
            'view_liquidation', 'review_liquidation', 'endorse_liquidation',
            'view_reports', 'view_dashboard',
        ]);

        $this->createExampleRole('HEI', 'Higher Education Institution user', [
            'view_liquidation', 'edit_liquidation',
        ]);

        $this->createExampleRole('Encoder', 'Data entry staff', [
            'view_hei', 'create_hei', 'edit_hei',
            'view_liquidation', 'create_liquidation', 'edit_liquidation',
        ]);

        $this->createExampleRole('Viewer', 'Read-only access', [
            'view_hei', 'view_liquidation', 'view_reports', 'view_dashboard',
        ]);
    }

    private function createExampleRole(string $name, string $description, array $permissionNames): void
    {
        $role = Role::updateOrCreate(
            ['name' => $name],
            ['description' => $description]
        );

        $permissions = Permission::whereIn('name', $permissionNames)->pluck('id');
        $role->permissions()->sync($permissions);
    }
}
