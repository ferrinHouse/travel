/**
 * Parses a time string (e.g. "10:00 AM", "05:30 PM", "Evening") into minutes since midnight.
 * Used to chronologically sort activities and meals.
 */
export const parseTimeToMinutes = (timeStr) => {
  if (!timeStr) return 9999;
  const clean = timeStr.trim().toLowerCase();
  
  const match = clean.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/);
  if (match) {
    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const ampm = match[3];
    if (ampm === 'pm' && hours < 12) hours += 12;
    if (ampm === 'am' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }
  
  if (clean.includes('morning')) return 480;  // 8:00 AM
  if (clean.includes('afternoon')) return 840; // 2:00 PM
  if (clean.includes('noon')) return 720;     // 12:00 PM
  if (clean.includes('evening')) return 1080;  // 6:00 PM
  if (clean.includes('night')) return 1200;    // 8:00 PM
  
  return 9990; // Unknown text formats go near the end
};

/**
 * Custom emoji mappings for different meal types.
 */
export const getMealIcon = (type) => {
  if (type === 'Breakfast') return '🥣';
  if (type === 'Lunch') return '🥪';
  return '🍽️';
};

/**
 * Escapes HTML characters and parses basic markdown links, bold text, and italics.
 */
export const renderMarkdown = (text) => {
  if (!text) return '';
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  // Bold: **text**
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Italic: *text*
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  // Links: [label](url)
  html = html.replace(
    /\[(.*?)\]\((.*?)\)/g, 
    '<a href="$2" target="_blank" rel="noopener noreferrer" style="color: var(--primary-color); text-decoration: underline; font-weight: 500;">$1</a>'
  );
  
  return html;
};

/**
 * Checks if a trip's end date is before today, determining if it should be archived.
 */
export const isTripPast = (trip, today = new Date()) => {
  if (trip.endDate) {
    const tripEnd = new Date(trip.endDate);
    
    // Extract local calendar components of today
    const todayYear = today.getFullYear();
    const todayMonth = String(today.getMonth() + 1).padStart(2, '0');
    const todayDay = String(today.getDate()).padStart(2, '0');
    const todayStr = `${todayYear}-${todayMonth}-${todayDay}`;

    // Extract UTC calendar components of tripEnd (since DB dates are stored in UTC)
    const endYear = tripEnd.getUTCFullYear();
    const endMonth = String(tripEnd.getUTCMonth() + 1).padStart(2, '0');
    const endDay = String(tripEnd.getUTCDate()).padStart(2, '0');
    const endStr = `${endYear}-${endMonth}-${endDay}`;

    return endStr < todayStr;
  }
  return trip.status === 'past';
};
