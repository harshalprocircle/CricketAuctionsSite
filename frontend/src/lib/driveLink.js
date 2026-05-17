// Convert a Google Drive shareable link into one or more direct viewable image URLs.
// Returns an ORDERED LIST of candidate URLs to try (SmartImage walks the list on error):
//   1. https://lh3.googleusercontent.com/d/{ID}=w1000   (most reliable; what Drive web uses)
//   2. https://drive.google.com/thumbnail?id={ID}&sz=w1000
//   3. https://drive.google.com/uc?export=view&id={ID}
// For non-drive URLs, returns the URL as-is (single-item list).
// Empty/invalid -> empty list; caller falls back to its placeholder.

export function extractDriveFileId(rawUrl) {
    if (!rawUrl || typeof rawUrl !== "string") return null;
    const url = rawUrl.trim();
    if (!url) return null;
    const patterns = [
        /\/file\/d\/([a-zA-Z0-9_-]+)/, // /file/d/{id}/...
        /[?&]id=([a-zA-Z0-9_-]+)/,     // ?id={id}
        /\/d\/([a-zA-Z0-9_-]+)/,       // /d/{id}/
    ];
    for (const p of patterns) {
        const m = url.match(p);
        if (m && m[1]) return m[1];
    }
    if (/^[a-zA-Z0-9_-]{20,}$/.test(url)) return url;
    return null;
}

export function driveCandidates(rawUrl) {
    if (!rawUrl || typeof rawUrl !== "string") return [];
    const url = rawUrl.trim();
    if (!url) return [];

    // Non-Drive URL → use as-is
    if (/^https?:\/\//i.test(url) && !/drive\.google\.com|docs\.google\.com/i.test(url)) {
        return [url];
    }

    const id = extractDriveFileId(url);
    if (!id) return [];

    return [
        `https://lh3.googleusercontent.com/d/${id}=w1000`,
        `https://drive.google.com/thumbnail?id=${id}&sz=w1000`,
        `https://drive.google.com/uc?export=view&id=${id}`,
    ];
}

// Back-compat: previous callers expected a single string.
export function toDirectImageUrl(rawUrl, fallback = "") {
    const list = driveCandidates(rawUrl);
    return list[0] || fallback;
}

export const PLAYER_FALLBACK =
    "https://images.unsplash.com/photo-1663832476765-d683c3789ac0?crop=entropy&cs=srgb&fm=jpg&w=800&q=80";

export const TEAM_FALLBACK =
    "https://images.unsplash.com/photo-1761325970487-05c2541653eb?crop=entropy&cs=srgb&fm=jpg&w=400&q=80";
