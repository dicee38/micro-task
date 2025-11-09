const request = require("supertest");
const express = require("express");
const requestId = require("../shared/middleware/requestId"); // вместо traceIdMiddleware

const app = express();
app.use(express.json());
app.use(requestId()); // подключаем middleware

// Минимальный маршрут для теста
app.post("/users/register", (req, res) => {
  res
    .status(201)
    .json({ message: "User registered", requestId: req.requestId });
});

describe("Users API", () => {
  it("should register a user", async () => {
    const res = await request(app)
      .post("/users/register")
      .send({ name: "Alice", email: "alice@example.com" });

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty("message", "User registered");
    expect(res.body).toHaveProperty("requestId");
  });
});
