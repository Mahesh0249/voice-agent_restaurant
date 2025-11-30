import { v4 as uuidv4 } from 'uuid';
import { getSlotCount, incrementSlot, lockSlot, unlockSlot } from '../infra/redis';
import { GoogleSheetsService } from '../services/googleSheets';
import { parseIntentAndSlots, NLUResult } from '../services/nluService';
import { VOICES } from '../config/voiceConfig';

// States
enum State {
    WELCOME = 'WELCOME',
    COLLECT_INFO = 'COLLECT_INFO',
    COLLECT_CONTACT = 'COLLECT_CONTACT',
    CHECK_AVAILABILITY = 'CHECK_AVAILABILITY',
    CONFIRM = 'CONFIRM',
    FINALIZE = 'FINALIZE',
}

interface SessionData {
    id: string;
    state: State;
    slots: {
        date?: string;
        time?: string;
        people?: number;
        name?: string;
        phone?: string;
    };
    startTimestamp: number;
    endTimestamp?: number;
    phoneAttempts: number;
}

export class DialogueManager {
    private sessions: Map<string, SessionData> = new Map();
    private sheets: GoogleSheetsService;

    constructor() {
        this.sheets = new GoogleSheetsService();
    }

    createSession(): string {
        const id = uuidv4();
        this.sessions.set(id, {
            id,
            state: State.WELCOME,
            slots: {},
            startTimestamp: Date.now(),
            phoneAttempts: 0
        });
        return id;
    }

    async handleInput(sessionId: string, text: string): Promise<{ text: string; voice: string; shouldEnd?: boolean; booking?: any }> {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return { text: "Session not found.", voice: VOICES.NEUTRAL, shouldEnd: true };
        }

        // Process NLU
        const nluResult = parseIntentAndSlots(text);

        // Update slots with any new info found
        session.slots = { ...session.slots, ...nluResult.slots };

