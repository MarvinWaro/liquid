<?php

namespace App\Http\Controllers;

use App\Models\Template;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class TemplateController extends Controller
{
    private const DISK = 's3';
    private const STORAGE_PATH = 'templates';
    private const MAX_FILE_SIZE_KB = 5120; // 5MB

    public function index(): Response
    {
        if (!auth()->user()->hasPermission('view_templates')) {
            abort(403, 'Unauthorized action.');
        }

        $templates = Template::with('uploader:id,name')
            ->orderBy('name')
            ->get();

        return Inertia::render('templates/index', [
            'templates' => $templates,
            'canCreate' => auth()->user()->hasPermission('create_templates'),
            'canEdit'   => auth()->user()->hasPermission('edit_templates'),
            'canDelete' => auth()->user()->hasPermission('delete_templates'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        if (!auth()->user()->hasPermission('create_templates')) {
            abort(403, 'Unauthorized action.');
        }

        $validated = $request->validate([
            'name'        => 'required|string|max:255',
            'category'    => 'nullable|string|max:100',
            'description' => 'nullable|string|max:1000',
            'is_active'   => 'required|boolean',
            'file'        => 'required|file|max:' . self::MAX_FILE_SIZE_KB,
        ]);

        $file = $request->file('file');

        Template::create([
            'name'              => $validated['name'],
            'category'          => $validated['category'] ?: null,
            'description'       => $validated['description'] ?: null,
            'is_active'         => $validated['is_active'],
            'file_path'         => $file->store(self::STORAGE_PATH, self::DISK),
            'original_filename' => $file->getClientOriginalName(),
            'file_size'         => $file->getSize(),
            'mime_type'         => $file->getMimeType() ?? 'application/octet-stream',
            'uploaded_by'       => auth()->id(),
        ]);

        return redirect()->back()->with('success', 'Template created successfully.');
    }

    public function update(Request $request, Template $template): RedirectResponse
    {
        if (!auth()->user()->hasPermission('edit_templates')) {
            abort(403, 'Unauthorized action.');
        }

        $validated = $request->validate([
            'name'        => 'required|string|max:255',
            'category'    => 'nullable|string|max:100',
            'description' => 'nullable|string|max:1000',
            'is_active'   => 'required|boolean',
            'file'        => 'nullable|file|max:' . self::MAX_FILE_SIZE_KB,
        ]);

        $attributes = [
            'name'        => $validated['name'],
            'category'    => $validated['category'] ?: null,
            'description' => $validated['description'] ?: null,
            'is_active'   => $validated['is_active'],
        ];

        if ($request->hasFile('file')) {
            $file = $request->file('file');
            $oldPath = $template->file_path;

            $attributes['file_path']         = $file->store(self::STORAGE_PATH, self::DISK);
            $attributes['original_filename'] = $file->getClientOriginalName();
            $attributes['file_size']         = $file->getSize();
            $attributes['mime_type']         = $file->getMimeType() ?? 'application/octet-stream';

            $template->update($attributes);

            if ($oldPath) {
                Storage::disk(self::DISK)->delete($oldPath);
            }
        } else {
            $template->update($attributes);
        }

        return redirect()->back()->with('success', 'Template updated successfully.');
    }

    public function destroy(Template $template): RedirectResponse
    {
        if (!auth()->user()->hasPermission('delete_templates')) {
            abort(403, 'Unauthorized action.');
        }

        $path = $template->file_path;
        $template->delete();

        if ($path) {
            Storage::disk(self::DISK)->delete($path);
        }

        return redirect()->back()->with('success', 'Template deleted successfully.');
    }

    public function download(Template $template): StreamedResponse
    {
        if (!auth()->user()->hasPermission('view_templates')) {
            abort(403, 'Unauthorized action.');
        }

        if (!Storage::disk(self::DISK)->exists($template->file_path)) {
            abort(404, 'File not found.');
        }

        return Storage::disk(self::DISK)->download($template->file_path, $template->original_filename);
    }
}
