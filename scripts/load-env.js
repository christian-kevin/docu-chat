#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const envDir = path.join(__dirname, '..', 'env');
const envFiles = ['supabase.env', 'open-router.env'];

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn(`Warning: ${filePath} not found`);
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}

envFiles.forEach((file) => {
  const filePath = path.join(envDir, file);
  loadEnvFile(filePath);
});

