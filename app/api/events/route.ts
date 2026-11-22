import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary, UploadApiResponse } from "cloudinary";
import connectToDatabase from "@/lib/mongodb";
import Event from "@database/event.model";

// Cloudinary reports failures as plain objects ({ message, http_code }), not Error instances,
// so `e instanceof Error` alone loses the real message.
function getErrorMessage(e: unknown): string {
    if (e instanceof Error) return e.message;
    if (typeof e === "string") return e;
    if (typeof e === "object" && e !== null && "message" in e) {
        return String((e as { message: unknown }).message);
    }
    try {
        return JSON.stringify(e);
    } catch {
        return "Unknown";
    }
}

export async function GET() {
    try {
        await connectToDatabase();
        const events = await Event.find().sort({ createdAt: -1 });

        return NextResponse.json({ events }, { status: 200 });
    } catch (e) {
        return NextResponse.json({ message: "Event fetching failed", error: e }, { status: 500 });
    }
}

// Works with either CLOUDINARY_URL or the three separate env vars
function ensureCloudinaryConfigured(): boolean {
    const current = cloudinary.config();
    if (current.cloud_name && current.api_key && current.api_secret) return true;

    const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
    if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) {
        cloudinary.config({
            cloud_name: CLOUDINARY_CLOUD_NAME,
            api_key: CLOUDINARY_API_KEY,
            api_secret: CLOUDINARY_API_SECRET,
            secure: true,
        });
        return true;
    }
    return false;
}

// Accepts a JSON array string or repeated keys; returns clean, non-empty strings
function parseList(values: FormDataEntryValue[]): string[] {
    if (values.length > 1) {
        return values.map((v) => String(v).trim()).filter(Boolean);
    }
    const value = String(values[0] ?? "").trim();
    if (!value) return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed)
            ? parsed.map((v) => String(v).trim()).filter(Boolean)
            : [value];
    } catch {
        return [value];
    }
}


export async function POST(req: NextRequest) {
    try {
        await connectToDatabase();

        let formData: FormData;
        try {
            formData = await req.formData();
        } catch {
            return NextResponse.json({ message: "Invalid form data" }, { status: 400 });
        }

        // Trim key names so stray whitespace or newlines can't hide a field
        const entries = Array.from(formData.entries()).map(
            ([key, value]) => [key.trim(), value] as const
        );
        const getAll = (name: string) =>
            entries.filter(([key]) => key === name).map(([, value]) => value);
        const fields = Object.fromEntries(entries);

        // Image: either an uploaded file (sent to Cloudinary) or a ready-made URL
        let imageUrl: string;

        if (fields.image instanceof File) {
            if (fields.image.size === 0) {
                return NextResponse.json({ message: "Image file is empty" }, { status: 400 });
            }

            if (!ensureCloudinaryConfigured()) {
                console.error(
                    "Cloudinary is not configured. Set CLOUDINARY_URL (or CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET) in .env.local and restart the dev server."
                );
                return NextResponse.json(
                    {
                        message: "Image upload is not configured",
                        error: "Missing Cloudinary credentials",
                    },
                    { status: 500 }
                );
            }


            const buffer = Buffer.from(await fields.image.arrayBuffer());

            const uploadResult = await new Promise<UploadApiResponse>((resolve, reject) => {
                cloudinary.uploader
                    .upload_stream({ resource_type: "image", folder: "DevEvent" }, (error, result) => {
                        if (error || !result) return reject(error ?? new Error("Upload failed"));
                        resolve(result);
                    })
                    .end(buffer);
            });

            imageUrl = uploadResult.secure_url;
        } else if (typeof fields.image === "string" && fields.image.trim()) {
            imageUrl = fields.image.trim();
        } else {
            return NextResponse.json(
                { message: "Image is required (file upload or URL)" },
                { status: 400 }
            );
        }

        const createdEvent = await Event.create({
            ...fields,
            image: imageUrl,
            agenda: parseList(getAll("agenda")),
            tags: parseList(getAll("tags")),
        });

        return NextResponse.json(
            { message: "Event created successfully", event: createdEvent },
            { status: 201 }
        );
    } catch (e) {
        console.error("POST /api/events failed:", e);

        // Duplicate slug (same title already exists)
        if (typeof e === "object" && e !== null && (e as { code?: number }).code === 11000) {
            return NextResponse.json(
                { message: "An event with this title already exists" },
                { status: 409 }
            );
        }

        // Mongoose schema validation problems are the client's fault, not a server crash
        if (e instanceof Error && e.name === "ValidationError") {
            return NextResponse.json(
                { message: "Validation failed", error: e.message },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { message: "Event Creation Failed", error: getErrorMessage(e) },
            { status: 500 }
        );
    }
}