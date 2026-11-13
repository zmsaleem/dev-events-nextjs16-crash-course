'use client';

import React from 'react'
import Link from "next/link";
import Image from "next/image";
import posthog from "posthog-js";

const isPostHogConfigured = Boolean(
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN &&
    process.env.NEXT_PUBLIC_POSTHOG_HOST
)

interface Props {
    title: string;
    image: string;
    slug: string;
    location: string;
    date: string;
    time: string;
}

const EventCard = ({ title, image, slug, location, date, time}: Props) => {
    return (
        <Link
            href={`/events/${slug}`}
            id="event-card"
            onClick={() => {
                if (isPostHogConfigured) {
                    posthog.capture("event_selected", { event_slug: slug })
                }
            }}
        >
            <Image src={image} alt={title} width={410} height={300} className="poster" />

            <div className="flex flex-rom gap-2">
                <Image src="/icons/pin.svg" alt="location" width={14} height={14} />
                <p>{location}</p>
            </div>

            <p className="title">{title}</p>

            <div className="datetime">
                <Image src="/icons/calendar.svg" alt="date" width={14} height={14} />
                <p>{date}</p>
            </div>
            <div>
                <Image src="/icons/clock.svg" alt="time" width={14} height={14} />
                <p>{time}</p>
            </div>
        </Link>
    )
}
export default EventCard
