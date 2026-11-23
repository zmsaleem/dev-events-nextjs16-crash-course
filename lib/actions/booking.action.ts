'use server'

import connectToDatabase from "@/lib/mongodb";
import {Booking} from "@/database";

export const createBooking = async ({ eventId, email}: { eventId: string; email: string }) => {
    try {
        await connectToDatabase();
        await Booking.create({ eventId, email });

        return { success: true};
    } catch(e) {
        console.error('create booking failed', e);
        return { success: false};
    }
}