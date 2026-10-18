"use strict";

jest.mock("../db/pool", () => ({ query: jest.fn() }));
jest.mock("../middleware/rateLimiter", () => ({
  createRateLimiter: () => (req, res, next) => next(),
}));

const express = require("express");
const request = require("supertest");
const pool = require("../db/pool");
const skillsRoutes = require("./skills");

const app = express();
app.use("/api/skills", skillsRoutes);
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  res.status(500).json({ error: "Internal server error", code: "INTERNAL_ERROR" });
});

describe("Skills route", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns matching skills from a public search", async () => {
    pool.query.mockResolvedValue({ rows: [{ skill: "JavaScript" }, { skill: "Java" }] });

    const response = await request(app).get("/api/skills?q=java");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(["JavaScript", "Java"]);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("display_name ILIKE $1"),
      ["%java%"],
    );
  });

  it.each(["", "   "])("rejects an empty query (%s) with a structured 400", async (q) => {
    const response = await request(app).get("/api/skills").query({ q });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "A non-empty search query is required",
      code: "VALIDATION_ERROR",
    });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it("returns a structured error when the database query fails", async () => {
    pool.query.mockRejectedValue(new Error("database unavailable"));

    const response = await request(app).get("/api/skills?q=java");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    });
  });
});
