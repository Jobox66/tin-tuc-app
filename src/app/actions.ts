"use server";

import { google } from 'googleapis';
import { revalidatePath } from 'next/cache';
import { getAuthClient } from '@/lib/google-sheets';

export async function updateArticleStatus(
    url: string,
    field: 'isHidden' | 'isSaved',
    value: boolean,
    sheetName: string = 'Sheet1'
) {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) throw new Error('GOOGLE_SHEET_ID missing');

    try {
        const auth = getAuthClient();
        const sheets = google.sheets({ version: 'v4', auth });

        // 1. Find the article by URL in the sheet
        // We fetch only the URL column to be efficient
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${sheetName}!C:C`, // Column C is URL
        });

        const rows = response.data.values;
        if (!rows) throw new Error('No data in sheet');

        // Find the row index (note: response is 0-indexed, Sheet is 1-indexed)
        const rowIndex = rows.findIndex(row => row[0] === url);
        if (rowIndex === -1) {
            console.error(`Article with URL ${url} not found in sheet ${sheetName}`);
            return { success: false, error: 'Article not found' };
        }

        // Row numbers in Sheets are 1-based, and our range skip headers (A2:H)
        // C:C includes the header (C1), so rowIndex 1 matches Row 2.
        const actualRow = rowIndex + 1;
        const colLetter = field === 'isHidden' ? 'G' : 'H';
        const range = `${sheetName}!${colLetter}${actualRow}`;

        // 2. Update the cell
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range,
            valueInputOption: 'RAW',
            requestBody: {
                values: [[value ? 'TRUE' : 'FALSE']],
            },
        });

        console.log(`Successfully updated ${field} to ${value} for ${url} in ${sheetName}`);

        // Revalidate the page to show updated data
        revalidatePath('/');
        return { success: true };
    } catch (error) {
        console.error('Error updating article status:', error);
        return { success: false, error: 'Failed to update Google Sheets' };
    }
}
