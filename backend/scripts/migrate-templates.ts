/**
 * Migration script to import templates from templates.json to database
 *
 * Usage: npx ts-node scripts/migrate-templates.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const API_URL = process.env.API_URL || 'http://localhost:4004';

interface TemplateJson {
  name: string;
  first_page_patterns: string | string[][];
  last_page_patterns?: string | string[][];
  first_page_negative_patterns?: string | string[][];
  last_page_negative_patterns?: string | string[][];
  category?: string;
  is_single_page?: boolean;
}

async function main() {
  console.log('=== Templates Migration Script ===\n');

  // Read templates.json
  const templatesPath = path.join(process.cwd(), 'templates.json');

  if (!fs.existsSync(templatesPath)) {
    console.error('Error: templates.json not found at', templatesPath);
    process.exit(1);
  }

  const content = fs.readFileSync(templatesPath, 'utf-8');
  const data = JSON.parse(content);
  const templates: TemplateJson[] = data.templates || [];

  console.log(`Found ${templates.length} templates in templates.json\n`);

  // Check if API is available
  try {
    const response = await fetch(`${API_URL}/templates`);
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }
    const existing = await response.json();
    console.log(`Existing templates in DB: ${existing.length}`);

    if (existing.length > 0) {
      console.log('\nWarning: Database already has templates.');
      console.log('Do you want to clear existing templates and import? (This script will proceed in 5 seconds...)');
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Clear existing
      const clearResponse = await fetch(`${API_URL}/templates/clear/all`, {
        method: 'DELETE',
      });
      if (!clearResponse.ok) {
        throw new Error('Failed to clear existing templates');
      }
      console.log('Cleared existing templates.\n');
    }
  } catch (error) {
    console.error('Error connecting to API:', error.message);
    console.log('\nMake sure the backend is running at', API_URL);
    process.exit(1);
  }

  // Import templates
  console.log('Importing templates...\n');

  const importResponse = await fetch(`${API_URL}/templates/import`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ templates }),
  });

  if (!importResponse.ok) {
    const error = await importResponse.text();
    console.error('Error importing templates:', error);
    process.exit(1);
  }

  const result = await importResponse.json();
  console.log(`Successfully imported ${result.count} templates!\n`);

  // Verify
  const verifyResponse = await fetch(`${API_URL}/templates`);
  const imported = await verifyResponse.json();

  console.log('Imported templates:');
  imported.forEach((t: any, i: number) => {
    console.log(`  ${i + 1}. ${t.name} (${t.isActive ? 'active' : 'inactive'})`);
  });

  console.log('\n=== Migration Complete ===');
}

main().catch(console.error);
