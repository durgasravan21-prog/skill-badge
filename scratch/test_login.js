// Use native fetch

async function testLogin() {
  const url = 'https://skill-badge-scanner.vercel.app/api/auth/login';
  // const url = 'http://localhost:3000/api/auth/login';
  
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'hr@microsoft.com',
        name: 'Satya Nadella (Microsoft HR)',
        provider: 'Google'
      })
    });
    
    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  }
}

testLogin();
