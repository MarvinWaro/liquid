<?php

declare(strict_types=1);

namespace App\Exceptions;

/**
 * A previously validated import is no longer safe to execute.
 *
 * Messages from this exception are intentionally operator-facing and may be
 * persisted on the import batch. Unexpected exceptions remain generic.
 */
class LiquidationImportValidationException extends \RuntimeException
{
}
