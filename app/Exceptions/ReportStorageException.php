<?php

declare(strict_types=1);

namespace App\Exceptions;

use RuntimeException;

/**
 * The generated report could not be persisted — the disk rejected the write or
 * could not be reached. Distinguished from a generic failure so the user is
 * told to contact an administrator instead of pointlessly retrying.
 */
class ReportStorageException extends RuntimeException
{
}
