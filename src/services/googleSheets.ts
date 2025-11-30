import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

export interface BookingRow {
    name: string;
    phone: string;
    date: string;
    time: string;
    people: number;
    status: string;
    timestamp: string;
    confirmationId: string;
    callDurationMinutes: number;
}

export class GoogleSheetsService {
    private auth: any;
    private spreadsheetId: string;

    constructor() {
        this.spreadsheetId = process.env.SPREADSHEET_ID || '';

        const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
        const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

        if (email && key) {
            this.auth = new google.auth.JWT({
                email: email,
                key: key,
                scopes: ['https://www.googleapis.com/auth/spreadsheets']
            });
        } else {
            console.warn('Google Sheets credentials missing');
        }
    }

    async appendRow(row: BookingRow): Promise<void> {
        if (!this.auth || !this.spreadsheetId) {
            console.error('Google Sheets Service: Not configured');
            return;
        }

        try {
            const sheets = google.sheets({ version: 'v4', auth: this.auth });

            const values = [
                [
                    row.name,
                    row.phone,
                    row.date,
                    row.time,
                    row.people,
                    row.status,
                    row.timestamp,
                    row.confirmationId,
                    row.callDurationMinutes
                ]
            ];

            await sheets.spreadsheets.values.append({
                spreadsheetId: this.spreadsheetId,
                range: 'Sheet1!A:I', // Adjust sheet name if necessary
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: values
                }
            });

            console.log('Booking saved to Google Sheets');
        } catch (error) {
            console.error('Google Sheets Error:', error);
        }
    }
}
