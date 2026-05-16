// Convert any Google Drive shareable link into a direct viewable image URL.
// Supports formats:
//   https://drive.google.com/file/d/FILE_ID/view?usp=sharing
//   https://drive.google.com/open?id=FILE_ID
//   https://drive.google.com/uc?id=FILE_ID
//   https://drive.google.com/uc?export=view&id=FILE_ID
//   https://docs.google.com/uc?id=FILE_ID
// If the URL is not a Google Drive link, it is returned as-is.
// Empty / null / invalid -> returns the provided fallback (or "").
export function toDirectImageUrl(rawUrl, fallback = "") {
    if (!rawUrl || typeof rawUrl !== "string") return fallback;
    const url = rawUrl.trim();
    if (!url) return fallback;

    // Already a thumbnail/usercontent URL or non-drive URL
    if (/^https?:\/\//i.test(url) && !/drive\.google\.com|docs\.google\.com/i.test(url)) {
        return url;
    }

    // Extract FILE_ID
    let fileId = null;
    const patterns = [
        /\/file\/d\/([a-zA-Z0-9_-]+)/, // /file/d/{id}/...
        /[?&]id=([a-zA-Z0-9_-]+)/,     // ?id={id}
        /\/d\/([a-zA-Z0-9_-]+)/,       // /d/{id}/
    ];
    for (const p of patterns) {
        const m = url.match(p);
        if (m && m[1]) {
            fileId = m[1];
            break;
        }
    }
    if (!fileId) {
        // maybe user pasted just the id
        if (/^[a-zA-Z0-9_-]{20,}$/.test(url)) fileId = url;
    }
    if (!fileId) return fallback || url;

    // thumbnail endpoint renders reliably in <img> tags without auth
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
}

export const PLAYER_FALLBACK =
    "https://images.unsplash.com/photo-1663832476765-d683c3789ac0?crop=entropy&cs=srgb&fm=jpg&w=800&q=80";

export const TEAM_FALLBACK =
    "https://images.unsplash.com/photo-1761325970487-05c2541653eb?crop=entropy&cs=srgb&fm=jpg&w=400&q=80";
