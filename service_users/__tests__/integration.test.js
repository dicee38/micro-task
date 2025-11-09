const request = require("supertest");
const usersApp = require("../index");
const ordersApp = require("../../service_orders/index");

jest.mock("../api_gateway/src/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
}));

describe("Integration: Users -> Orders", () => {
  let userId;
  let userToken;
  let orderId;

  it("registers a user", async () => {
    const res = await request(usersApp).post("/users").send({
      email: "test@example.com",
      password: "12345678",
      name: "Test User",
    });
    expect(res.statusCode).toBe(201);
    userId = res.body.data.id;
  });

  it("logs in the user", async () => {
    const res = await request(usersApp).post("/auth/login").send({
      email: "test@example.com",
      password: "12345678",
    });
    expect(res.statusCode).toBe(200);
    userToken = res.body.data.token;
  });

  it("creates an order", async () => {
    const res = await request(ordersApp)
      .post("/orders")
      .send({ userId, items: [{ product: "Widget", qty: 2 }], amount: 200 });
    expect(res.statusCode).toBe(201);
    orderId = res.body.data.id;
  });

  it("lists orders", async () => {
    const res = await request(ordersApp).get("/orders").query({ userId });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThan(0);
  });

  it("updates order status", async () => {
    const res = await request(ordersApp)
      .put(`/orders/${orderId}`)
      .send({ status: "shipped" });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.status).toBe("shipped");
  });

  it("cancels the order", async () => {
    const res = await request(ordersApp).delete(`/orders/${orderId}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.orderId).toBe(orderId);
  });
});
