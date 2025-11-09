const { context, trace, propagation } = require("@opentelemetry/api");

function traceMiddleware(req, res, next) {
  const span = trace.getTracer("default").startSpan("http_request");
  req.span = span;
  res.on("finish", () => {
    span.end();
  });
  next();
}

module.exports = { traceMiddleware };
