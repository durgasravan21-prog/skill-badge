// Using native fetch

async function testSessionFlow() {
  const baseUrl = 'https://skill-badge-scanner.vercel.app';
  // const baseUrl = 'http://localhost:3000';
  
  try {
    console.log('1. Logging in...');
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'hr@microsoft.com',
        name: 'Satya Nadella (Microsoft HR)',
        provider: 'Google'
      })
    });
    const loginData = await loginRes.json();
    console.log('Login Response:', loginData);
    
    console.log('\n2. Requesting OTP...');
    const otpRes = await fetch(`${baseUrl}/api/auth/recruiter-otp/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'hr@microsoft.com' })
    });
    const otpData = await otpRes.json();
    console.log('OTP Request Response:', otpData);

    console.log('\n3. Verifying Master OTP "123456"...');
    const verifyRes = await fetch(`${baseUrl}/api/auth/recruiter-otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: loginData.user.id,
        otp: '123456'
      })
    });
    const verifyData = await verifyRes.json();
    console.log('Verify Response:', verifyData);

    if (verifyData.sessionToken) {
      const token = verifyData.sessionToken;
      console.log('\n4. Fetching /api/recruiter/schedules with sessionToken...');
      const schedRes = await fetch(`${baseUrl}/api/recruiter/schedules?company_id=${verifyData.company.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      console.log('Schedules Status:', schedRes.status);
      const schedData = await schedRes.json();
      console.log('Schedules Response:', schedData);
    }
  } catch (err) {
    console.error('Error during flow:', err.message);
  }
}

testSessionFlow();
