const { readFileSync } = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const ts = require("typescript");
const mongoose = require("mongoose");

// Load the actual TypeScript sources without adding a runner or changing app config.
// Each loader owns its module cache, environment, globals, and Mongoose registry.
function createLoader({ database = new mongoose.Mongoose(), env = {}, globals = {} } = {}) {
    const cache = new Map();
    function load(relativePath, { fresh = false } = {}) {
        const filename = path.resolve(__dirname, "..", relativePath);
        if (!fresh && cache.has(filename)) return cache.get(filename).exports;
        const module = { exports: {} };
        cache.set(filename, module);
        const localRequire = createRequire(filename);
        const requireSource = (specifier) => {
            if (specifier === "mongoose") return database;
            if (specifier.startsWith(".")) {
                return load(path.resolve(path.dirname(filename), `${specifier}.ts`));
            }
            return localRequire(specifier);
        };
        const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
            compilerOptions: {
                module: ts.ModuleKind.CommonJS,
                target: ts.ScriptTarget.ES2020,
                esModuleInterop: true,
            },
            fileName: filename,
        });
        const evaluate = new Function("require", "module", "exports", "process", "globalThis", outputText);
        evaluate(requireSource, module, module.exports, { env }, globals);
        return module.exports;
    }
    return { load, database, globals };
}

function eventData(overrides = {}) {
    return {
        title: "React Conf 2026!", description: "A developer conference",
        overview: "Talks and workshops", image: "/event.png", venue: "Conference Hall",
        location: "London", date: "2026-06-10", time: "09:00", mode: "offline",
        audience: "Developers", agenda: ["Keynote"], organizer: "Dev Events", tags: ["react"],
        ...overrides,
    };
}

// Stub only the database boundary, so save() still runs validation and middleware.
function stubWrites(t, Model) {
    const insert = t.mock.method(Model.collection, "insertOne", async (doc) => ({
        acknowledged: true, insertedId: doc._id,
    }));
    const update = t.mock.method(Model.collection, "updateOne", async () => ({
        acknowledged: true, matchedCount: 1, modifiedCount: 1,
    }));
    return { insert, update };
}

module.exports = { createLoader, eventData, stubWrites };
