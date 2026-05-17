import React, { useState, useMemo, useEffect } from "react";
import { driveCandidates } from "@/lib/driveLink";

// Tries each candidate URL in order; on error, advances to the next.
// Finally falls back to the `fallback` prop.
export const SmartImage = ({ src, alt, fallback, className = "", testId }) => {
    const candidates = useMemo(() => driveCandidates(src), [src]);
    const [idx, setIdx] = useState(0);

    useEffect(() => { setIdx(0); }, [src]);

    const finalSrc = idx < candidates.length ? candidates[idx] : fallback;
    return (
        <img
            src={finalSrc}
            alt={alt}
            data-testid={testId}
            onError={() => setIdx(i => i + 1)}
            className={className}
            loading="lazy"
            referrerPolicy="no-referrer"
        />
    );
};
