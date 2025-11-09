const fs = require("fs");
const path = require("path");

const outboxFile = path.join(__dirname, "outbox.json");

function publishEvent(event) {
  const events = JSON.parse(fs.readFileSync(outboxFile, "utf-8") || "[]");
  events.push(event);
  fs.writeFileSync(outboxFile, JSON.stringify(events, null, 2));
}

module.exports = { publishEvent };
