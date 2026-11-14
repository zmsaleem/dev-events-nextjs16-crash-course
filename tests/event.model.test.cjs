const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createLoader, eventData, stubWrites } = require("./helpers.cjs");
const { load } = createLoader();
const { default: Event, EVENT_MODES } = load("database/event.model.ts");

const requiredStrings = ["title", "description", "overview", "image", "venue", "location",
    "date", "time", "audience", "organizer"];
for (const field of requiredStrings) {
    for (const value of [undefined, "", "   "]) {
        test(`${field} rejects ${JSON.stringify(value)}`, async () => {
            const event = new Event(eventData({ [field]: value }));
            await assert.rejects(event.validate(), (error) => error.errors[field]?.kind === "required");
        });
    }
}
for (const field of ["agenda", "tags"]) {
    for (const value of [undefined, [], [""], ["   "], ["valid", " "]]) {
        test(`${field} rejects ${JSON.stringify(value)}`, async () => {
            await assert.rejects(new Event(eventData({ [field]: value })).validate(),
                (error) => Boolean(error.errors[field]));
        });
    }
}
for (const mode of EVENT_MODES) {
    test(`accepts and normalizes ${mode} mode and trims required strings`, async () => {
        const event = new Event(eventData({ mode: `  ${mode.toUpperCase()}  `,
            ...Object.fromEntries(requiredStrings.map((field) => [field, `  ${eventData()[field]}  `])) }));
        await event.validate();
        assert.equal(event.mode, mode);
        for (const field of requiredStrings) assert.equal(event[field], eventData()[field]);
    });
}
for (const mode of [undefined, "", "virtual"]) {
    test(`rejects unsupported mode ${JSON.stringify(mode)}`, async () => {
        await assert.rejects(new Event(eventData({ mode })).validate(), (error) => Boolean(error.errors.mode));
    });
}

test("generates a slug before insertion, removes accents, and adds timestamps", async (t) => {
    const { insert } = stubWrites(t, Event);
    const event = new Event(eventData({ title: "  Café & React: Conf 2026!!!  " }));
    await event.save();
    assert.equal(event.slug, "cafe-react-conf-2026");
    assert.equal(insert.mock.calls[0].arguments[0].slug, event.slug);
    assert.ok(event.createdAt instanceof Date);
    assert.ok(event.updatedAt instanceof Date);
});

test("regenerates slugs on title changes, preserves custom slugs otherwise, and fills missing slugs", async (t) => {
    stubWrites(t, Event);
    const event = new Event(eventData());
    await event.save();
    event.title = "New Conference";
    await event.save();
    assert.equal(event.slug, "new-conference");
    event.slug = "  CUSTOM-SLUG  ";
    event.description = "Updated description";
    await event.save();
    assert.equal(event.slug, "custom-slug");
    event.slug = undefined;
    await event.save();
    assert.equal(event.slug, "new-conference");
});

for (const [input, expected] of [
    ["2024-02-29", "2024-02-29"], ["2026-06-10", "2026-06-10"],
    ["2026-06-10T23:30:00-02:00", "2026-06-11"],
]) {
    test(`normalizes date ${input} to ${expected}`, async (t) => {
        stubWrites(t, Event);
        const event = new Event(eventData({ date: input }));
        await event.save();
        assert.equal(event.date, expected);
    });
}
for (const date of ["not-a-date", "2026-02-31", "2025-02-29", "2026-13-01"]) {
    test(`rejects invalid date ${date} before writing`, async (t) => {
        const { insert } = stubWrites(t, Event);
        await assert.rejects(new Event(eventData({ date })).save(), /Invalid date:/);
        assert.equal(insert.mock.callCount(), 0);
    });
}
for (const [input, expected] of [
    ["9:00", "09:00"], ["00:00", "00:00"], ["23:59", "23:59"],
    ["12:00 AM", "00:00"], ["12:00 PM", "12:00"], ["2:30 PM", "14:30"],
    ["1:05am", "01:05"], ["  11:59 pM  ", "23:59"],
]) {
    test(`normalizes time ${input} to ${expected}`, async (t) => {
        stubWrites(t, Event);
        const event = new Event(eventData({ time: input }));
        await event.save();
        assert.equal(event.time, expected);
    });
}
for (const time of ["24:00", "09:60", "0:30 AM", "13:00 PM", "9:5", "09:00:00", "-1:00", "noon"]) {
    test(`rejects invalid time ${time} before writing`, async (t) => {
        const { insert } = stubWrites(t, Event);
        await assert.rejects(new Event(eventData({ time })).save(), /Invalid time:/);
        assert.equal(insert.mock.callCount(), 0);
    });
}

test("normalizes date and time again when an existing event changes", async (t) => {
    const { update } = stubWrites(t, Event);
    const event = new Event(eventData());
    await event.save();
    event.date = "2026-06-10T23:30:00-02:00";
    event.time = "12:00 AM";
    await event.save();
    assert.equal(event.date, "2026-06-11");
    assert.equal(event.time, "00:00");
    assert.equal(update.mock.callCount(), 1);
});

test("declares slug uniqueness and reuses the compiled model on reload", () => {
    assert.ok(Event.schema.indexes().some(([keys, options]) => keys.slug === 1 && options.unique === true));
    assert.strictEqual(load("database/event.model.ts", { fresh: true }).default, Event);
});
