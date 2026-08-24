<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\HEI;
use App\Models\Program;
use App\Models\Region;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * Temporary seeder for testing — creates a Super Admin plus dummy RC, STUFAPS
 * Focal, and HEI users, all sharing one well-known password.
 *
 * MUST be removed before production deployment. It is not merely dummy data:
 * it seeds a Super Admin whose password is public knowledge. Real
 * administrators are created with `php artisan make:superadmin`.
 */
class TestUserSeeder extends Seeder
{
    /** Track used emails to avoid duplicates. */
    private array $usedEmails = [];

    public function run(): void
    {
        $password = Hash::make('password');

        $rcRole = Role::where('name', 'Regional Coordinator')->firstOrFail();
        $stufapsRole = Role::where('name', 'STUFAPS Focal')->firstOrFail();
        $heiRole = Role::where('name', 'HEI')->firstOrFail();

        // Without this a fresh `migrate:fresh --seed` leaves no way in at all -
        // make:superadmin is interactive, so it had to be re-run by hand
        // after every reset. Keyed on the email, so re-seeding never duplicates
        // the account nor overwrites a Super Admin that is already there.
        $superAdminRole = Role::where('name', 'Super Admin')->firstOrFail();
        User::firstOrCreate(['email' => 'admin@gmail.com'], [
            'name' => 'Admin',
            'password' => $password,
            'role_id' => $superAdminRole->id,
            'status' => 'active',
            'email_verified_at' => now(),
        ]);
        $this->usedEmails[] = 'admin@gmail.com';

        $r12 = Region::where('code', 'R12')->firstOrFail();
        $barmm = Region::where('code', 'BARMM')->firstOrFail();

        // ── BARMM-B Regional Coordinators ──
        $barmmRCs = [
            'Albino, Emily',
            'Apostol, Mark Vincent C.',
            'Dayaguit, Basil John L.',
            'Mata, Alvin',
            'Mangondatu, Alimodin',
            'Paulo, Zhelene',
        ];

        foreach ($barmmRCs as $name) {
            $email = $this->generateEmailFromPersonName($name);
            User::firstOrCreate(['email' => $email], [
                'name' => $name,
                'email' => $email,
                'password' => $password,
                'role_id' => $rcRole->id,
                'region_id' => $barmm->id,
                'status' => 'active',
                'email_verified_at' => now(),
            ]);
        }

        // ── Region-12 Regional Coordinators ──
        $r12RCs = [
            'Baton, Beberly',
            'Berina, Annie Jade',
            'Bito-on, Cyrine Mae F.',
            'Castillo, Jay Arr',
            'Chu, Chris Dave',
            'Cortez, Hannah Grace C.',
            'Dacutanan, Jelli D.',
            'Dayaday, Sharlene Vin',
            'Gabucan, Reniel Jay',
            'Laro, Aries Jake',
            'Magbanua, Angel',
            'Navarro, Jofaith P',
            'Ogena, Ernest Paul Ysean',
            'Villanueva, Edelle Joy',
        ];

        foreach ($r12RCs as $name) {
            $email = $this->generateEmailFromPersonName($name);
            User::firstOrCreate(['email' => $email], [
                'name' => $name,
                'email' => $email,
                'password' => $password,
                'role_id' => $rcRole->id,
                'region_id' => $r12->id,
                'status' => 'active',
                'email_verified_at' => now(),
            ]);
        }

        // ── STUFAPS Local Focals ──
        $stufapsFocals = [
            'Comprendio, Daven' => ['CMSP'],
            'Erfe, Jeanly' => ['CHED-TDP'],
            'Galamiton, Kia Zandra' => ['MSRS', 'ACEF-GIAHEP', 'SIDA-SGP'],
            'Reformado, Melanie' => ['COSCHO'],
            'Reginaldo, Ferlyn Jane N' => ['COSCHO'],
        ];

        foreach ($stufapsFocals as $name => $programCodes) {
            $email = $this->generateEmailFromPersonName($name);
            $user = User::firstOrCreate(['email' => $email], [
                'name' => $name,
                'email' => $email,
                'password' => $password,
                'role_id' => $stufapsRole->id,
                'region_id' => null,
                'status' => 'active',
                'email_verified_at' => now(),
            ]);

            if ($user->programs()->count() === 0) {
                $programIds = Program::whereIn('code', $programCodes)->pluck('id')->all();
                $user->programs()->sync($programIds);
            }
        }

        // ── HEI Users (one per institution) ──
        $heiCount = 0;
        $heis = HEI::orderBy('name')->get();

        foreach ($heis as $hei) {
            $email = $this->generateEmailFromHeiUii($hei->uii);
            $user = User::firstOrCreate(['email' => $email], [
                'name' => $hei->name,
                'email' => $email,
                'password' => $password,
                'role_id' => $heiRole->id,
                'hei_id' => $hei->id,
                'region_id' => $hei->region_id,
                'status' => 'active',
                'email_verified_at' => now(),
            ]);
            $heiCount++;
        }

        $staffCount = count($barmmRCs) + count($r12RCs) + count($stufapsFocals);
        $this->command->info("TestUserSeeder: {$staffCount} staff + {$heiCount} HEI users seeded");
        $this->command->line('  HEI login   : {uii}@gmail.com         e.g. 12120@gmail.com');
        $this->command->line('  Staff login : {firstname}@gmail.com   e.g. aries@gmail.com');
        $this->command->line('  Super Admin : admin@gmail.com');
        $this->command->line('  Password    : password  (all accounts)');
    }

    /**
     * Generate email from person name: "Laro, Aries Jake" → "aries@gmail.com"
     */
    private function generateEmailFromPersonName(string $name): string
    {
        $parts = explode(',', $name, 2);
        $firstPart = trim($parts[1] ?? $parts[0]);
        $firstName = strtolower(explode(' ', $firstPart)[0]);
        $firstName = preg_replace('/[^a-z]/', '', $firstName);

        return $this->makeUniqueEmail($firstName);
    }

    /**
     * Generate email from HEI UII: "12120" → "12120@gmail.com",
     * "TBD-01" → "tbd-01@gmail.com".
     *
     * The name used to supply this, but 181 institutions share a handful of
     * first words, so 76 of the logins came out as "south5@gmail.com" and the
     * like - impossible to match back to a campus without a lookup. UII is
     * unique in the database and is the first column of HEI Management, so the
     * login can be read straight off the screen.
     *
     * Still routed through makeUniqueEmail() so there is only one uniqueness
     * guard in this class; in practice it never appends a suffix, since UIIs are
     * unique and the staff emails above are alphabetic only.
     */
    private function generateEmailFromHeiUii(string $uii): string
    {
        // Hyphens and dots are legal in a local part; anything else is dropped.
        $local = preg_replace('/[^a-z0-9.-]/', '', strtolower(trim($uii)));

        return $this->makeUniqueEmail($local !== '' ? $local : 'hei');
    }

    /**
     * Ensure email uniqueness by appending a number suffix for duplicates.
     */
    private function makeUniqueEmail(string $base): string
    {
        $email = $base.'@gmail.com';

        if (! in_array($email, $this->usedEmails)) {
            $this->usedEmails[] = $email;

            return $email;
        }

        $counter = 2;
        while (in_array($base.$counter.'@gmail.com', $this->usedEmails)) {
            $counter++;
        }

        $email = $base.$counter.'@gmail.com';
        $this->usedEmails[] = $email;

        return $email;
    }
}
