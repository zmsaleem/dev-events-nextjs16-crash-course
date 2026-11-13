'use client';

import React from 'react'
import Image from"next/image";
import posthog from "posthog-js";

const isPostHogConfigured = Boolean(
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN &&
    process.env.NEXT_PUBLIC_POSTHOG_HOST
)

const ExploreBtn = () => {
    const handleExploreClick = () => {
        if (isPostHogConfigured) {
            posthog.capture("event_exploration_started")
        }
    }

    return (
        <button type="button" id="explore-btn" className="mt-7 mx-auto" onClick={handleExploreClick}>
            <a href="#events">
                Explore Events
            <Image src="/icons/arrow-down.svg" alt="arrow-down" width={24} height={24}/>
            </a>
        </button>
    )
}
export default ExploreBtn

