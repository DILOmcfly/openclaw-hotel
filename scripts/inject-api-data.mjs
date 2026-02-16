import { readFileSync, writeFileSync } from 'fs';

const apiData = readFileSync('/tmp/api-endpoints.json', 'utf-8');
const htmlTemplate = readFileSync('./client/api-docs.html', 'utf-8');

const finalHtml = htmlTemplate.replace('{{API_DATA}}', apiData);

writeFileSync('./client/api-docs.html', finalHtml);
console.log('✓ Injected API data into api-docs.html');
