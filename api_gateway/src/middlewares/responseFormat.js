module.exports = function responseFormat() {
  return (req, res, next) => {
    const send = res.json.bind(res);
    res.json = (body) => {
      if (body && body.success !== undefined) {
        return send(body);
      }
      return send({ success: true, data: body });
    };
    res.error = (code, message, status = 400) => {
      res.status(status).json({ success: false, error: { code, message } });
    };
    next();
  };
};
