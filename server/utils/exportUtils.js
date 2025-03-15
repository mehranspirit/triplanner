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
  
  // Group events by day
  sortedEvents.forEach(event => {
    const eventDate = event.type === 'stay' ? new Date(event.checkIn) : new Date(event.date);
    const dateKey = eventDate.toISOString().split('T')[0];
    
    if (!eventsByDay[dateKey]) {
      eventsByDay[dateKey] = {
        date: formatDate(eventDate),
        events: []
      };
    }
    
    eventsByDay[dateKey].events.push({
      ...event,
      formattedTime: formatTime(eventDate),
      formattedDetails: formatEventDetails(event)
    });
  });
  
  // Convert to array and sort by date
  const days = Object.values(eventsByDay).sort((a, b) => {
    return new Date(a.date) - new Date(b.date);
  });
  
  return {
    trip: {
      name: trip.name,
      description: trip.description || '',
      startDate: trip.startDate ? formatDate(new Date(trip.startDate)) : '',
      endDate: trip.endDate ? formatDate(new Date(trip.endDate)) : '',
      owner: trip.owner ? trip.owner.name : '',
      thumbnailUrl: trip.thumbnailUrl || '',
      duration: calculateDuration(trip.startDate, trip.endDate)
    },
    days,
    exportDate: formatDate(new Date()),
    options
  };
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
 * @param {Object} event - Event object
 * @returns {string} - Formatted event details
 */
function formatEventDetails(event) {
  switch (event.type) {
    case 'arrival':
    case 'departure':
      return `${event.airline || ''} ${event.flightNumber || ''} - ${event.airport || ''}`;
    case 'stay':
      return `${event.accommodationName || ''} - ${event.address || ''}`;
    case 'destination':
      return `${event.placeName || ''} - ${event.address || ''}`;
    default:
      return '';
  }
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
  const diffTime = Math.abs(end - start);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

module.exports = {
  generatePDF,
  generateHTML
}; 