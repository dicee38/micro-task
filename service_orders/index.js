require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

let orders = {}; // id -> order

function success(data) {
  return { success: true, data };
}
function error(code, message) {
  return { success: false, error: { code, message } };
}

// create order
app.post("/orders", (req, res) => {
  const payload = req.body || {};
  if (
    !payload.items ||
    !Array.isArray(payload.items) ||
    payload.items.length === 0
  ) {
    return res.status(400).json(error("validation", "items required"));
  }
  if (!payload.userId)
    return res.status(400).json(error("validation", "userId required"));
  const id = uuidv4();
  const now = new Date().toISOString();
  const order = {
    id,
    userId: payload.userId,
    items: payload.items,
    status: "created",
    amount: payload.amount || 0,
    createdAt: now,
    updatedAt: now,
  };
  orders[id] = order;
  // publish event (stub)
  console.log("event: order.created", {
    orderId: id,
    userId: order.userId,
    amount: order.amount,
  });
  return res.status(201).json(success(order));
});

// get order
app.get("/orders/:orderId", (req, res) => {
  const o = orders[req.params.orderId];
  if (!o) return res.status(404).json(error("not_found", "Order not found"));
  return res.json(success(o));
});

// list orders (filter by userId)
app.get("/orders", (req, res) => {
  let list = Object.values(orders);
  if (req.query.userId)
    list = list.filter((o) => o.userId === req.query.userId);
  // pagination
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const start = (page - 1) * limit;
  const paged = list.slice(start, start + limit);
  return res.json(success({ items: paged, page, limit, total: list.length }));
});

// update order (status or full update)
app.put("/orders/:orderId", (req, res) => {
  const o = orders[req.params.orderId];
  if (!o) return res.status(404).json(error("not_found", "Order not found"));
  const updates = req.body;
  // ownership check - expect userId in payload or header (gateway attaches userId)
  if (updates.userId && updates.userId !== o.userId)
    return res.status(403).json(error("forbidden", "Cannot change userId"));
  // if status changed -> publish event
  if (updates.status && updates.status !== o.status) {
    o.status = updates.status;
    o.updatedAt = new Date().toISOString();
    console.log("event: order.status_changed", {
      orderId: o.id,
      status: o.status,
    });
    return res.json(success(o));
  }
  Object.assign(o, updates, { updatedAt: new Date().toISOString() });
  return res.json(success(o));
});

// delete (cancel) - allow only owner
app.delete("/orders/:orderId", (req, res) => {
  const o = orders[req.params.orderId];
  if (!o) return res.status(404).json(error("not_found", "Order not found"));
  // cancellation logic: set status cancelled
  o.status = "cancelled";
  o.updatedAt = new Date().toISOString();
  console.log("event: order.cancelled", { orderId: o.id });
  return res.json(success({ message: "Order cancelled", orderId: o.id }));
});

app.get("/orders/health", (req, res) =>
  res.json(
    success({
      status: "OK",
      service: "Orders Service",
      timestamp: new Date().toISOString(),
    })
  )
);

app.listen(PORT, () => console.log(`Orders service running on port ${PORT}`));
