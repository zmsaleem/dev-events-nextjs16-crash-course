import mongoose, { Mongoose } from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    throw new Error(
        "Please define the MONGODB_URI environment variable inside .env.local"
    );
}

/**
 * Shape of the cached connection object.
 * - `conn` holds the established Mongoose instance.
 * - `promise` holds the in-flight connection attempt so concurrent
 *   callers share a single connection instead of opening several.
 */
interface MongooseCache {
    conn: Mongoose | null;
    promise: Promise<Mongoose> | null;
}

/**
 * Extend the Node.js global type so TypeScript knows about our cache.
 * In development, Next.js hot-reloads modules, which would otherwise
 * create a new connection on every reload. Storing the cache on
 * `globalThis` lets it survive those reloads.
 */
declare global {
    // eslint-disable-next-line no-var
    var mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = globalThis.mongooseCache ?? {
    conn: null,
    promise: null,
};

globalThis.mongooseCache = cached;

/**
 * Connects to MongoDB and returns the Mongoose instance.
 * Reuses an existing connection (or pending connection attempt) when available.
 */
export async function connectToDatabase(): Promise<Mongoose> {
    // Return the existing connection if we already have one.
    if (cached.conn) {
        return cached.conn;
    }

    // Start a new connection only if one isn't already in progress.
    if (!cached.promise) {
        cached.promise = mongoose.connect(MONGODB_URI as string, {
            // Disable buffering so operations fail fast when not connected,
            // rather than silently queuing.
            bufferCommands: false,
        });
    }

    try {
        cached.conn = await cached.promise;
    } catch (error) {
        // Reset the promise so the next call can retry after a failure.
        cached.promise = null;
        throw error;
    }

    return cached.conn;
}

export default connectToDatabase;