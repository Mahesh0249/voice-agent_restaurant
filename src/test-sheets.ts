import { GoogleSheetsService } from './services/googleSheets';
import dotenv from 'dotenv';
import path from 'path';

// Load env from the root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function test() {
    console.log('Testing Google Sheets connection...');
    console.log('Email:', process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ? 'Set' : 'Missing');
    console.log('Key:', process.env.GOOGLE_PRIVATE_KEY ? 'Set' : 'Missing');
    console.log('Sheet ID:', process.env.SPREADSHEET_ID ? 'Set' : 'Missing');

    const sheets = new GoogleSheetsService();
    try {
        await sheets.appendRow({
            name: 'Test User',
            phone: '0000000000',
            date: 'Test Date',
            time: 'Test Time',
            people: 1,
            status: 'TEST',
            timestamp: new Date().toISOString(),
            confirmationId: 'TEST-ID',
            callDurationMinutes: 0
        });
        console.log('Successfully appended a test row!');
    } catch (error) {
        console.error('Failed to append row:', error);
    }
}

test();
