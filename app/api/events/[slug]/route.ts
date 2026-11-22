import { NextRequest, NextResponse } from 'next/server';
import { Error as MongooseError } from 'mongoose';

import connectToDatabase from '@/lib/mongodb';
import Event from '@/database/event.model';

/** Shape of the dynamic route params. In Next.js 15+, params is a Promise. */
type RouteParams = {
    params: Promise<{ slug: string }>;
};

/** Standard error body returned by this route. */
type ErrorResponse = {
    message: string;
    error?: string;
};

/** Slugs: lowercase alphanumerics separated by single hyphens (e.g. "next-conf-2026"). */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SLUG_LENGTH = 200;

/**
 * GET /api/events/[slug]
 * Returns a single event matching the given slug.
 */
export async function GET(
    _req: NextRequest,
    { params }: RouteParams
): Promise<NextResponse> {
    try {
        const { slug } = await params;

        // Validate presence and type
        if (typeof slug !== 'string' || slug.trim().length === 0) {
            return NextResponse.json<ErrorResponse>(
                { message: 'Slug parameter is required.' },
                { status: 400 }
            );
        }

        // Normalize and validate format
        const normalizedSlug = slug.trim().toLowerCase();

        if (
            normalizedSlug.length > MAX_SLUG_LENGTH ||
            !SLUG_PATTERN.test(normalizedSlug)
        ) {
            return NextResponse.json<ErrorResponse>(
                {
                    message:
                        'Invalid slug format. Use lowercase letters, numbers, and single hyphens only.',
                },
                { status: 400 }
            );
        }

        await connectToDatabase();

        // lean() returns a plain object (faster, serializable, no Mongoose document overhead)
        const event = await Event.findOne({ slug: normalizedSlug }).lean().exec();

        if (!event) {
            return NextResponse. json<ErrorResponse>(
                { message: `Event with slug "${normalizedSlug}" not found.` },
                { status: 404 }
            );
        }

        return NextResponse.json({ message: 'Event fetched successfully.', event }, { status: 200 });
    } catch (error: unknown) {
        // Log full details server-side only
        if (process.env.NODE_ENV === 'development') {
            console.error('[GET /api/events/[slug]] Error:', error);
        }

        // Mongoose cast/validation problems caused by bad input
        if (
            error instanceof MongooseError.CastError ||
            error instanceof MongooseError.ValidationError
        ) {
            return NextResponse.json<ErrorResponse>(
                { message: 'Invalid request data.' },
                { status: 400 }
            );
        }

        // Don't leak internal details in production
        const detail =
            process.env.NODE_ENV === 'development' && error instanceof Error
                ? error.message
                : undefined;

        return NextResponse.json<ErrorResponse>(
            { message: 'Failed to fetch event.', error: detail },
            { status: 500 }
        );
    }
}