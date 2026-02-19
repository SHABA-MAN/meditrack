/**
 * Calendar Integration Utility
 * 
 * Generates calendar events compatible with:
 * - Google Calendar (via URL deep-link)
 * - Outlook (via URL deep-link)
 * - iCal/ICS file download (universal)
 * 
 * No OAuth required — uses public URL schemes and ICS format.
 */

/**
 * Format date for Google Calendar URL (YYYYMMDDTHHmmssZ)
 */
const formatGoogleDate = (date) => {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
};

/**
 * Format date for ICS file
 */
const formatICSDate = (date) => {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
};

/**
 * Generate Google Calendar add-event URL
 * Opens in a new tab for the user to confirm adding
 */
export const generateGoogleCalendarUrl = ({ title, description, startDate, endDate, location }) => {
    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: title,
        dates: `${formatGoogleDate(startDate)}/${formatGoogleDate(endDate)}`,
        details: description || '',
        location: location || '',
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

/**
 * Generate Outlook Calendar add-event URL
 */
export const generateOutlookCalendarUrl = ({ title, description, startDate, endDate, location }) => {
    const params = new URLSearchParams({
        rru: 'addevent',
        subject: title,
        startdt: startDate.toISOString(),
        enddt: endDate.toISOString(),
        body: description || '',
        location: location || '',
    });
    return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
};

/**
 * Generate ICS file content (universal calendar format)
 */
export const generateICSContent = ({ title, description, startDate, endDate, location, uid }) => {
    const icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//MediTrack//TimeBoxing//AR',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        `DTSTART:${formatICSDate(startDate)}`,
        `DTEND:${formatICSDate(endDate)}`,
        `SUMMARY:${title}`,
        `DESCRIPTION:${(description || '').replace(/\n/g, '\\n')}`,
        `LOCATION:${location || ''}`,
        `UID:${uid || `meditrack-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`}`,
        `DTSTAMP:${formatICSDate(new Date())}`,
        'STATUS:CONFIRMED',
        'END:VEVENT',
        'END:VCALENDAR'
    ].join('\r\n');
    return icsContent;
};

/**
 * Download ICS file
 */
export const downloadICSFile = (events, filename = 'meditrack-schedule.ics') => {
    let icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//MediTrack//TimeBoxing//AR',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
    ];

    events.forEach((event, index) => {
        icsContent.push(
            'BEGIN:VEVENT',
            `DTSTART:${formatICSDate(event.startDate)}`,
            `DTEND:${formatICSDate(event.endDate)}`,
            `SUMMARY:${event.title}`,
            `DESCRIPTION:${(event.description || '').replace(/\n/g, '\\n')}`,
            `UID:meditrack-${Date.now()}-${index}`,
            `DTSTAMP:${formatICSDate(new Date())}`,
            'STATUS:CONFIRMED',
            'END:VEVENT',
        );
    });

    icsContent.push('END:VCALENDAR');

    const blob = new Blob([icsContent.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

/**
 * Convert TimeBoxing scheduled items to calendar events
 * @param {Array} scheduledItems - Items from the TimeBoxing component
 * @param {Date} date - The date for the schedule
 * @returns {Array} Calendar events
 */
export const timeBoxingToCalendarEvents = (scheduledItems, date) => {
    return scheduledItems.map(item => {
        const startDate = new Date(date);
        startDate.setHours(item.startHour, (item.startMinute || 0), 0, 0);

        const endDate = new Date(date);
        const durationHours = item.duration || 1;
        endDate.setHours(item.startHour + Math.floor(durationHours), ((item.startMinute || 0) + (durationHours % 1) * 60), 0, 0);

        return {
            title: item.title || item.label || 'مهمة',
            description: item.description || '',
            startDate,
            endDate,
        };
    });
};

/**
 * Open calendar event in specified provider
 */
export const openInCalendar = (event, provider = 'google') => {
    let url;
    switch (provider) {
        case 'google':
            url = generateGoogleCalendarUrl(event);
            break;
        case 'outlook':
            url = generateOutlookCalendarUrl(event);
            break;
        case 'ics':
            downloadICSFile([event]);
            return;
        default:
            url = generateGoogleCalendarUrl(event);
    }
    window.open(url, '_blank');
};

/**
 * Export entire daily schedule to calendar
 */
export const exportScheduleToCalendar = (scheduledItems, date, provider = 'ics') => {
    const events = timeBoxingToCalendarEvents(scheduledItems, date);
    if (provider === 'ics') {
        downloadICSFile(events);
    } else {
        // For Google/Outlook, open each event separately (limitation of URL-based approach)
        events.forEach((event, index) => {
            setTimeout(() => openInCalendar(event, provider), index * 500);
        });
    }
};
