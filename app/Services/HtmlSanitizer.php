<?php

namespace App\Services;

use HTMLPurifier;
use HTMLPurifier_Config;
use Illuminate\Support\Facades\File;

/**
 * Strips dangerous markup from rich-text submitted by users.
 *
 * Announcement bodies are stored as HTML and rendered with React's
 * dangerouslySetInnerHTML, so whatever survives here executes in the browser of
 * every reader — administrators included. Validating the field as 'string' is not
 * enough: the TipTap editor only shapes what the *form* sends, and a request can
 * be posted straight to the endpoint without going near the editor. Sanitizing on
 * save is therefore the real boundary.
 *
 * The allow-list below mirrors exactly what TipTap's StarterKit + Link extension
 * can produce, so legitimate formatting survives untouched and anything else —
 * script, style, iframe, event handlers like onerror, javascript: URLs — is dropped.
 */
class HtmlSanitizer
{
    /**
     * Tags and attributes TipTap can emit. Anything absent here is removed.
     *
     * Kept in sync with resources/js/components/tiptap-editor.tsx — if an
     * extension is added there (e.g. images or tables), widen this to match,
     * otherwise the new formatting will be silently stripped on save.
     */
    private const ALLOWED = 'p,br,strong,b,em,i,u,s,code,pre,'
        .'h1,h2,h3,h4,h5,h6,'
        .'ul,ol[start],li,blockquote,hr,'
        .'a[href|title]';

    private ?HTMLPurifier $purifier = null;

    /**
     * Return $html with only safe formatting left. Null/blank input yields ''.
     */
    public function clean(?string $html): string
    {
        if ($html === null || trim($html) === '') {
            return '';
        }

        return $this->purifier()->purify($html);
    }

    /**
     * Build the purifier once and reuse it — assembling the HTML definition is
     * the expensive part, so this is bound as a singleton in AppServiceProvider.
     */
    private function purifier(): HTMLPurifier
    {
        if ($this->purifier instanceof HTMLPurifier) {
            return $this->purifier;
        }

        $config = HTMLPurifier_Config::createDefault();

        $config->set('HTML.Allowed', self::ALLOWED);

        // Anything outside these schemes is dropped, which is what kills
        // javascript: and data: URLs hidden in an href.
        $config->set('URI.AllowedSchemes', [
            'http' => true,
            'https' => true,
            'mailto' => true,
        ]);

        // Links open in a new tab. Purifier pairs target with rel="noopener
        // noreferrer" itself, so the new tab cannot reach back into this one.
        $config->set('HTML.TargetBlank', true);
        $config->set('HTML.TargetNoopener', true);
        $config->set('HTML.TargetNoreferrer', true);

        // Without a writable path Purifier tries to cache inside vendor/, which
        // is read-only on most deploys and would emit a warning on every call.
        $config->set('Cache.SerializerPath', $this->cachePath());

        return $this->purifier = new HTMLPurifier($config);
    }

    private function cachePath(): string
    {
        $path = storage_path('framework/cache/htmlpurifier');

        if (! File::isDirectory($path)) {
            File::makeDirectory($path, 0755, true);
        }

        return $path;
    }
}
