const { v4: uuidv4 } = require("uuid");
module.exports = function requestId() {
  return (req, res, next) => {
    const rid = req.headers["x-request-id"] || uuidv4();
    req.id = rid;
    res.setHeader("x-request-id", rid);
    next();
  };
};
