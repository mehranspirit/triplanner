/**
 * Utility functions for exporting trip itineraries
 */
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');

// Register Handlebars helpers
handlebars.registerHelper('ifEquals', function(arg1, arg2, options) {
  return (arg1 === arg2) ? options.fn(this) : options.inverse(this);
});

handlebars.registerHelper('ifNotEquals', function(arg1, arg2, options) {
  return (arg1 !== arg2) ? options.fn(this) : options.inverse(this);
});

// Add eq helper for equality comparison
handlebars.registerHelper('eq', function(arg1, arg2) {
  return arg1 === arg2;
});

// Add or helper for logical OR operation
handlebars.registerHelper('or', function() {
  return Array.prototype.slice.call(arguments, 0, -1).some(Boolean);
});

/**
 * Convert plain text URLs to HTML hyperlinks
 * @param {string} text - Text that may contain URLs
 * @returns {string} - Text with URLs converted to hyperlinks
 */
function convertUrlsToLinks(text) {
  if (!text) return '';
  
  // URL regex pattern that matches http, https, and www. URLs
  const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/g;
  
  return text.replace(urlRegex, (url) => {
    // Add https:// prefix to www. URLs if they don't have a protocol
    const href = url.startsWith('www.') ? 'https://' + url : url;
    return `<a href="${href}" target="_blank" rel="noopener noreferrer">${url}</a>`;
  });
}

/**
 * Generate a PDF export of a trip itinerary
 * @param {Object} trip - The trip object with all details and events
 * @param {Object} options - Export options
 * @returns {Promise<Buffer>} - PDF file as buffer
 */
async function generatePDF(trip, options = {}) {
  try {
    // Prepare data for the template
    const templateData = prepareTemplateData(trip, options);
    
    // Generate HTML from template
    const html = await renderTemplate('pdf-template', templateData);
    
    // Launch puppeteer to convert HTML to PDF
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    // Generate PDF
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '1cm',
        right: '1cm',
        bottom: '1cm',
        left: '1cm'
      }
    });
    
    await browser.close();
    return pdf;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF export');
  }
}

/**
 * Generate a printable HTML export of a trip itinerary
 * @param {Object} trip - The trip object with all details and events
 * @param {Object} options - Export options
 * @returns {Promise<string>} - HTML content
 */
async function generateHTML(trip, options = {}) {
  try {
    // Prepare data for the template
    const templateData = prepareTemplateData(trip, options);
    
    // Generate HTML from template
    return await renderTemplate('html-template', templateData);
  } catch (error) {
    console.error('Error generating HTML:', error);
    throw new Error('Failed to generate HTML export');
  }
}

/**
 * Prepare template data from trip object
 * @param {Object} trip - The trip object
 * @param {Object} options - Export options
 * @returns {Object} - Prepared data for templates
 */
