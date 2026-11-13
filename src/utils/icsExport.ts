import type { CalendarBlock, DayOfWeek } from '../types';
import { isOvernightTimeRange } from './workSchedule';

const DAY_OFFSETS: Record<DayOfWeek, number> = {
  Lunes: 0,
  Martes: 1,
  Miércoles: 2,
  Jueves: 3,
  Viernes: 4,
  Sábado: 5,
  Domingo: 6,
};

/**
 * Returns the Date of Monday for the current week
 */
function getMondayOfCurrentWeek(): Date {
  const now = new Date();
  const day = now.getDay(); // 0 is Sunday, 1 is Monday...
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/**
 * Formats a Date object to iCalendar date-time string: YYYYMMDDTHHmmss
 */
function formatICSDateTime(date: Date, timeStr: string): string {
  const [hours, minutes] = timeStr.split(':').map((n) => parseInt(n, 10));
  const d = new Date(date);
  d.setHours(hours || 0, minutes || 0, 0, 0);

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = '00';

  return `${year}${month}${day}T${hh}${mm}${ss}`;
}

/**
 * Cleans string for iCalendar text fields
 */
function sanitizeText(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Generates RFC 5545 compliant iCalendar string from an array of CalendarBlocks.
 * Events are set to repeat weekly for 16 weeks (matching academic semester).
 */
export function generateICSContent(blocks: CalendarBlock[], calendarTitle = 'StudentOS Horario'): string {
  const monday = getMondayOfCurrentWeek();
  const nowStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//StudentOS PRO MAX//Horario Academico//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${calendarTitle}`,
    'X-WR-TIMEZONE:America/Bogota',
  ];

  blocks.forEach((block) => {
    const dayOffset = DAY_OFFSETS[block.day] ?? 0;
    const eventDate = new Date(monday);
    eventDate.setDate(monday.getDate() + dayOffset);

    const endDate = new Date(eventDate);
    if (block.endTime.trim() === '24:00' || isOvernightTimeRange(block.startTime, block.endTime)) {
      endDate.setDate(endDate.getDate() + 1);
    }
    const normalizedEnd = block.endTime.trim() === '24:00' ? '00:00' : block.endTime;

    const dtStart = formatICSDateTime(eventDate, block.startTime);
    const dtEnd = formatICSDateTime(endDate, normalizedEnd);
    const summary = sanitizeText(block.title);
    const category = sanitizeText(block.category.toUpperCase());
    const location = block.location ? sanitizeText(block.location) : '';
    const description = sanitizeText(`Bloque de ${block.category} en StudentOS PRO MAX.`);

    lines.push(
      'BEGIN:VEVENT',
      `UID:studentos-${block.id}-${Date.now()}@studentos.local`,
      `DTSTAMP:${nowStamp}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      'RRULE:FREQ=WEEKLY;COUNT=16',
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      `CATEGORIES:${category}`,
      ...(location ? [`LOCATION:${location}`] : []),
      'STATUS:CONFIRMED',
      'TRANSP:OPAQUE',
      'END:VEVENT'
    );
  });

  lines.push('END:VCALENDAR');

  return lines.join('\r\n');
}

/**
 * Generates and triggers download of .ics file directly in browser
 */
export function exportCalendarToICS(blocks: CalendarBlock[], filename = 'student-os-horario.ics'): void {
  const icsString = generateICSContent(blocks);
  const blob = new Blob([icsString], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
