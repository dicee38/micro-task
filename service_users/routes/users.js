const jwt = require("jsonwebtoken");

app.post("/users/refresh-token", (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(401).json({ error: "No token provided" });
  try {
    const payload = jwt.verify(token, process.env.REFRESH_SECRET);
    const newToken = jwt.sign(
      { username: payload.username },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );
    res.json({ accessToken: newToken });
  } catch (err) {
    res.status(403).json({ error: "Invalid refresh token" });
  }
});
