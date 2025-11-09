const request = require("supertest");
const express = require("express");
const bodyParser = require("body-parser");
const { requestIdMiddleware } = require("../shared/middleware/requestId");
const logger = require("../shared/logger");

const app = express();
app.use(bodyParser.json());
app.use(requestIdMiddleware);

const orders = [];

app.post("/orders", (req, res) => {
  const { item, quantity } = req.body;
  if (!item || !quantity)
    return res.status(400).json({ error: "Missing fields" });
  const order = { id: Date.now(), item, quantity };
  orders.push(order);
  logger.info(`Order created: ${JSON.stringify(order)}`);
  res.status(201).json(order);
});

describe("Create Order", () => {
  it("should create order successfully", async () => {
    const res = await request(app)
      .post("/orders")
      .send({ item: "Book", quantity: 2 });
    expect(res.statusCode).toBe(201);
    expect(res.body.item).toBe("Book");
  });

  it("should fail on missing fields", async () => {
    const res = await request(app).post("/orders").send({});
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("Missing fields");
  });
});
