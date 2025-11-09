const request = require("supertest");
const express = require("express");
const bodyParser = require("body-parser");

const { requestIdMiddleware } = require("../shared/middleware/requestId");
const logger = require("../shared/logger");

const app = express();
app.use(bodyParser.json());
app.use(requestIdMiddleware);

const users = [{ username: "testuser", password: "123456" }];

app.post("/users/login", (req, res) => {
  const { username, password } = req.body;
  const user = users.find(
    (u) => u.username === username && u.password === password
  );
  if (!user) return res.status(401).json({ error: "Invalid credentials" });
  logger.info(`User logged in: ${username}`);
  res.status(200).json({ message: "Login successful" });
});

describe("User Login", () => {
  it("should login successfully with valid credentials", async () => {
    const res = await request(app)
      .post("/users/login")
      .send({ username: "testuser", password: "123456" });
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe("Login successful");
  });

  it("should fail login with invalid credentials", async () => {
    const res = await request(app)
      .post("/users/login")
      .send({ username: "testuser", password: "wrongpass" });
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe("Invalid credentials");
  });
});
