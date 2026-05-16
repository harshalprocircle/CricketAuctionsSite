import React, { useState, useMemo } from "react";
import { toDirectImageUrl } from "@/lib/driveLink";

export const SmartImage = ({ src, alt, fallback, className = "", testId }) => {
    const direct = useMemo(() => toDirectImageUrl(src, ""), [src]);
    const [errored, setErrored] = useState(false);
    const finalSrc = !errored && direct ? direct : fallback;
    return (
        <img
            src={finalSrc}
            alt={alt}
            data-testid={testId}
            onError={() => setErrored(true)}
            className={className}
            loading="lazy"
        />
    );
};