function prepareTemplateData(trip, options) {
  // Group events by day
  const eventsByDay = {};
  
  // Sort events chronologically
  const sortedEvents = [...trip.events].sort((a, b) => {
    const dateA = a.type === 'stay' ? new Date(a.checkIn).getTime() : new Date(a.date).getTime();
    const dateB = b.type === 'stay' ? new Date(b.checkIn).getTime() : new Date(b.date).getTime();
    return dateA - dateB;
  });
  
  if (sortedEvents.length === 0) {
    return {
      trip: {
        name: trip.name,
        description: trip.description || '',
        startDate: trip.startDate ? formatDate(new Date(trip.startDate)) : '',
        endDate: trip.endDate ? formatDate(new Date(trip.endDate)) : '',
        owner: trip.owner ? trip.owner.name : '',
        thumbnailUrl: trip.thumbnailUrl || '',
        duration: 0
      },
      days: [],
      exportDate: formatDate(new Date()),
      options
    };
  }
  
  // Determine first and last event dates for trip duration calculation
  const firstEventDate = sortedEvents[0].type === 'stay' 
    ? new Date(sortedEvents[0].checkIn) 
    : new Date(sortedEvents[0].date);
  
  const lastEventDate = sortedEvents[sortedEvents.length - 1].type === 'stay' 
    ? new Date(sortedEvents[sortedEvents.length - 1].checkOut || sortedEvents[sortedEvents.length - 1].checkIn) 
    : new Date(sortedEvents[sortedEvents.length - 1].date);
  
  // Reset time parts for accurate day calculation
  firstEventDate.setHours(0, 0, 0, 0);
  lastEventDate.setHours(0, 0, 0, 0);
  
  // Group events by day
  sortedEvents.forEach(event => {
    const eventDate = event.type === 'stay' ? new Date(event.checkIn) : new Date(event.date);
    const dateKey = eventDate.toISOString().split('T')[0];
    
    if (!eventsByDay[dateKey]) {
      eventsByDay[dateKey] = {
        date: formatDate(eventDate),
        rawDate: new Date(eventDate),
        events: []
      };
      
      // Reset time part for day calculation
      eventsByDay[dateKey].rawDate.setHours(0, 0, 0, 0);
    }
    
    eventsByDay[dateKey].events.push({
      ...event,
      formattedTime: formatTime(eventDate),
      formattedDetails: formatEventDetails(event)
    });
  });
  
  // Convert to array and sort by date
  const days = Object.values(eventsByDay).sort((a, b) => {
    return a.rawDate - b.rawDate;
  });
  
  // Calculate day numbers based on first event date
  days.forEach(day => {
    // Calculate days since first event (add 1 to make it 1-indexed)
    const daysSinceStart = Math.floor((day.rawDate - firstEventDate) / (1000 * 60 * 60 * 24)) + 1;
    day.dayNumber = daysSinceStart;
  });
  
  // Combine days with the same day number
  const combinedDays = [];
  const daysByNumber = {};
  
  days.forEach(day => {
    const dayNumber = day.dayNumber;
    
    if (!daysByNumber[dayNumber]) {
      // Create a new entry for this day number
      daysByNumber[dayNumber] = {
        dayNumber: dayNumber,
        date: day.date,
        events: [...day.events]
      };
      combinedDays.push(daysByNumber[dayNumber]);
    } else {
      // Add events to the existing day
      daysByNumber[dayNumber].events = [
        ...daysByNumber[dayNumber].events,
        ...day.events
      ];
      
      // Sort events within the day by time
      daysByNumber[dayNumber].events.sort((a, b) => {
        const timeA = a.type === 'stay' ? new Date(a.checkIn).getTime() : new Date(a.date).getTime();
        const timeB = b.type === 'stay' ? new Date(b.checkIn).getTime() : new Date(b.date).getTime();
        return timeA - timeB;
      });
    }
  });
  
  // Calculate trip duration based on first and last events
  const duration = calculateDurationBetweenDates(firstEventDate, lastEventDate);
  
  return {
    trip: {
      name: trip.name,
      description: trip.description || '',
      startDate: formatDate(firstEventDate),
      endDate: formatDate(lastEventDate),
      owner: trip.owner ? trip.owner.name : '',
      thumbnailUrl: trip.thumbnailUrl || '',
      duration: duration
    },
    days: combinedDays,
    exportDate: formatDate(new Date()),
    options
  };
}

/**
 * Calculate duration between two dates in days
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {number} - Duration in days
 */