        // Handle Time Clarification (Morning/Evening)
        if (session.slots.time && !this.isTimeSpecific(session.slots.time)) {
            const lowerText = text.toLowerCase();
            if (lowerText.includes('morning') || lowerText.includes('am')) {
                session.slots.time = session.slots.time + ' am';
            } else if (lowerText.includes('evening') || lowerText.includes('pm') || lowerText.includes('night')) {
                session.slots.time = session.slots.time + ' pm';
            }
        }
        // State Machine
        switch (session.state) {
            case State.WELCOME:
                session.state = State.COLLECT_INFO;
                return {
                    text: "Hi there! ... Welcome to The Gourmet Bistro. ... I can help you book a table. ... When would you like to come?",
                    voice: VOICES.FORMAL
                };

            case State.COLLECT_INFO:
                // Check if we have date, time, people
                if (!session.slots.date) {
                    return { text: "Sure... for which day do you want the table?", voice: VOICES.FORMAL };
                }
                if (!session.slots.time) {
                    return { text: "Okay... what time should I book it for?", voice: VOICES.FORMAL };
                }

                // Check for ambiguous time
                if (!this.isTimeSpecific(session.slots.time)) {
                    return { text: "Is that for the morning... or evening?", voice: VOICES.FORMAL };
                }

                // Handle Silence Timeout
                if (text === 'SILENCE_TIMEOUT') {
                    if (!session.slots.date) return { text: "Are you still there? ... Which day would you like to book?", voice: VOICES.FORMAL };
                    if (!session.slots.time) return { text: "I'm listening... what time works for you?", voice: VOICES.FORMAL };
                    if (!this.isTimeSpecific(session.slots.time)) return { text: "Morning or evening?", voice: VOICES.FORMAL };
                    if (!session.slots.people) return { text: "How many people are joining?", voice: VOICES.FORMAL };
                    if (!session.slots.name) return { text: "I still need your name for the booking.", voice: VOICES.FORMAL };
                }

                if (!session.slots.people) {
                    return { text: "And... for how many people?", voice: VOICES.FORMAL };
                }

                // Name fallback: If we are asking for name and NLU didn't catch it, but user said something short
                if (!session.slots.name) {
                    // If the user just said a name like "Mahesh", NLU might miss it if it expects "My name is..."
                    // If we have all other slots, and input is short, assume it's the name.
                    // CRITICAL FIX: Ensure this input wasn't just used to fill other slots (like people)
                    const slotsFoundInThisTurn = Object.keys(nluResult.slots).length > 0;

                    if (!slotsFoundInThisTurn && session.slots.date && session.slots.time && session.slots.people) {
                        const words = text.trim().split(/\s+/);
                        if (words.length <= 3 && !text.toLowerCase().includes('no') && !text.toLowerCase().includes('yes')) {
                            session.slots.name = text.trim();
                            // Proceed to check availability immediately
                            session.state = State.CHECK_AVAILABILITY;
                            return this.checkAvailability(session);
                        }
                    }
                    return { text: "Can I get your name please?", voice: VOICES.FORMAL };
                }

                // All contact info collected, check availability
                session.state = State.CHECK_AVAILABILITY;
                return this.checkAvailability(session);

            case State.CHECK_AVAILABILITY:
                // Should be triggered automatically, but if we are here via input, re-run check
                return this.checkAvailability(session);

            case State.CONFIRM:
                // Check if user is changing details (providing new slots)
                if (Object.keys(nluResult.slots).length > 0) {
                    // Unlock previous slot if we had one
                    if (session.slots.date && session.slots.time) {
                        const hour = this.extractHour(session.slots.time);
                        await unlockSlot(session.slots.date, hour, session.id);
                    }

                    // Update slots with new info
                    session.slots = { ...session.slots, ...nluResult.slots };

                    // Re-check availability with new details
                    session.state = State.CHECK_AVAILABILITY;
                    return this.checkAvailability(session);
                }


                if (nluResult.intent === 'confirm' || text.toLowerCase().includes('yes') || text.toLowerCase().includes('ok') || text.toLowerCase().includes('yeah')) {
                    session.state = State.FINALIZE;
                    return this.finalizeBooking(session);
                } else if (nluResult.intent === 'reject' || text.toLowerCase().includes('no')) {
                    // Unlock slot if we had locked it
                    if (session.slots.date && session.slots.time) {
                        const hour = this.extractHour(session.slots.time);
                        await unlockSlot(session.slots.date, hour, session.id);
                    }
                    return { text: "No problem... I've cancelled that. ... Let me know if you need anything else.", voice: VOICES.FORMAL, shouldEnd: true };
                } else {
                    return { text: "Sorry... I didn't get that. ... Do you want me to confirm the booking? ... Just say yes or no.", voice: VOICES.FORMAL };
                }

            case State.FINALIZE:
                return { text: "Your booking is already done.", voice: VOICES.FORMAL, shouldEnd: true };

            default:
                return { text: "Sorry... I'm a bit lost. ... Can you say that again?", voice: VOICES.NEUTRAL };
        }
    }

    private async checkAvailability(session: SessionData): Promise<{ text: string; voice: string }> {
        const { date, time } = session.slots;
        if (!date || !time) return { text: "Wait... I missed the date or time.", voice: VOICES.NEUTRAL };

        const hour = this.extractHour(time);
        const count = await getSlotCount(date, hour);

        if (count >= 10) {
            // Full
            return {
                text: "Sorry... that time is full. ... Can we do 30 minutes earlier or later?",
                voice: VOICES.FORMAL
            };
        } else {
            // Available
            const locked = await lockSlot(date, hour, session.id);
            if (locked) {
                session.state = State.CONFIRM;
                return {
                    text: `Okay... I have a table for ${session.slots.people} on ${date} at ${time}. ... Should I confirm it?`,
                    voice: VOICES.FORMAL
                };
            } else {
                return { text: "Ah... someone just took that spot. ... Can we try a different time?", voice: VOICES.FORMAL };
            }
        }
    }

    private async finalizeBooking(session: SessionData): Promise<{ text: string; voice: string; shouldEnd: boolean; booking?: any }> {
        const confirmationId = `R-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${uuidv4().substring(0, 4).toUpperCase()}`;
        session.endTimestamp = Date.now();
        const durationMinutes = (session.endTimestamp - session.startTimestamp) / 60000;

        const bookingRow = {
            name: session.slots.name || 'Unknown',
            phone: session.slots.phone || 'Unknown',
            date: session.slots.date || 'Unknown',
            time: session.slots.time || 'Unknown',
            people: session.slots.people || 0,
            status: 'CONFIRMED',
            timestamp: new Date().toISOString(),
            confirmationId,
            callDurationMinutes: durationMinutes
        };

        // Write to Sheets (Async)
        this.sheets.appendRow(bookingRow);

        // Unlock slot (since we are confirmed, we technically 'consumed' it, but for this logic we unlock the temporary lock)
        // In a real system, we would have a permanent booking record instead of just a lock.
        // Here we increment the slot count permanently.
        if (session.slots.date && session.slots.time) {
            const hour = this.extractHour(session.slots.time);
            await incrementSlot(session.slots.date, hour);
            await unlockSlot(session.slots.date, hour, session.id);
        }

        return {
            text: `Great! ... Your booking is confirmed. ... Your ID is ${confirmationId}. ... See you soon!`,
            voice: VOICES.FORMAL,
            shouldEnd: true,
            booking: bookingRow
        };
    }

    private extractHour(time: string): string {
        const match = time.match(/\d+/);
        return match ? match[0] : '0';
    }

    private isTimeSpecific(time: string): boolean {
        const lower = time.toLowerCase();
        return lower.includes('am') || lower.includes('pm') || lower.includes('noon') || lower.includes('midnight');
    }
}
