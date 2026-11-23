import React, { Suspense } from 'react'
import ExploreBtn from "@/components/ExploreBtn";
import EventCard from "@/components/EventCard";
import {IEvent} from "@/database";
import Event from "@database/event.model";
import connectToDatabase from "@/lib/mongodb";
import {cacheLife} from "next/cache";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL;

const EventList = async () => {
    'use cache';
    cacheLife('hours');

    await connectToDatabase();
    const events = JSON.parse(
        JSON.stringify(await Event.find().sort({ createdAt: -1 }).lean())
    );

    return (
        <ul className="events">
            {events.length > 0 && events.map((event: IEvent) => (
                <li key={event.slug} className="list-none">
                    <EventCard {...event} />
                </li>
            ))}
        </ul>
    )
}

const Page  = () => {
    return (
        <section>
            <h1 className="text-center">The Hub for Every Dev<br /> Event You Can't Miss</h1>
            <p className="text-center mt-5">Hackathons, Meetups, and Conferences, All in One Place</p>

            <ExploreBtn />

            <div className="mt-20 space-y-7">
                <h3>Featured Events</h3>

                <Suspense fallback={<p>Loading events...</p>}>
                    <EventList />
                </Suspense>
            </div>
        </section>
    )
}
export default Page