function calculateDurationBetweenDates(startDate, endDate) {
  if (!startDate || !endDate) return 0;
  
  // Calculate difference in days (including the end date)
  const diffTime = Math.abs(endDate - startDate);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * Render a template with the given data
 * @param {string} templateName - Name of the template file (without extension)
 * @param {Object} data - Data to render in the template
 * @returns {Promise<string>} - Rendered HTML
 */
async function renderTemplate(templateName, data) {
  try {
    const templatePath = path.join(__dirname, '../templates', `${templateName}.hbs`);
    const templateSource = fs.readFileSync(templatePath, 'utf8');
    const template = handlebars.compile(templateSource);
    return template(data);
  } catch (error) {
    console.error('Error rendering template:', error);
    throw new Error('Failed to render template');
  }
}

/**
 * Format a date object to a readable string
 * @param {Date} date - Date object
 * @returns {string} - Formatted date string
 */
function formatDate(date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Format a time object to a readable string
 * @param {Date} date - Date object
 * @returns {string} - Formatted time string
 */
function formatTime(date) {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Format event details based on event type
 * @param {Object} event - The event object
 * @returns {string} - Formatted event details HTML
 */
function formatEventDetails(event) {
  let details = '';
  
  // Add event type tag with appropriate class
  details += `<div class="event-type-tag event-type-tag-${event.type}">${event.type.toUpperCase()}</div>`;
  
  switch (event.type) {
    case 'arrival':
      details += `<p>Arrival at ${event.airport || 'airport'}</p>`;
      if (event.airline) details += `<p><strong>Airline:</strong> ${event.airline}</p>`;
      if (event.flightNumber) details += `<p><strong>Flight:</strong> ${event.flightNumber}</p>`;
      if (event.terminal) details += `<p><strong>Terminal:</strong> ${event.terminal}</p>`;
      if (event.gate) details += `<p><strong>Gate:</strong> ${event.gate}</p>`;
      if (event.bookingReference) details += `<p><strong>Booking Ref:</strong> ${event.bookingReference}</p>`;
      break;
      
    case 'departure':
      details += `<p>Departure from ${event.airport || 'airport'}</p>`;
      if (event.airline) details += `<p><strong>Airline:</strong> ${event.airline}</p>`;
      if (event.flightNumber) details += `<p><strong>Flight:</strong> ${event.flightNumber}</p>`;
      if (event.terminal) details += `<p><strong>Terminal:</strong> ${event.terminal}</p>`;
      if (event.gate) details += `<p><strong>Gate:</strong> ${event.gate}</p>`;
      if (event.bookingReference) details += `<p><strong>Booking Ref:</strong> ${event.bookingReference}</p>`;
      break;
      
    case 'stay':
      details += `<p>${event.accommodationName || 'Accommodation'}</p>`;
      if (event.address) details += `<p><strong>Address:</strong> ${event.address}</p>`;
      if (event.checkIn) details += `<p><strong>Check-in:</strong> ${formatDate(new Date(event.checkIn))}</p>`;
      if (event.checkOut) details += `<p><strong>Check-out:</strong> ${formatDate(new Date(event.checkOut))}</p>`;
      if (event.reservationNumber) details += `<p><strong>Reservation:</strong> ${event.reservationNumber}</p>`;
      if (event.contactInfo) details += `<p><strong>Contact:</strong> ${event.contactInfo}</p>`;
      break;
      
    case 'destination':
      details += `<p>${event.placeName || 'Destination'}</p>`;
      if (event.address) details += `<p><strong>Address:</strong> ${event.address}</p>`;
      if (event.description) details += `<p><strong>Description:</strong> ${event.description}</p>`;
      if (event.openingHours) details += `<p><strong>Hours:</strong> ${event.openingHours}</p>`;
      break;
      
    default:
      details += `<p>${event.name || 'Event'}</p>`;
  }
  
  if (event.notes) {
    // Convert URLs in notes to clickable hyperlinks
    const notesWithLinks = convertUrlsToLinks(event.notes);
    details += `<p class="event-notes"><strong>Notes:</strong> ${notesWithLinks}</p>`;
  }
  
  return details;
}

/**
 * Calculate trip duration in days
 * @param {string} startDate - Start date string
 * @param {string} endDate - End date string
 * @returns {number} - Duration in days
 */
function calculateDuration(startDate, endDate) {
  if (!startDate || !endDate) return 0;
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Reset time part to compare only dates
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  
  // Calculate difference in days (including the end date)
  const diffTime = Math.abs(end - start);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

module.exports = {
  generatePDF,
  generateHTML
}; 