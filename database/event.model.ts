import { Schema, model, models, Model, SchemaTypeOptions } from "mongoose";

export const EVENT_MODES = ["online", "offline", "hybrid"] as const;
export type EventMode = (typeof EVENT_MODES)[number];

export interface IEvent {
    title: string;
    slug: string;
    description: string;
    overview: string;
    image: string;
    venue: string;
    location: string;
    date: string; // normalized to YYYY-MM-DD
    time: string; // normalized to 24-hour HH:mm
    mode: EventMode;
    audience: string;
    agenda: string[];
    organizer: string;
    tags: string[];
    createdAt: Date;
    updatedAt: Date;
}

// Trimmed string that rejects empty and whitespace-only values.
const requiredString = (label: string): SchemaTypeOptions<string> => ({
    type: String,
    required: [true, `${label} is required`],
    trim: true,
});

// Array that must contain at least one non-empty item.
const requiredStringArray = (label: string): SchemaTypeOptions<string[]> => ({
    type: [String],
    required: [true, `${label} is required`],
    validate: {
        validator: (items: string[]) =>
            items.length > 0 && items.every((item) => item.trim().length > 0),
        message: `${label} must contain at least one non-empty item`,
    },
});

const eventSchema = new Schema<IEvent>(
    {
        title: requiredString("Title"),
        // Not marked required: it is generated in the pre-save hook, which runs after validation.
        slug: { type: String, lowercase: true, trim: true },
        description: requiredString("Description"),
        overview: requiredString("Overview"),
        image: requiredString("Image"),
        venue: requiredString("Venue"),
        location: requiredString("Location"),
        date: requiredString("Date"),
        time: requiredString("Time"),
        mode: {
            type: String,
            enum: { values: EVENT_MODES, message: "Mode must be online, offline or hybrid" },
            required: [true, "Mode is required"],
            lowercase: true,
            trim: true,
        },
        audience: requiredString("Audience"),
        agenda: requiredStringArray("Agenda"),
        organizer: requiredString("Organizer"),
        tags: requiredStringArray("Tags"),
    },
    { timestamps: true } // adds createdAt and updatedAt automatically
);

// Unique index guarantees one event per slug.
eventSchema.index({ slug: 1 }, { unique: true });

/** Converts a title into a URL-friendly slug, e.g. "React Conf 2026!" -> "react-conf-2026". */
function slugify(title: string): string {
    return title
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "") // strip diacritics
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-") // collapse anything non-alphanumeric into one hyphen
        .replace(/^-+|-+$/g, ""); // trim leading/trailing hyphens
}

/** Validates a date string and returns it as YYYY-MM-DD. */
function normalizeDate(value: string): string {
    const isoDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
        throw new Error(`Invalid date: "${value}"`);
    }

    const iso = parsed.toISOString().slice(0, 10);
    // For plain ISO dates, the round trip rejects impossible dates like 2026-02-31.
    if (isoDateOnly && iso !== value) {
        throw new Error(`Invalid date: "${value}"`);
    }
    return iso;
}

/** Validates a time string ("9:00", "09:00", "2:30 PM") and returns 24-hour HH:mm. */
function normalizeTime(value: string): string {
    const match = /^(\d{1,2}):(\d{2})\s*(am|pm)?$/i.exec(value.trim());
    if (!match) {
        throw new Error(`Invalid time: "${value}"`);
    }

    let hours = Number(match[1]);
    const minutes = Number(match[2]);
    const meridiem = match[3]?.toLowerCase();

    const hoursValid = meridiem ? hours >= 1 && hours <= 12 : hours <= 23;
    if (!hoursValid || minutes > 59) {
        throw new Error(`Invalid time: "${value}"`);
    }

    // Convert 12-hour clock to 24-hour clock.
    if (meridiem === "pm" && hours !== 12) hours += 12;
    if (meridiem === "am" && hours === 12) hours = 0;

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

eventSchema.pre("save", async function () {
    // Regenerate the slug only when the title is new or has changed.
    if (this.isModified("title") || !this.slug) {
        this.slug = slugify(this.title);
    }

    // Normalize only the fields that changed to avoid redundant work.
    if (this.isModified("date")) {
        this.date = normalizeDate(this.date);
    }
    if (this.isModified("time")) {
        this.time = normalizeTime(this.time);
    }
});

// Reuse the compiled model during hot reloads to avoid OverwriteModelError.
const Event: Model<IEvent> =
    (models.Event as Model<IEvent> | undefined) ?? model<IEvent>("Event", eventSchema);

export default Event;