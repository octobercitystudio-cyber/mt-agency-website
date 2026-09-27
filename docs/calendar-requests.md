# Booking day actions and request calendar

An operations user can start a normal client booking from the selected calendar day. The booking modal receives the date for that opening and retains it while choosing a client, service or package. Ordinary header creation clears this date. A double click on a blank day still opens the temporary-booking/direct-session chooser; the normal booking action is also available there. Opening a form never reserves a slot; existing server validation remains authoritative.

The request inbox calendar combines occupied appointments and temporary blocks with pending request markers. `buildCalendarRequestMarkers` maps pending booking records, studio-request appointments, reschedules and cancellation requests without mutating their source data. A reschedule has two linked markers: the current slot and the requested slot. Cross-month navigation is explicit. The original slot remains occupied until approval; cancellation is also still occupied until its decision completes.

The renderer distinguishes requests using text, icons and gentle emphasis, with reduced-motion support. Approved/rejected studio appointments and reviewed reschedules stop generating pending markers. Existing booking IDs suppress duplicate ordinary calendar entries when a request marker already represents the current booking. Request markers never create bookings, holds or financial entries.

Both operations calendars retain the original month grid with horizontal weekday headings. The booking calendar uses the full page width without a selected-day sidebar. On narrow screens the calendar stays visible and scrolls inside its own container, so removing the sidebar does not hide appointments. Original day booking, event details, rescheduling and request markers remain available.

Tests cover cross-month moves, midnight end times, current client names, pending versus reviewed requests, cancellation labels, invalid slots and duplicate source rows. Browser verification uses isolated local demo data.
