<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;
//php artisan db:seed --class=PermissionSeeder

class PermissionSeeder extends Seeder
{
    public function run(): void
    {
        // Define permissions by module
        $permissions = [
            'Roles & Permissions' => [
                ['name' => 'view_roles', 'description' => 'View roles list'],
                ['name' => 'create_roles', 'description' => 'Create new roles'],
                ['name' => 'edit_roles', 'description' => 'Edit existing roles'],
                ['name' => 'delete_roles', 'description' => 'Delete roles'],
                ['name' => 'assign_permissions', 'description' => 'Assign permissions to roles'],
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
            'Liquidation' => [
                ['name' => 'view_liquidation', 'description' => 'View liquidation records'],
                ['name' => 'create_liquidation', 'description' => 'Create liquidation records'],
                ['name' => 'edit_liquidation', 'description' => 'Edit liquidation records'],
                ['name' => 'delete_liquidation', 'description' => 'Delete liquidation records'],
                ['name' => 'review_liquidation', 'description' => 'Review liquidation documents'],
                ['name' => 'endorse_liquidation', 'description' => 'Endorse liquidation to accounting'],
            ],
            'Reports' => [
                ['name' => 'view_reports', 'description' => 'View reports'],
                ['name' => 'export_reports', 'description' => 'Export reports to Excel'],
                ['name' => 'view_dashboard', 'description' => 'View dashboard statistics'],
            ],
        ];

        // Create permissions
        foreach ($permissions as $module => $perms) {
            foreach ($perms as $perm) {
                Permission::create([
                    'name' => $perm['name'],
                    'module' => $module,
                    'description' => $perm['description'],
                ]);
            }
        }

        // Create default Admin role with all permissions
        $adminRole = Role::create([
            'name' => 'Admin',
            'description' => 'System administrator with full access',
        ]);

        // Assign all permissions to Admin
        $allPermissions = Permission::all()->pluck('id');
        $adminRole->permissions()->attach($allPermissions);

        // Create default Regional Coordinator role
        $rcRole = Role::create([
            'name' => 'Regional Coordinator',
            'description' => 'Reviews and endorses liquidation documents',
        ]);

        // Assign specific permissions to RC
        $rcPermissions = Permission::whereIn('name', [
            'view_hei',
            'view_liquidation',
            'review_liquidation',
            'endorse_liquidation',
            'view_reports',
            'view_dashboard',
        ])->pluck('id');
        $rcRole->permissions()->attach($rcPermissions);

        // Create default Encoder role
        $encoderRole = Role::create([
            'name' => 'Encoder',
            'description' => 'Data entry for HEI and liquidation records',
        ]);

        // Assign specific permissions to Encoder
        $encoderPermissions = Permission::whereIn('name', [
            'view_hei',
            'create_hei',
            'edit_hei',
            'view_liquidation',
            'create_liquidation',
            'edit_liquidation',
        ])->pluck('id');
        $encoderRole->permissions()->attach($encoderPermissions);

        // Create default Viewer role
        $viewerRole = Role::create([
            'name' => 'Viewer',
            'description' => 'Read-only access to reports and data',
        ]);

        // Assign view-only permissions to Viewer
        $viewerPermissions = Permission::whereIn('name', [
            'view_hei',
            'view_liquidation',
            'view_reports',
            'view_dashboard',
        ])->pluck('id');
        $viewerRole->permissions()->attach($viewerPermissions);
    }
}
