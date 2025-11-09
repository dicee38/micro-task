require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const logger = require("../api_gateway/src/logger"); // reuse logger path or duplicate logger locally

const app = express();
const PORT = process.env.PORT || 8000;
const JWT_SECRET = process.env.JWT_SECRET || "changeme";

app.use(cors());
app.use(express.json());

// simple in-memory DB
let users = {};
// sample admin
const adminId = uuidv4();
users[adminId] = {
  id: adminId,
  email: "admin@example.com",
  name: "Admin",
  passwordHash: bcrypt.hashSync("AdminPass123!", 10),
  roles: ["admin"],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// helper response format
function success(data) {
  return { success: true, data };
}
function error(code, message) {
  return { success: false, error: { code, message } };
}

// registration
app.post("/users", async (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !password || !name)
    return res
      .status(400)
      .json(error("validation", "email, password and name required"));
  // uniqueness
  if (Object.values(users).some((u) => u.email === email))
    return res.status(422).json(error("exists", "Email already registered"));
  const id = uuidv4();
  const hash = await bcrypt.hash(password, 10);
  const now = new Date().toISOString();
  const user = {
    id,
    email,
    name,
    passwordHash: hash,
    roles: ["user"],
    createdAt: now,
    updatedAt: now,
  };
  users[id] = user;
  logger.info({ userId: id }, "user:created");
  return res.status(201).json(success({ id }));
});

// login
app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password)
    return res
      .status(400)
      .json(error("validation", "email and password required"));
  const user = Object.values(users).find((u) => u.email === email);
  if (!user)
    return res.status(401).json(error("unauthorized", "Invalid credentials"));
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok)
    return res.status(401).json(error("unauthorized", "Invalid credentials"));
  const token = jwt.sign({ sub: user.id, roles: user.roles }, JWT_SECRET, {
    expiresIn: "2h",
  });
  return res.json(success({ token, userId: user.id }));
});

// get profile
app.get("/users/:userId", (req, res) => {
  const u = users[req.params.userId];
  if (!u) return res.status(404).json(error("not_found", "User not found"));
  const { passwordHash, ...safe } = u;
  return res.json(success(safe));
});

// list users (pagination)
app.get("/users", (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const items = Object.values(users).map((u) => {
    const { passwordHash, ...safe } = u;
    return safe;
  });
  const start = (page - 1) * limit;
  const paged = items.slice(start, start + limit);
  return res.json(success({ items: paged, page, limit, total: items.length }));
});

// update profile
app.put("/users/:userId", (req, res) => {
  const u = users[req.params.userId];
  if (!u) return res.status(404).json(error("not_found", "User not found"));
  const updates = req.body;
  if (updates.password) {
    return res
      .status(400)
      .json(error("bad_request", "Password change via dedicated endpoint"));
  }
  Object.assign(u, updates, { updatedAt: new Date().toISOString() });
  return res.json(success(u));
});

app.get("/users/health", (req, res) => {
  res.json(
    success({
      status: "OK",
      service: "Users Service",
      timestamp: new Date().toISOString(),
    })
  );
});

app.listen(PORT, () => {
  console.log(`Users service running on port ${PORT}`);
});
