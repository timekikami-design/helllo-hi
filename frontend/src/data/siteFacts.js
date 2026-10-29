// ============================================================
//  Contact facts used by the redesigned surfaces. Every value
//  below already appeared in the existing app (footer, contact
//  page, top bar) — nothing new is invented here. Values the
//  client still has to confirm are listed in the PR report.
// ============================================================
export const CONTACT = {
  address: 'Havelian, Abbottabad, Khyber Pakhtunkhwa',
  email: 'director@aust.edu.pk',
  admissionsEmail: 'coordinator@aust.edu.pk',
  phone: '+92 992 123456',
  phoneHref: '+92992123456',
  hours: 'Monday to Friday, 9:00 am to 4:00 pm (PKT)',
  mapUrl: 'https://www.google.com/maps/search/?api=1&query=Abbottabad+University+of+Science+and+Technology+Havelian',
};

export const TIME_ZONE = 'Asia/Karachi';

/** "31 December 2026" in the university's time zone. */
export const formatDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: TIME_ZONE }).format(d);
};

/** "PKR 45,000" — amounts always come from the API. */
export const formatPKR = (amount) => {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '';
  return `PKR ${n.toLocaleString('en-PK')}`;
};
