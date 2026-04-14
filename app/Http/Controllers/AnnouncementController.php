<?php

namespace App\Http\Controllers;

use App\Models\Announcement;
use App\Models\LiquidationStatus;
use App\Models\Program;
use App\Models\Region;
use App\Services\AnnouncementImageService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class AnnouncementController extends Controller
{
    // ---------------------------------------------------------------------
    // Landing page (honor / shame boards) — unchanged
    // ---------------------------------------------------------------------

    public function welcome(Request $request)
    {
        $regionId       = $request->query('region');
        $programFilter  = $request->query('program');

        $programs   = Program::select('id', 'name', 'code', 'parent_id')
            ->orderBy('name')
            ->get();
        $programIds = $this->resolveProgramFilter($programFilter, $programs);

        [$honorBoard, $shameBoard] = $this->getBoards($regionId, null, $programIds, false);

        $regions = Region::select('id', 'name', 'code')->orderBy('name')->get();

        return Inertia::render('welcome', [
            'honorBoard' => $honorBoard,
            'shameBoard' => $shameBoard,
            'regions'    => $regions,
            'programs'   => $programs,
            'filters'    => array_filter([
                'region'  => $regionId,
                'program' => $programFilter,
            ]),
        ]);
    }

    private function resolveProgramFilter(?string $value, $programs): ?array
    {
        if (!$value || $value === 'all') {
            return null;
        }

        $unifastCodes = ['TES', 'TDP'];
        $unifastParentIds = $programs
            ->whereNull('parent_id')
            ->filter(fn ($p) => in_array(strtoupper($p->code ?? ''), $unifastCodes, true))
            ->pluck('id');

        if ($value === 'unifast') {
            $childIds = $programs->whereIn('parent_id', $unifastParentIds)->pluck('id');
            return $unifastParentIds->concat($childIds)->unique()->values()->all() ?: null;
        }

        if ($value === 'stufaps') {
            return $programs
                ->reject(fn ($p) => $p->parent_id === null && in_array(strtoupper($p->code ?? ''), $unifastCodes, true))
                ->pluck('id')
                ->values()
                ->all() ?: null;
        }

        $program = $programs->firstWhere('id', $value);
        if (!$program) {
            return [$value];
        }

        if ($program->parent_id === null) {
            $childIds = $programs->where('parent_id', $program->id)->pluck('id');
            return collect([$program->id])->concat($childIds)->unique()->values()->all();
        }

        return [$program->id];
    }

    private function getBoards(
        ?string $regionId,
        ?string $heiId,
        ?array $programIds,
        bool $excludeSubPrograms
    ): array {
        $query = DB::table('liquidations')
            ->join('liquidation_financials', 'liquidations.id', '=', 'liquidation_financials.liquidation_id')
            ->leftJoin('rc_note_statuses', 'liquidations.rc_note_status_id', '=', 'rc_note_statuses.id')
            ->leftJoin('heis', 'liquidations.hei_id', '=', 'heis.id')
            ->leftJoin('regions', 'heis.region_id', '=', 'regions.id')
            ->whereNull('liquidations.deleted_at');

        $voidedId = LiquidationStatus::voided()?->id;
        $fullyLiquidatedId = LiquidationStatus::fullyLiquidated()?->id;

        if ($voidedId) {
            $query->where(function ($q) use ($voidedId) {
                $q->where('liquidations.liquidation_status_id', '!=', $voidedId)
                  ->orWhereNull('liquidations.liquidation_status_id');
            });
        }

        if ($regionId) {
            $query->where('heis.region_id', $regionId);
        }
        if ($heiId) {
            $query->where('liquidations.hei_id', $heiId);
        }
        if ($programIds) {
            $query->whereIn('liquidations.program_id', $programIds);
        }
        if ($excludeSubPrograms) {
            $subIds = Program::whereNotNull('parent_id')->pluck('id');
            if ($subIds->isNotEmpty()) {
                $query->whereNotIn('liquidations.program_id', $subIds);
            }
        }

        $fullyLiquidatedClause = $fullyLiquidatedId
            ? "CASE WHEN liquidations.liquidation_status_id = '{$fullyLiquidatedId}' THEN COALESCE(liquidation_financials.amount_received, 0) ELSE COALESCE(liquidation_financials.amount_liquidated, 0) END"
            : 'COALESCE(liquidation_financials.amount_liquidated, 0)';

        $rows = $query
            ->select(
                'liquidations.hei_id',
                'heis.name as hei_name',
                'heis.uii as hei_uii',
                'regions.name as region_name'
            )
            ->selectRaw('COALESCE(SUM(liquidation_financials.amount_received), 0) as total_disbursements')
            ->selectRaw("COALESCE(SUM({$fullyLiquidatedClause}), 0) as total_liquidated")
            ->selectRaw("COALESCE(SUM(CASE WHEN rc_note_statuses.code = 'FOR_ENDORSEMENT' AND (liquidations.liquidation_status_id != ? OR liquidations.liquidation_status_id IS NULL) THEN COALESCE(liquidation_financials.amount_received, 0) - COALESCE(liquidation_financials.amount_liquidated, 0) ELSE 0 END), 0) as for_endorsement", $fullyLiquidatedId ? [$fullyLiquidatedId] : ['__none__'])
            ->selectRaw("ROUND((COALESCE(SUM({$fullyLiquidatedClause}), 0) + COALESCE(SUM(CASE WHEN rc_note_statuses.code = 'FOR_ENDORSEMENT' AND (liquidations.liquidation_status_id != ? OR liquidations.liquidation_status_id IS NULL) THEN COALESCE(liquidation_financials.amount_received, 0) - COALESCE(liquidation_financials.amount_liquidated, 0) ELSE 0 END), 0)) / NULLIF(COALESCE(SUM(liquidation_financials.amount_received), 0), 0) * 100, 2) as pct_liquidation", $fullyLiquidatedId ? [$fullyLiquidatedId] : ['__none__'])
            ->selectRaw('COUNT(DISTINCT liquidations.id) as liquidation_count')
            ->groupBy('liquidations.hei_id', 'heis.name', 'heis.uii', 'regions.name')
            ->get();

        $honor = [];
        $shame  = [];

        foreach ($rows as $row) {
            $pct = (float) $row->pct_liquidation;
            $item = [
                'hei_id'              => $row->hei_id,
                'hei_name'            => $row->hei_name,
                'hei_uii'             => $row->hei_uii,
                'region_name'         => $row->region_name,
                'total_disbursements' => (float) $row->total_disbursements,
                'total_liquidated'    => (float) $row->total_liquidated,
                'pct_liquidation'     => $pct,
                'liquidation_count'   => (int) $row->liquidation_count,
            ];

            if ($pct >= 100) {
                $honor[] = $item;
            } else {
                $shame[] = $item;
            }
        }

        usort($honor, fn($a, $b) => strcmp($a['hei_name'], $b['hei_name']));
        usort($shame, fn($a, $b) => $a['pct_liquidation'] <=> $b['pct_liquidation']);

        return [$honor, $shame];
    }

    // ---------------------------------------------------------------------
    // Announcement CRUD
    // ---------------------------------------------------------------------

    public function index()
    {
        $user = auth()->user();
        $userRole = $user->role?->name;
        $isAdmin = in_array($userRole, ['Super Admin', 'Admin'], true);
        $isHei = $userRole === 'HEI';

        $query = Announcement::with('author:id,name');

        // Only Admin/Super Admin can see scheduled + expired posts (for management).
        // Everyone else (RC, STUFAPS Focal, HEI) sees only currently-live posts.
        if (!$isAdmin) {
            $query->visible();
            if ($isHei) {
                $query->where('show_to_hei', true);
            }
        }

        $posts = $query
            ->orderByDesc('is_featured')
            ->orderByDesc('published_at')
            ->get()
            ->map(fn (Announcement $a) => $this->toListPayload($a));

        return Inertia::render('announcement', [
            'posts' => $posts,
            'permissions' => [
                'create' => $user?->hasPermission('create_announcements') ?? false,
                'edit'   => $user?->hasPermission('edit_announcements') ?? false,
                'delete' => $user?->hasPermission('delete_announcements') ?? false,
            ],
        ]);
    }

    public function create()
    {
        abort_unless(auth()->user()?->hasPermission('create_announcements'), 403);

        return Inertia::render('announcement/create');
    }

    public function store(Request $request, AnnouncementImageService $images)
    {
        abort_unless(auth()->user()?->hasPermission('create_announcements'), 403);

        $data = $this->validatePayload($request);

        $paths = null;
        if ($request->hasFile('cover')) {
            $paths = $images->store($request->file('cover'));
        }

        $announcement = Announcement::create([
            'title'                => $data['title'],
            'slug'                 => Announcement::uniqueSlug($data['title']),
            'category'             => $data['category'] ?? 'news',
            'tag_color'            => $data['tag_color'] ?? null,
            'excerpt'              => $data['excerpt'] ?? null,
            'content'              => $data['content'],
            'is_featured'          => (bool) ($data['is_featured'] ?? false),
            'show_to_hei'          => (bool) ($data['show_to_hei'] ?? true),
            'published_at'         => $this->toUtc($data['published_at'] ?? null) ?? now(),
            'end_date'             => $this->toUtc($data['end_date'] ?? null),
            'created_by'           => auth()->id(),
            'cover_original_path'  => $paths['original'] ?? null,
            'cover_display_path'   => $paths['display']  ?? null,
            'cover_thumb_path'     => $paths['thumb']    ?? null,
            'cover_focal_x'        => $this->focal($data['cover_focal_x'] ?? null),
            'cover_focal_y'        => $this->focal($data['cover_focal_y'] ?? null),
        ]);

        if ($announcement->is_featured) {
            Announcement::where('id', '!=', $announcement->id)
                ->where('is_featured', true)
                ->update(['is_featured' => false]);
        }

        return redirect()->route('announcements.index')->with('success', 'Announcement posted.');
    }

    public function show(Announcement $announcement)
    {
        $user = auth()->user();
        $userRole = $user?->role?->name;
        $isAdmin = in_array($userRole, ['Super Admin', 'Admin'], true);

        if (!$isAdmin) {
            $now = now();
            $notYetPublished = $announcement->published_at && $announcement->published_at->gt($now);
            $hasExpired      = $announcement->end_date && $announcement->end_date->lt($now);
            $hiddenFromHei   = $userRole === 'HEI' && !$announcement->show_to_hei;
            abort_if($notYetPublished || $hasExpired || $hiddenFromHei, 404);
        }

        $announcement->load('author:id,name');

        $commentQuery = \App\Models\AnnouncementComment::where('announcement_id', $announcement->id)
            ->whereNull('parent_id')
            ->with(['user.role', 'reactions', 'allReplies.user.role', 'allReplies.reactions', 'allReplies.allReplies.user.role', 'allReplies.allReplies.reactions'])
            ->orderBy('created_at');

        $totalComments = $commentQuery->count();
        $commentPage = $commentQuery->paginate(10);
        $viewerId = $user?->id;
        $comments = collect($commentPage->items())->map(fn ($c) => $c->format($viewerId))->values()->all();

        $viewer = auth()->user();
        $isPrivileged = in_array($viewer?->role?->name, ['Super Admin', 'Admin'], true);

        return Inertia::render('announcement/show', [
            'post' => $this->toDetailPayload($announcement),
            'comments'          => $comments,
            'comments_has_more' => $commentPage->hasMorePages(),
            'comments_total'    => $totalComments,
            'viewer' => [
                'id'            => $viewer?->id,
                'name'          => $viewer?->name,
                'avatar_url'    => $viewer?->avatar_url,
                'can_moderate'  => $isPrivileged,
            ],
            'permissions' => [
                'edit'   => $viewer?->hasPermission('edit_announcements') ?? false,
                'delete' => $viewer?->hasPermission('delete_announcements') ?? false,
            ],
        ]);
    }

    public function edit(Announcement $announcement)
    {
        abort_unless(auth()->user()?->hasPermission('edit_announcements'), 403);

        return Inertia::render('announcement/edit', [
            'post' => $this->toDetailPayload($announcement),
        ]);
    }

    public function update(Request $request, Announcement $announcement, AnnouncementImageService $images)
    {
        abort_unless(auth()->user()?->hasPermission('edit_announcements'), 403);

        $data = $this->validatePayload($request, updating: true);

        $payload = [
            'title'        => $data['title'],
            'category'     => $data['category'] ?? $announcement->category,
            'tag_color'    => $data['tag_color'] ?? null,
            'excerpt'      => $data['excerpt'] ?? null,
            'content'      => $data['content'],
            'is_featured'  => (bool) ($data['is_featured'] ?? false),
            'show_to_hei'  => (bool) ($data['show_to_hei'] ?? true),
            'published_at' => $this->toUtc($data['published_at'] ?? null) ?? $announcement->published_at ?? now(),
            'end_date'     => $this->toUtc($data['end_date'] ?? null),
        ];

        if ($data['title'] !== $announcement->title) {
            $payload['slug'] = Announcement::uniqueSlug($data['title'], $announcement->id);
        }

        if ($request->hasFile('cover')) {
            $announcement->deleteCoverFiles();
            $paths = $images->store($request->file('cover'));
            $payload['cover_original_path'] = $paths['original'];
            $payload['cover_display_path']  = $paths['display'];
            $payload['cover_thumb_path']    = $paths['thumb'];
            // New cover → reset focal to center unless caller supplied one.
            $payload['cover_focal_x'] = $this->focal($data['cover_focal_x'] ?? null);
            $payload['cover_focal_y'] = $this->focal($data['cover_focal_y'] ?? null);
        } elseif ($request->boolean('remove_cover')) {
            $announcement->deleteCoverFiles();
            $payload['cover_original_path'] = null;
            $payload['cover_display_path']  = null;
            $payload['cover_thumb_path']    = null;
            $payload['cover_focal_x'] = 50;
            $payload['cover_focal_y'] = 50;
        } elseif (array_key_exists('cover_focal_x', $data) || array_key_exists('cover_focal_y', $data)) {
            // Focal adjusted without replacing the image.
            $payload['cover_focal_x'] = $this->focal($data['cover_focal_x'] ?? $announcement->cover_focal_x);
            $payload['cover_focal_y'] = $this->focal($data['cover_focal_y'] ?? $announcement->cover_focal_y);
        }

        $announcement->update($payload);

        if ($announcement->is_featured) {
            Announcement::where('id', '!=', $announcement->id)
                ->where('is_featured', true)
                ->update(['is_featured' => false]);
        }

        $slug = $announcement->slug;
        return redirect()->route('announcements.show', $slug)->with('success', 'Announcement updated.');
    }

    public function destroy(Announcement $announcement)
    {
        abort_unless(auth()->user()?->hasPermission('delete_announcements'), 403);

        $announcement->deleteCoverFiles();
        $announcement->delete();

        return redirect()->route('announcements.index')->with('success', 'Announcement deleted.');
    }

    // ---------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------

    private function validatePayload(Request $request, bool $updating = false): array
    {
        return $request->validate([
            'title'         => ['required', 'string', 'max:255'],
            'category'      => ['nullable', 'string', 'in:news,event,important,update'],
            'tag_color'     => ['nullable', 'string', 'in:blue,emerald,violet,amber,sky,rose'],
            'excerpt'       => ['nullable', 'string', 'max:500'],
            'content'       => ['required', 'string'],
            'is_featured'   => ['nullable', 'boolean'],
            'show_to_hei'   => ['nullable', 'boolean'],
            'published_at'  => ['nullable', 'date'],
            'end_date'      => ['nullable', 'date'],
            'cover'         => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:8192'],
            'remove_cover'  => ['nullable', 'boolean'],
            'cover_focal_x' => ['nullable', 'integer', 'between:0,100'],
            'cover_focal_y' => ['nullable', 'integer', 'between:0,100'],
        ]);
    }

    /**
     * Clamp a focal-point coordinate to [0, 100]. Falls back to 50 (center).
     */
    private function focal(mixed $value): int
    {
        if ($value === null || $value === '') {
            return 50;
        }
        return max(0, min(100, (int) $value));
    }

    /**
     * Parse a datetime-local value (timezone-naive) as Asia/Manila,
     * convert to UTC for storage so scope comparisons with now() work.
     */
    private function toUtc(?string $value): ?Carbon
    {
        if (!$value) {
            return null;
        }
        return Carbon::parse($value, 'Asia/Manila')->utc();
    }

    /**
     * Format a UTC datetime back to Asia/Manila ISO for the frontend datetime-local input.
     */
    private function toLocalIso(?\Carbon\Carbon $dt): ?string
    {
        if (!$dt) {
            return null;
        }
        return $dt->copy()->setTimezone('Asia/Manila')->format('Y-m-d\TH:i');
    }

    private function toListPayload(Announcement $a): array
    {
        // Determine visibility status for admin badge
        $status = 'live';
        if ($a->end_date && $a->end_date->lt(now())) {
            $status = 'expired';
        } elseif ($a->published_at && $a->published_at->gt(now())) {
            $status = 'scheduled';
        }

        return [
            'id'            => $a->id,
            'slug'          => $a->slug,
            'title'         => $a->title,
            'category'      => $a->category,
            'tag_color'     => $a->tag_color,
            'excerpt'       => $a->excerpt,
            'is_featured'   => $a->is_featured,
            'show_to_hei'   => $a->show_to_hei,
            'status'        => $status,
            'published_at'  => $a->published_at?->copy()->setTimezone('Asia/Manila')->toIso8601String(),
            'end_date'      => $a->end_date?->copy()->setTimezone('Asia/Manila')->toIso8601String(),
            'cover_thumb'   => $a->cover_thumb_url,
            'cover_display' => $a->cover_display_url,
            'cover_focal_x' => (int) ($a->cover_focal_x ?? 50),
            'cover_focal_y' => (int) ($a->cover_focal_y ?? 50),
            'author_name'   => $a->author?->name,
        ];
    }

    private function toDetailPayload(Announcement $a): array
    {
        return [
            'id'             => $a->id,
            'slug'           => $a->slug,
            'title'          => $a->title,
            'category'       => $a->category,
            'tag_color'      => $a->tag_color,
            'excerpt'        => $a->excerpt,
            'content'        => $a->content,
            'is_featured'    => $a->is_featured,
            'show_to_hei'    => $a->show_to_hei,
            'published_at'   => $this->toLocalIso($a->published_at),
            'end_date'       => $this->toLocalIso($a->end_date),
            'cover_thumb'    => $a->cover_thumb_url,
            'cover_display'  => $a->cover_display_url,
            'cover_original' => $a->cover_original_url,
            'cover_focal_x'  => (int) ($a->cover_focal_x ?? 50),
            'cover_focal_y'  => (int) ($a->cover_focal_y ?? 50),
            'author_name'    => $a->author?->name,
        ];
    }
}
