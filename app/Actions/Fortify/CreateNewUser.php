<?php

namespace App\Actions\Fortify;

use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Laravel\Fortify\Contracts\CreatesNewUsers;

class CreateNewUser implements CreatesNewUsers
{
    use PasswordValidationRules;

    /**
     * Validate and create a newly registered user.
     *
     * @param  array<string, string>  $input
     */
    public function create(array $input): User
    {
        Validator::make($input, [
            'hei_id' => ['required', 'exists:heis,id'],
            'name' => ['required', 'string', 'max:255'],
            'email' => [
                'required',
                'string',
                'email',
                'max:255',
                Rule::unique(User::class),
            ],
            'password' => $this->passwordRules(),
        ])->validate();

        // Get the HEI role (create if doesn't exist)
        $heiRole = Role::firstOrCreate(
            ['name' => 'HEI'],
            ['description' => 'Higher Education Institution user']
        );

        return User::create([
            'name' => $input['name'],
            'email' => $input['email'],
            'password' => $input['password'],
            'hei_id' => $input['hei_id'],
            'role_id' => $heiRole->id,
            'status' => 'inactive', // Set to inactive by default, admin must activate
        ]);
    }
}
