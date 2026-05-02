const BUSINESS_HOURS = {
  weekday: { start: "16:00", end: "18:00" },
};

function isValidDateString(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function isValidTimeString(value) {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(value || ""));
}

function getLocalDateString(date = new Date()) {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60000);
  return localDate.toISOString().slice(0, 10);
}

function getBusinessHours(dateString) {
  if (!isValidDateString(dateString)) {
    return null;
  }

  const day = new Date(`${dateString}T12:00:00`).getDay();

  if (day >= 1 && day <= 5) {
    return BUSINESS_HOURS.weekday;
  }

  return null;
}

function buildSlots(start, end) {
  if (!isValidTimeString(start) || !isValidTimeString(end)) {
    return [];
  }

  const slots = [];
  let [hours, minutes] = start.split(":").map(Number);
  const [endHours, endMinutes] = end.split(":").map(Number);

  while (hours < endHours || (hours === endHours && minutes <= endMinutes - 30)) {
    slots.push(`${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`);
    minutes += 30;

    if (minutes === 60) {
      hours += 1;
      minutes = 0;
    }
  }

  return slots;
}

function getAvailableSlotsForDate(dateString) {
  const businessHours = getBusinessHours(dateString);

  if (!businessHours) {
    return [];
  }

  return buildSlots(businessHours.start, businessHours.end);
}

function isPastDate(dateString) {
  if (!isValidDateString(dateString)) {
    return false;
  }

  return dateString < getLocalDateString();
}

function isBookableSlot(dateString, timeString) {
  return getAvailableSlotsForDate(dateString).includes(String(timeString || ""));
}

module.exports = {
  BUSINESS_HOURS,
  buildSlots,
  getAvailableSlotsForDate,
  getBusinessHours,
  getLocalDateString,
  isBookableSlot,
  isPastDate,
  isValidDateString,
  isValidTimeString,
};
