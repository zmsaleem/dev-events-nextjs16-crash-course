const assert = require("node:assert/strict");
const { test, mock } = require("node:test");
const { createLoader } = require("./helpers.cjs");
const URI = "mongodb://unit-test.invalid/events";

function connectionLoader(connect, globals = {}) {
    return createLoader({ database: { connect }, env: { MONGODB_URI: URI }, globals });
}

for (const env of [{}, { MONGODB_URI: "" }]) {
    test(`rejects ${JSON.stringify(env)} at import without attempting a connection`, () => {
        const connect = mock.fn();
        const { load, globals } = createLoader({ database: { connect }, env });
        assert.throws(() => load("lib/mongodb.ts"),
            /Please define the MONGODB_URI environment variable inside \.env\.local/);
        assert.equal(connect.mock.callCount(), 0);
        assert.equal(globals.mongooseCache, undefined);
    });
}

test("connects with buffering disabled and returns the cached instance on later calls", async () => {
    const connection = { connected: true };
    const connect = mock.fn(async () => connection);
    const { load, globals } = connectionLoader(connect);
    const module = load("lib/mongodb.ts");
    assert.strictEqual(module.default, module.connectToDatabase);
    assert.strictEqual(await module.connectToDatabase(), connection);
    assert.strictEqual(await module.connectToDatabase(), connection);
    assert.deepEqual(connect.mock.calls[0].arguments, [URI, { bufferCommands: false }]);
    assert.equal(connect.mock.callCount(), 1);
    assert.strictEqual(globals.mongooseCache.conn, connection);
});

test("shares one pending connection across concurrent callers and a module reload", async () => {
    let resolve;
    const pending = new Promise((done) => { resolve = done; });
    const connect = mock.fn(() => pending);
    const { load } = connectionLoader(connect);
    const first = load("lib/mongodb.ts").connectToDatabase();
    const second = load("lib/mongodb.ts", { fresh: true }).connectToDatabase();
    assert.equal(connect.mock.callCount(), 1);
    const connection = { connected: true };
    resolve(connection);
    const results = await Promise.all([first, second]);
    for (const result of results) assert.strictEqual(result, connection);
    assert.strictEqual(await load("lib/mongodb.ts").connectToDatabase(), connection);
    assert.equal(connect.mock.callCount(), 1);
});

test("uses an established global connection across reloads", async () => {
    const connection = { connected: true };
    const cache = { conn: connection, promise: null };
    const connect = mock.fn();
    const { load, globals } = connectionLoader(connect, { mongooseCache: cache });
    assert.strictEqual(await load("lib/mongodb.ts").default(), connection);
    assert.strictEqual(await load("lib/mongodb.ts", { fresh: true }).default(), connection);
    assert.strictEqual(globals.mongooseCache, cache);
    assert.equal(connect.mock.callCount(), 0);
});

test("adopts a pending promise already stored in the global cache", async () => {
    const connection = { connected: true };
    const connect = mock.fn();
    const { load } = connectionLoader(connect, {
        mongooseCache: { conn: null, promise: Promise.resolve(connection) },
    });
    assert.strictEqual(await load("lib/mongodb.ts").default(), connection);
    assert.equal(connect.mock.callCount(), 0);
});

test("propagates a shared rejection, clears the failed promise, and retries once", async () => {
    let reject;
    const failed = new Promise((_, fail) => { reject = fail; });
    const failure = new Error("Connection refused");
    const connection = { connected: true };
    const connect = mock.fn(() => failed);
    const { load, globals } = connectionLoader(connect);
    const { connectToDatabase } = load("lib/mongodb.ts");
    const first = connectToDatabase();
    const second = connectToDatabase();
    const assertions = [first, second].map((promise) =>
        assert.rejects(promise, (error) => error === failure));
    reject(failure);
    await Promise.all(assertions);
    assert.equal(connect.mock.callCount(), 1);
    assert.equal(globals.mongooseCache.promise, null);
    assert.equal(globals.mongooseCache.conn, null);
    connect.mock.mockImplementation(async () => connection);
    const retried = await Promise.all([connectToDatabase(), connectToDatabase()]);
    for (const result of retried) assert.strictEqual(result, connection);
    assert.equal(connect.mock.callCount(), 2);
});
