require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const CircuitBreaker = require("opossum");
const rateLimit = require("express-rate-limit");
const logger = require("./src/logger");
const requestId = require("./src/middleware/requestId")();
const responseFormat = require("./src/middleware/responseFormat")();
const jwt = require("jsonwebtoken");
const swaggerRouter = require("./swagger");

const app = express();
const PORT = process.env.PORT || 8000;

app.use(swaggerRouter);

const USERS_SERVICE_URL = process.env.USERS_URL || "http://service_users:8000";
const ORDERS_SERVICE_URL =
  process.env.ORDERS_URL || "http://service_orders:8000";
const JWT_SECRET = process.env.JWT_SECRET || "changeme";

app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json());
app.use(requestId);
app.use(responseFormat);

// basic request logging
app.use((req, res, next) => {
  logger.info(
    { reqId: req.id, method: req.method, url: req.originalUrl },
    "req:start"
  );
  res.on("finish", () => {
    logger.info({ reqId: req.id, status: res.statusCode }, "req:end");
  });
  next();
});

// rate limiter
const limiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  max: Number(process.env.RATE_LIMIT_MAX || 200),
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// JWT middleware (used for protected routes)
function jwtMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer "))
    return res.error("unauthorized", "No token provided", 401);
  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    logger.warn({ err: err.message, reqId: req.id }, "invalid token");
    return res.error("invalid_token", "Token invalid or expired", 401);
  }
}

// Circuit Breaker config
const circuitOptions = {
  timeout: 3000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
};

const usersCircuit = new CircuitBreaker(async (url, options = {}) => {
  const response = await axios({
    url,
    ...options,
    validateStatus: (s) => (s >= 200 && s < 300) || s === 404,
  });
  return response.data;
}, circuitOptions);
const ordersCircuit = new CircuitBreaker(async (url, options = {}) => {
  const response = await axios({
    url,
    ...options,
    validateStatus: (s) => (s >= 200 && s < 300) || s === 404,
  });
  return response.data;
}, circuitOptions);

usersCircuit.fallback(() => ({
  success: false,
  error: {
    code: "service_unavailable",
    message: "Users service temporarily unavailable",
  },
}));
ordersCircuit.fallback(() => ({
  success: false,
  error: {
    code: "service_unavailable",
    message: "Orders service temporarily unavailable",
  },
}));

// prefix v1
const base = "/api/v1";

// Proxy helper
async function proxyTo(circuit, url, options = {}, req, res) {
  try {
    // forward headers
    const headers = { ...req.headers };
    headers["x-request-id"] = req.id;
    const fullOptions = {
      ...options,
      headers,
      method: options.method || req.method,
    };
    const resp = await circuit.fire(url, fullOptions);
    // if service returned unified object already
    if (resp && resp.success === false) {
      return res.status(resp.status || 500).json(resp);
    }
    return res.json(resp);
  } catch (err) {
    logger.error({ err: err.message, reqId: req.id }, "proxy error");
    return res.error("internal_error", "Internal server error", 500);
  }
}

/* --- Users routes (some are public) --- */
app.post(`${base}/auth/register`, async (req, res) => {
  await proxyTo(
    usersCircuit,
    `${USERS_SERVICE_URL}/users`,
    { method: "POST", data: req.body },
    req,
    res
  );
});

app.post(`${base}/auth/login`, async (req, res) => {
  await proxyTo(
    usersCircuit,
    `${USERS_SERVICE_URL}/auth/login`,
    { method: "POST", data: req.body },
    req,
    res
  );
});

app.get(`${base}/users/me`, jwtMiddleware, async (req, res) => {
  // simply get user by id from users service
  await proxyTo(
    usersCircuit,
    `${USERS_SERVICE_URL}/users/${req.user.sub}`,
    {},
    req,
    res
  );
});

app.get(`${base}/users`, jwtMiddleware, async (req, res) => {
  // admin only
  if (!req.user.roles || !req.user.roles.includes("admin"))
    return res.error("forbidden", "Admin only", 403);
  const q = req.query || {};
  const qs = new URLSearchParams(q).toString();
  await proxyTo(usersCircuit, `${USERS_SERVICE_URL}/users?${qs}`, {}, req, res);
});

/* --- Orders routes --- */
app.post(`${base}/orders`, jwtMiddleware, async (req, res) => {
  // attach userId to order payload
  const payload = { ...req.body, userId: req.user.sub };
  await proxyTo(
    ordersCircuit,
    `${ORDERS_SERVICE_URL}/orders`,
    { method: "POST", data: payload },
    req,
    res
  );
});

app.get(`${base}/orders/:id`, jwtMiddleware, async (req, res) => {
  await proxyTo(
    ordersCircuit,
    `${ORDERS_SERVICE_URL}/orders/${req.params.id}`,
    {},
    req,
    res
  );
});

app.get(`${base}/orders`, jwtMiddleware, async (req, res) => {
  // pass query params through
  const qs = new URLSearchParams(req.query).toString();
  await proxyTo(
    ordersCircuit,
    `${ORDERS_SERVICE_URL}/orders?${qs}`,
    {},
    req,
    res
  );
});

app.put(`${base}/orders/:id`, jwtMiddleware, async (req, res) => {
  await proxyTo(
    ordersCircuit,
    `${ORDERS_SERVICE_URL}/orders/${req.params.id}`,
    { method: "PUT", data: req.body },
    req,
    res
  );
});

app.delete(`${base}/orders/:id`, jwtMiddleware, async (req, res) => {
  await proxyTo(
    ordersCircuit,
    `${ORDERS_SERVICE_URL}/orders/${req.params.id}`,
    { method: "DELETE" },
    req,
    res
  );
});

// Aggregation example
app.get(`${base}/users/:userId/details`, jwtMiddleware, async (req, res) => {
  const userId = req.params.userId;
  const userPromise = usersCircuit.fire(`${USERS_SERVICE_URL}/users/${userId}`);
  const ordersPromise = ordersCircuit.fire(
    `${ORDERS_SERVICE_URL}/orders?userId=${userId}`
  );
  const [user, orders] = await Promise.all([userPromise, ordersPromise]);
  if (user && user.error) return res.status(404).json(user);
  return res.json({ user, orders });
});

// health
app.get("/health", (req, res) => {
  res.json({
    success: true,
    data: {
      status: "API Gateway is running",
      circuits: {
        users: { status: usersCircuit.status, stats: usersCircuit.stats },
        orders: { status: ordersCircuit.status, stats: ordersCircuit.stats },
      },
    },
  });
});

// start and event logs
app.listen(PORT, () => {
  logger.info({ port: PORT }, "API Gateway started");
  usersCircuit.on("open", () => logger.warn("Users circuit opened"));
  usersCircuit.on("close", () => logger.info("Users circuit closed"));
  ordersCircuit.on("open", () => logger.warn("Orders circuit opened"));
  ordersCircuit.on("close", () => logger.info("Orders circuit closed"));
});
