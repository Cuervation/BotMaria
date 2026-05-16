function stripWhitespace(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function parseDateCardText(rawText) {
  const normalized = stripWhitespace(String(rawText ?? ''));
  if (!normalized || /agotado/i.test(normalized)) {
    return null;
  }

  const ctaMatch = normalized.match(/\b(Seleccionar|Comprar)\b/i);
  if (!ctaMatch) {
    return null;
  }

  const headerMatch = normalized.match(/\b(?<day>\d{1,2})\s+(?<month>[\p{L}]+)\b/iu);
  if (!headerMatch || !headerMatch.groups) {
    return null;
  }

  const timeMatches = normalized.match(/\b\d{1,2}:\d{2}\s*hs\b/gi);
  if (!timeMatches || timeMatches.length === 0) {
    return null;
  }

  return {
    day: headerMatch.groups.day,
    month: headerMatch.groups.month,
    time: stripWhitespace(timeMatches[timeMatches.length - 1]),
    rawText: normalized,
  };
}

module.exports = {
  parseDateCardText,
};
