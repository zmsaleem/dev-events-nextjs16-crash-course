import { Schema, model, models, Model, Types } from "mongoose";
import Event from "./event.model";

export interface IBooking {
    eventId: Types.ObjectId;
    email: string;
    createdAt: Date;
    updatedAt: Date;
}

// Pragmatic email format check: something@domain.tld with no spaces.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const bookingSchema = new Schema<IBooking>(
    {
        eventId: {
            type: Schema.Types.ObjectId,
            ref: "Event",
            required: [true, "Event ID is required"],
        },
        email: {
            type: String,
            required: [true, "Email is required"],
            trim: true,
            lowercase: true, // store consistently so lookups are case-insensitive
            validate: {
                validator: (value: string) => EMAIL_REGEX.test(value),
                message: "Email is not valid",
            },
        },
    },
    { timestamps: true } // adds createdAt and updatedAt automatically
);

// Speeds up queries such as "all bookings for this event".
bookingSchema.index({ eventId: 1 });

bookingSchema.pre("save", async function () {
    // Verify the referenced event exists, but only when eventId is new or changed.
    if (this.isNew || this.isModified("eventId")) {
        const eventExists = await Event.exists({ _id: this.eventId });
        if (!eventExists) {
            throw new Error(`Event with id ${this.eventId.toString()} does not exist`);
        }
    }
});

// Reuse the compiled model during hot reloads to avoid OverwriteModelError.
const Booking: Model<IBooking> =
    (models.Booking as Model<IBooking> | undefined) ??
    model<IBooking>("Booking", bookingSchema);

export default Booking;