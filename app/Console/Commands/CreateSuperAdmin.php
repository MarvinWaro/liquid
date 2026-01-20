<?php

namespace App\Console\Commands;

use App\Models\Role;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;

class CreateSuperAdmin extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'make:superadmin';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Create a Super Admin user';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('🔐 Create Super Admin User');
        $this->newLine();

        // Get Super Admin role
        $superAdminRole = Role::where('name', 'Super Admin')->first();

        if (!$superAdminRole) {
            $this->error('❌ Super Admin role not found!');
            $this->warn('Please run: php artisan db:seed --class=PermissionSeeder');
            return 1;
        }

        // Get user details
        $name = $this->ask('Full Name');
        $email = $this->ask('Email Address');

        // Validate email
        $validator = Validator::make(['email' => $email], [
            'email' => 'required|email|unique:users,email',
        ]);

        if ($validator->fails()) {
            $this->error('❌ ' . $validator->errors()->first('email'));
            return 1;
        }

        // Get password
        $password = $this->secret('Password (min 8 characters)');
        $passwordConfirmation = $this->secret('Confirm Password');

        if ($password !== $passwordConfirmation) {
            $this->error('❌ Passwords do not match!');
            return 1;
        }

        if (strlen($password) < 8) {
            $this->error('❌ Password must be at least 8 characters!');
            return 1;
        }

        // Confirm creation
        $this->newLine();
        $this->table(
            ['Field', 'Value'],
            [
                ['Name', $name],
                ['Email', $email],
                ['Role', 'Super Admin'],
                ['Status', 'Active'],
            ]
        );

        if (!$this->confirm('Create this Super Admin user?', true)) {
            $this->warn('❌ Cancelled!');
            return 0;
        }

        // Create user
        try {
            $user = User::create([
                'name' => $name,
                'email' => $email,
                'password' => Hash::make($password),
                'role_id' => $superAdminRole->id,
                'status' => 'active',
            ]);

            $this->newLine();
            $this->info('✅ Super Admin created successfully!');
            $this->newLine();
            $this->line("👤 Name: {$user->name}");
            $this->line("📧 Email: {$user->email}");
            $this->line("🔑 Role: Super Admin");
            $this->line("✨ Status: Active");
            $this->newLine();
            $this->info('🎉 You can now login with these credentials!');

            return 0;
        } catch (\Exception $e) {
            $this->error('❌ Error creating Super Admin: ' . $e->getMessage());
            return 1;
        }
    }
}
