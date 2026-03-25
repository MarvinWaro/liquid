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
 * Temporary seeder for testing — creates dummy RC, STUFAPS Focal, and HEI users.
 * Remove this seeder before production deployment.
 */
class TestUserSeeder extends Seeder
{
    /** Track used emails to avoid duplicates. */
    private array $usedEmails = [];

    public function run(): void
    {
        $password = Hash::make('12345678');

        $rcRole = Role::where('name', 'Regional Coordinator')->firstOrFail();
        $stufapsRole = Role::where('name', 'STUFAPS Focal')->firstOrFail();
        $heiRole = Role::where('name', 'HEI')->firstOrFail();

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
            'Comprendio, Daven'          => ['CMSP'],
            'Erfe, Jeanly'               => ['CHED-TDP'],
            'Galamiton, Kia Zandra'      => ['MSRS', 'ACEF-GIAHEP', 'SIDA-SGP'],
            'Reformado, Melanie'          => ['COSCHO'],
            'Reginaldo, Ferlyn Jane N'   => ['COSCHO'],
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
            $email = $this->generateEmailFromHeiName($hei->name);
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
        $this->command->info("TestUserSeeder: {$staffCount} staff + {$heiCount} HEI users seeded (password: 12345678)");
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
     * Generate email from HEI name: "ACLC COLLEGE OF MARBEL" → "aclc@gmail.com"
     * Handles duplicates: "aclc@gmail.com", "aclc2@gmail.com", etc.
     */
    private function generateEmailFromHeiName(string $name): string
    {
        $firstWord = strtolower(explode(' ', trim($name))[0]);
        $firstWord = preg_replace('/[^a-z]/', '', $firstWord);

        // Fallback if first word becomes empty after cleanup
        if ($firstWord === '') {
            $firstWord = 'hei';
        }

        return $this->makeUniqueEmail($firstWord);
    }

    /**
     * Ensure email uniqueness by appending a number suffix for duplicates.
     */
    private function makeUniqueEmail(string $base): string
    {
        $email = $base . '@gmail.com';

        if (!in_array($email, $this->usedEmails)) {
            $this->usedEmails[] = $email;
            return $email;
        }

        $counter = 2;
        while (in_array($base . $counter . '@gmail.com', $this->usedEmails)) {
            $counter++;
        }

        $email = $base . $counter . '@gmail.com';
        $this->usedEmails[] = $email;
        return $email;
    }
}
