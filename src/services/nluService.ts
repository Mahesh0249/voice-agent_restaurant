export interface NLUResult {
    intent: 'book_table' | 'confirm' | 'reject' | 'none';
    slots: {
        date?: string;
        time?: string;
        people?: number;
        name?: string;
        phone?: string;
    };
}

export function parseIntentAndSlots(text: string): NLUResult {
    const lowerText = text.toLowerCase();
    const result: NLUResult = {
        intent: 'none',
        slots: {}
    };

    // Regex Rules - Expanded for better coverage
    const dateRegex = /\b(today|tonight|tomorrow|mon|monday|tue|tuesday|wed|wednesday|thu|thursday|fri|friday|sat|saturday|sun|sunday|weekend|next week|this week|\d{1,2}(st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*)\b/i;

    // Time: "7pm", "7:30", "at 7", "7 o'clock", "half past 7", "noon", "midnight"
    const timeRegex = /\b((at\s+)?(1[0-2]|0?[1-9])(:[0-5]\d)?\s*(am|pm|o'clock)?|half past\s+(1[0-2]|0?[1-9])|noon|midnight|lunch|dinner)\b/i;

    // People: "table for 5", "party of 5", "5 people", "5 guests", "just me", "2 of us", "couple", "few"
    const peopleRegex = /\b(table|party|reservation)?\s*(for|of)?\s*(\d+|one|two|three|four|five|six|seven|eight|nine|ten|couple|few)\s*(people|guests|of us)?\b/i;
    const justMeRegex = /\b(just me|only me|single)\b/i;

    const nameRegex = /\b(my name is|this is|i am|it's|it is)\s+([A-Za-z]+)\b/i;
    const phoneRegex = /\b\d{10}\b/;
    const yesRegex = /\b(yes|yeah|sure|confirm|okay|ok|correct|right|fine|good)\b/i;
    const noRegex = /\b(no|nah|don't|cancel|wrong|change|wait|stop)\b/i;

    // Extract Slots
    const dateMatch = lowerText.match(dateRegex);
    if (dateMatch) result.slots.date = dateMatch[0];

    const timeMatch = lowerText.match(timeRegex);
    if (timeMatch) {
        let timeStr = timeMatch[0].replace(/at\s+/i, '').trim().toLowerCase();
        // Map special time words
        if (timeStr === 'noon') timeStr = '12:00 pm';
        else if (timeStr === 'midnight') timeStr = '12:00 am';
        else if (timeStr === 'lunch') timeStr = '1:00 pm';
        else if (timeStr === 'dinner') timeStr = '7:00 pm';
        else {
            // Normalize "7" to "7:00" if AM/PM is missing
            if (!timeStr.includes('am') && !timeStr.includes('pm') && !timeStr.includes('noon') && !timeStr.includes('midnight')) {
                // If it's just a number like "10" or "10:00"
                if (timeStr.match(/^\d+(:00)?$/)) {
                    const hour = parseInt(timeStr.split(':')[0], 10);
                    if (hour >= 1 && hour <= 12) {
                        timeStr = `${hour}:00`;
                    }
                }
            }

            // Handle "half past 7" -> "7:30"
            if (timeStr.includes('half past')) {
                const hour = timeStr.match(/\d+/)?.[0];
                if (hour) timeStr = `${hour}:30`;
            }
        }
        result.slots.time = timeStr;
    }

    const peopleMatch = lowerText.match(peopleRegex);
    if (peopleMatch) {
        // Map words to numbers if necessary
        const wordToNum: { [key: string]: number } = {
            'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
            'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
            'couple': 2, 'few': 3
        };
        const numStr = peopleMatch[3]; // The number part (group 3 in regex)
        if (wordToNum[numStr]) {
            result.slots.people = wordToNum[numStr];
        } else {
            result.slots.people = parseInt(numStr, 10);
        }
    } else if (justMeRegex.test(lowerText)) {
        result.slots.people = 1;
    }

    const nameMatch = lowerText.match(nameRegex);
    if (nameMatch) result.slots.name = nameMatch[2];

    const phoneMatch = lowerText.match(phoneRegex);
    if (phoneMatch) result.slots.phone = phoneMatch[0];

    // Determine Intent
    if (yesRegex.test(lowerText)) {
        result.intent = 'confirm';
    } else if (noRegex.test(lowerText)) {
        result.intent = 'reject';
    } else {
        // If slots are present, assume booking intent
        const hasSlots = Object.keys(result.slots).length > 0;
        if (hasSlots) {
            result.intent = 'book_table';
        }
    }

    return result;
}
