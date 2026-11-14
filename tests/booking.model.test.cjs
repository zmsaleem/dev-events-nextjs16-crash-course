const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createLoader, stubWrites } = require("./helpers.cjs");
const { load, database } = createLoader();
const Event = load("database/event.model.ts").default;
const Booking = load("database/booking.model.ts").default;
const bookingData = (overrides = {}) => ({
    eventId: new database.Types.ObjectId(), email: "person@example.com", ...overrides,
});

for (const email of [undefined, "", "   ", "person", "person@example", "@example.com",
    "person@", "person name@example.com", "person@@example.com"]) {
    test(`rejects invalid email ${JSON.stringify(email)}`, async () => {
        await assert.rejects(new Booking(bookingData({ email })).validate(),
            (error) => Boolean(error.errors.email));
    });
}
for (const email of ["person@example.com", "first.last+tag@sub.example.co.uk"]) {
    test(`accepts email ${email} and stores it trimmed and lowercase`, async () => {
        const booking = new Booking(bookingData({ email: `  ${email.toUpperCase()}  ` }));
        await booking.validate();
        assert.equal(booking.email, email);
    });
}
for (const eventId of [undefined, null, "not-an-object-id"]) {
    test(`rejects invalid eventId ${JSON.stringify(eventId)}`, async () => {
        await assert.rejects(new Booking(bookingData({ eventId })).validate(),
            (error) => Boolean(error.errors.eventId));
    });
}

test("accepts an ObjectId string and references the Event model", async () => {
    const id = new database.Types.ObjectId();
    const booking = new Booking(bookingData({ eventId: id.toHexString() }));
    await booking.validate();
    assert.ok(booking.eventId.equals(id));
    assert.equal(Booking.schema.path("eventId").options.ref, "Event");
});

test("checks a new booking's event before insertion and adds timestamps", async (t) => {
    const exists = t.mock.method(Event, "exists", async () => ({ _id: new database.Types.ObjectId() }));
    const { insert } = stubWrites(t, Booking);
    const booking = new Booking(bookingData());
    await booking.save();
    assert.equal(exists.mock.callCount(), 1);
    assert.deepEqual(exists.mock.calls[0].arguments, [{ _id: booking.eventId }]);
    assert.equal(insert.mock.callCount(), 1);
    assert.ok(booking.createdAt instanceof Date);
    assert.ok(booking.updatedAt instanceof Date);
});

test("rejects a missing event without inserting the booking", async (t) => {
    t.mock.method(Event, "exists", async () => null);
    const { insert } = stubWrites(t, Booking);
    const booking = new Booking(bookingData());
    await assert.rejects(booking.save(), { message: `Event with id ${booking.eventId} does not exist` });
    assert.equal(insert.mock.callCount(), 0);
});

test("propagates lookup failures without inserting the booking", async (t) => {
    const failure = new Error("Event lookup unavailable");
    t.mock.method(Event, "exists", async () => { throw failure; });
    const { insert } = stubWrites(t, Booking);
    await assert.rejects(new Booking(bookingData()).save(), (error) => error === failure);
    assert.equal(insert.mock.callCount(), 0);
});

test("validates the booking before querying the event", async (t) => {
    const exists = t.mock.method(Event, "exists", async () => null);
    const { insert } = stubWrites(t, Booking);
    await assert.rejects(new Booking(bookingData({ email: "invalid" })).save(),
        (error) => Boolean(error.errors.email));
    assert.equal(exists.mock.callCount(), 0);
    assert.equal(insert.mock.callCount(), 0);
});

test("skips lookup for email edits but rechecks a changed eventId", async (t) => {
    const exists = t.mock.method(Event, "exists", async () => ({ _id: new database.Types.ObjectId() }));
    const { update } = stubWrites(t, Booking);
    const booking = new Booking(bookingData());
    await booking.save();
    booking.email = "another@example.com";
    await booking.save();
    assert.equal(exists.mock.callCount(), 1);
    booking.eventId = new database.Types.ObjectId();
    await booking.save();
    assert.equal(exists.mock.callCount(), 2);
    assert.deepEqual(exists.mock.calls[1].arguments, [{ _id: booking.eventId }]);
    assert.equal(update.mock.callCount(), 2);
});

test("rejects changing an existing booking to a missing event", async (t) => {
    const exists = t.mock.method(Event, "exists", async () => ({ _id: new database.Types.ObjectId() }));
    const { update } = stubWrites(t, Booking);
    const booking = new Booking(bookingData());
    await booking.save();
    exists.mock.mockImplementation(async () => null);
    booking.eventId = new database.Types.ObjectId();
    await assert.rejects(booking.save(), /does not exist/);
    assert.equal(update.mock.callCount(), 0);
});

test("indexes eventId, reuses models on reload, and exports the same models from the barrel", () => {
    assert.ok(Booking.schema.indexes().some(([keys]) => keys.eventId === 1));
    assert.strictEqual(load("database/booking.model.ts", { fresh: true }).default, Booking);
    const models = load("database/index.ts");
    assert.strictEqual(models.Event, Event);
    assert.strictEqual(models.Booking, Booking);
});
