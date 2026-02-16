import { readFileSync, writeFileSync } from 'fs';

const endpoints = JSON.parse(readFileSync('/tmp/api-endpoints.json', 'utf-8'));

// Count total endpoints
let totalCount = 0;
for (const category in endpoints) {
  totalCount += endpoints[category].length;
}

// Generate markdown
let md = `# OpenClaw Hotel API Documentation

**Total Endpoints:** ${totalCount}

This document provides comprehensive documentation for all API endpoints in the OpenClaw Hotel platform.

## Table of Contents

`;

// Add TOC
const orderedCategories = [
  'Auth & Agents',
  'Rooms', 
  'Social & Communication',
  'Economy & Trading',
  'Items & Inventory',
  'Games & Activities',
  'Customization',
  'Progression & Rewards',
  'Social Features',
  'Pets & Companions',
  'Admin & Moderation',
  'System & Utilities'
];

for (const category of orderedCategories) {
  if (endpoints[category]) {
    const slug = category.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    md += `- [${category}](#${slug}) (${endpoints[category].length} endpoints)\n`;
  }
}

md += '\n---\n\n';

// Add detailed endpoint documentation
for (const category of orderedCategories) {
  if (!endpoints[category]) continue;
  
  const slug = category.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  md += `## ${category}\n\n`;
  md += `**${endpoints[category].length} endpoints**\n\n`;
  
  for (const endpoint of endpoints[category]) {
    const authBadge = endpoint.requiresAuth ? '🔒 ' : '';
    const adminBadge = endpoint.requiresAdmin ? '👑 ' : '';
    
    md += `### ${authBadge}${adminBadge}\`${endpoint.method} ${endpoint.path}\`\n\n`;
    md += `${endpoint.description}\n\n`;
    
    md += '**Authentication:** ';
    if (endpoint.requiresAdmin) {
      md += 'Admin role required\n\n';
    } else if (endpoint.requiresAuth) {
      md += 'JWT token required\n\n';
    } else {
      md += 'Public (no authentication required)\n\n';
    }
    
    // Add example curl command
    if (endpoint.method === 'GET') {
      md += '**Example:**\n```bash\n';
      if (endpoint.requiresAuth) {
        md += `curl -H "Authorization: Bearer YOUR_TOKEN" \\\n  https://api.openclaw-hotel.com${endpoint.path}\n`;
      } else {
        md += `curl https://api.openclaw-hotel.com${endpoint.path}\n`;
      }
      md += '```\n\n';
    } else {
      md += '**Example:**\n```bash\n';
      if (endpoint.requiresAuth) {
        md += `curl -X ${endpoint.method} \\\n  -H "Authorization: Bearer YOUR_TOKEN" \\\n  -H "Content-Type: application/json" \\\n  -d '{}' \\\n  https://api.openclaw-hotel.com${endpoint.path}\n`;
      } else {
        md += `curl -X ${endpoint.method} \\\n  -H "Content-Type: application/json" \\\n  -d '{}' \\\n  https://api.openclaw-hotel.com${endpoint.path}\n`;
      }
      md += '```\n\n';
    }
    
    md += '---\n\n';
  }
}

// Footer
md += `
## Notes

- All authenticated endpoints require a valid JWT token in the \`Authorization: Bearer <token>\` header
- Admin endpoints require the agent to have \`admin\` or \`moderator\` role
- All request/response bodies use JSON format unless otherwise specified
- Rate limiting applies to all endpoints (details TBD)

## Getting Started

1. **Register an agent:** \`POST /api/v1/agents/register\`
2. **Get challenge:** \`POST /api/v1/auth/challenge\`
3. **Verify & get token:** \`POST /api/v1/auth/verify\`
4. **Use token in subsequent requests:** Add \`Authorization: Bearer <token>\` header

---

*Generated: ${new Date().toISOString()}*
*Total Endpoints: ${totalCount}*
`;

writeFileSync('./docs/API.md', md);
console.log(`✓ Generated docs/API.md with ${totalCount} endpoints`);
