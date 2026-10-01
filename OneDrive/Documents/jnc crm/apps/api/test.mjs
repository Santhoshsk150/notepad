import fetch from 'node-fetch'; 
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';

const BASE_URL = 'http://localhost:3333/api/v1';

async function runTests() {
  const loginRes = await fetch(BASE_URL + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'owner@jncnetwork.com', password: process.env.TEST_PASSWORD || 'Jnc#Boss5798!' })
  });
  const token = (await loginRes.json()).access_token;
  if (!token) throw new Error('Login failed');
  const headers = { 'Authorization': 'Bearer ' + token };
  
  const seedRes = await fetch(BASE_URL + '/inventory/seed-products', { method: 'POST', headers });
  console.log('Seed:', await seedRes.json());
}
runTests().catch(console.error);
