const events = [];

function pushEvent(event) {
  events.push({ id: Date.now(), ...event });
}

function getEvents() {
  return events;
}

module.exports = { pushEvent, getEvents };
