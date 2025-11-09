const request = require("supertest");
const express = require("express");
const bodyParser = require("body-parser");
const requestIdMiddleware = require("../shared/middleware/requestId")(); // обязательно вызываем

const app = express();
app.use(bodyParser.json());
app.use(requestIdMiddleware);

const orders = [];
app.get("/orders", (req, res) => res.json(orders));

// --- Тест ---
test("GET /orders returns empty array", async () => {
  const res = await request(app).get("/orders");
  expect(res.statusCode).toBe(200);
  expect(res.body).toEqual([]);
});
