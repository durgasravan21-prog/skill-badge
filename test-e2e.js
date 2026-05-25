const http = require('http');

console.log('====================================================');
console.log('   SKILLPROOF AUTOMATED E2E INTEGRATION SUITE v2    ');
console.log('   + Security Hardening + Multi-Tenant Isolation    ');
console.log('====================================================');

const PORT = 8080;

function makeRequest(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const dataString = body ? JSON.stringify(body) : '';
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(dataString)
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: path,
      method: method,
      headers: headers
    };

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: responseBody
        });
      });
    });

    req.on('error', (err) => reject(err));
    if (body) req.write(dataString);
    req.end();
  });
}

async function runTests() {
  let passedTests = 0;
  let failedTests = 0;

  const logTest = (name, assertion) => {
    if (assertion) {
      console.log(`[PASS] ${name}`);
      passedTests++;
    } else {
      console.error(`[FAIL] ${name}`);
      failedTests++;
    }
  };

  try {
    // ═══════════════════════════════════════════════════════
    // 1. SEO & STRUCTURED DATA
    // ═══════════════════════════════════════════════════════
    console.log('\n--- 1. SEO, Canonical & Schema.org JSON-LD ---');
    const landing = await makeRequest('GET', '/index.html');
    logTest('Status 200 for index.html', landing.statusCode === 200);
    logTest('Schema.org JSON-LD verified', landing.body.includes('application/ld+json') && landing.body.includes('"name": "SkillProof"'));
    logTest('Meta keywords verified', landing.body.includes('name="keywords"'));
    logTest('Meta description verified', landing.body.includes('name="description"'));
    logTest('Canonical URL verified', landing.body.includes('rel="canonical"'));

    // ═══════════════════════════════════════════════════════
    // 2. SECURITY HEADERS (Helmet)
    // ═══════════════════════════════════════════════════════
    console.log('\n--- 2. Security Headers Verification ---');
    logTest('X-Content-Type-Options: nosniff', landing.headers['x-content-type-options'] === 'nosniff');
    logTest('X-Download-Options present', !!landing.headers['x-download-options']);
    logTest('X-Powered-By header ABSENT (fingerprint removed)', !landing.headers['x-powered-by']);
    logTest('Referrer-Policy header present', !!landing.headers['referrer-policy']);
    logTest('Strict-Transport-Security present', !!landing.headers['strict-transport-security']);
    logTest('Content-Security-Policy present', !!landing.headers['content-security-policy']);
    logTest('Permissions-Policy present', !!landing.headers['permissions-policy']);

    // ═══════════════════════════════════════════════════════
    // 3. SECURITY STATUS API
    // ═══════════════════════════════════════════════════════
    console.log('\n--- 3. Security Status Endpoint ---');
    const secRes = await makeRequest('GET', '/api/security/status');
    logTest('Security status endpoint returns 200', secRes.statusCode === 200);
    const secData = JSON.parse(secRes.body);
    logTest('Helmet active', secData.helmet === true);
    logTest('Rate limiting active', secData.rateLimiting === true);
    logTest('Input validation active', secData.inputValidation === true);
    logTest('Multi-tenant isolation active', secData.multiTenantIsolation === true);
    logTest('HPP protection active', secData.hppProtection === true);

    // ═══════════════════════════════════════════════════════
    // 4. INPUT VALIDATION
    // ═══════════════════════════════════════════════════════
    console.log('\n--- 4. Input Validation ---');
    const badEmail = await makeRequest('POST', '/api/auth/login', {
      email: 'not-an-email',
      name: 'Test',
      provider: 'Google'
    });
    logTest('Invalid email rejected', badEmail.statusCode === 400);

    const badProvider = await makeRequest('POST', '/api/auth/login', {
      email: 'test@gmail.com',
      name: 'Test',
      provider: 'FakeProvider'
    });
    logTest('Invalid provider rejected', badProvider.statusCode === 400);

    const missingFields = await makeRequest('POST', '/api/auth/login', {
      email: 'test@gmail.com'
    });
    logTest('Missing fields rejected', missingFields.statusCode === 400);

    // ═══════════════════════════════════════════════════════
    // 5. AUTH & MULTI-TENANT COMPANY CREATION
    // ═══════════════════════════════════════════════════════
    console.log('\n--- 5. Multi-Tenant Auth & Company Isolation ---');
    
    // Company A recruiter (Google)
    const authA = await makeRequest('POST', '/api/auth/login', {
      email: 'recruiter.alpha@google.com',
      name: 'Alpha Recruiter',
      provider: 'Google'
    });
    logTest('Company A auth returns 200', authA.statusCode === 200);
    const dataA = JSON.parse(authA.body);
    logTest('Company A user is recruiter', dataA.user.role === 'recruiter');
    logTest('Company A object returned', !!dataA.company);
    logTest('Company A domain is google.com', dataA.company && dataA.company.domain === 'google.com');
    const companyAId = dataA.company ? dataA.company.id : null;

    // Request OTP for Recruiter A
    const otpReqA = await makeRequest('POST', '/api/auth/recruiter-otp/request', {
      email: 'recruiter.alpha@google.com'
    });
    logTest('Recruiter A OTP requested successfully (200)', otpReqA.statusCode === 200);

    // Read OTP code from scratch file
    const fs = require('fs');
    const path = require('path');
    const scratchPath = path.join(__dirname, 'scratch', 'otp_debug.json');
    logTest('OTP debug file exists', fs.existsSync(scratchPath));
    const otpDebugA = JSON.parse(fs.readFileSync(scratchPath, 'utf8'));
    logTest('OTP debug file email matches Recruiter A', otpDebugA.email === 'recruiter.alpha@google.com');

    // Verify OTP for Recruiter A
    const verifyA = await makeRequest('POST', '/api/auth/recruiter-otp/verify', {
      user_id: otpDebugA.userId,
      otp: otpDebugA.otp
    });
    logTest('Recruiter A OTP verified successfully (200)', verifyA.statusCode === 200);
    const verifyDataA = JSON.parse(verifyA.body);
    logTest('Recruiter A sessionToken exists', !!verifyDataA.sessionToken);
    const recruiterAlphaToken = verifyDataA.sessionToken;

    // Company B recruiter (Microsoft)
    const authB = await makeRequest('POST', '/api/auth/login', {
      email: 'recruiter.beta@microsoft.com',
      name: 'Beta Recruiter',
      provider: 'Google'
    });
    logTest('Company B auth returns 200', authB.statusCode === 200);
    const dataB = JSON.parse(authB.body);
    logTest('Company B user is recruiter', dataB.user.role === 'recruiter');
    logTest('Company B is different from A', dataB.company && dataB.company.id !== companyAId);
    const companyBId = dataB.company ? dataB.company.id : null;

    // Request OTP for Recruiter B
    const otpReqB = await makeRequest('POST', '/api/auth/recruiter-otp/request', {
      email: 'recruiter.beta@microsoft.com'
    });
    logTest('Recruiter B OTP requested successfully (200)', otpReqB.statusCode === 200);

    // Read OTP code from scratch file
    logTest('OTP debug file exists for B', fs.existsSync(scratchPath));
    const otpDebugB = JSON.parse(fs.readFileSync(scratchPath, 'utf8'));
    logTest('OTP debug file email matches Recruiter B', otpDebugB.email === 'recruiter.beta@microsoft.com');

    // Verify OTP for Recruiter B
    const verifyB = await makeRequest('POST', '/api/auth/recruiter-otp/verify', {
      user_id: otpDebugB.userId,
      otp: otpDebugB.otp
    });
    logTest('Recruiter B OTP verified successfully (200)', verifyB.statusCode === 200);
    const verifyDataB = JSON.parse(verifyB.body);
    logTest('Recruiter B sessionToken exists', !!verifyDataB.sessionToken);
    const recruiterBetaToken = verifyDataB.sessionToken;

    // Student (no company)
    const studentAuth = await makeRequest('POST', '/api/auth/login', {
      email: 'student.test@gmail.com',
      name: 'Test Student',
      provider: 'Google'
    });
    logTest('Student auth returns 200', studentAuth.statusCode === 200);
    const studentData = JSON.parse(studentAuth.body);
    logTest('Student role detected correctly', studentData.user.role === 'student');
    logTest('Student has no company', studentData.company === null);
    logTest('Student sessionToken exists', !!studentData.sessionToken);
    const studentToken = studentData.sessionToken;

    // ═══════════════════════════════════════════════════════
    // 6. SKILLS & QUESTIONS BANK
    // ═══════════════════════════════════════════════════════
    console.log('\n--- 6. Skills & Questions Bank (Target: ~4000) ---');
    const skillsRes = await makeRequest('GET', '/api/skills');
    logTest('Skills endpoint returns 200', skillsRes.statusCode === 200);
    const skills = JSON.parse(skillsRes.body);
    logTest('14 skills seeded', skills.length === 14);

    const questionsCount = await makeRequest('GET', '/api/questions/count');
    logTest('Questions count endpoint returns 200', questionsCount.statusCode === 200);
    const qCount = JSON.parse(questionsCount.body);
    console.log(`    Questions in database: ${qCount.count}`);
    logTest('Questions count >= 3500 (target ~4000)', qCount.count >= 3500);

    // ═══════════════════════════════════════════════════════
    // 7. COMPANY DATA ISOLATION TEST
    // ═══════════════════════════════════════════════════════
    console.log('\n--- 7. Company Data Isolation Verification ---');

    // Dispatch candidates under Company A
    const targetSkill = skills[0];
    const dispatchA = await makeRequest('POST', '/api/recruiter/dispatch-and-evaluate', {
      candidates: [
        { name: 'Alice Alpha', email: 'alice.alpha@test1.com', skillId: targetSkill.id }
      ],
      company_id: companyAId
    }, recruiterAlphaToken);
    logTest('Company A dispatch returns 200', dispatchA.statusCode === 200);

    // Dispatch candidates under Company B
    const dispatchB = await makeRequest('POST', '/api/recruiter/dispatch-and-evaluate', {
      candidates: [
        { name: 'Bob Beta', email: 'bob.beta@test2.com', skillId: targetSkill.id }
      ],
      company_id: companyBId
    }, recruiterBetaToken);
    logTest('Company B dispatch returns 200', dispatchB.statusCode === 200);

    // Company A should only see its own candidates
    const historyA = await makeRequest('GET', `/api/exams/history?company_id=${companyAId}`, null, recruiterAlphaToken);
    const examsA = JSON.parse(historyA.body);
    const hasOnlyCompanyA = Array.isArray(examsA) && examsA.every(e => e.company_id === companyAId || e.company_id === null);
    logTest('Company A sees only its own candidates', hasOnlyCompanyA);
    const companyAHasAlice = Array.isArray(examsA) && examsA.some(e => e.student_name === 'Alice Alpha');
    logTest('Company A sees Alice Alpha', companyAHasAlice);
    const companyASeeBob = Array.isArray(examsA) && examsA.some(e => e.student_name === 'Bob Beta');
    logTest('Company A does NOT see Bob Beta (isolation!)', !companyASeeBob);

    // Company B should only see its own candidates
    const historyB = await makeRequest('GET', `/api/exams/history?company_id=${companyBId}`, null, recruiterBetaToken);
    const examsB = JSON.parse(historyB.body);
    const companyBHasBob = Array.isArray(examsB) && examsB.some(e => e.student_name === 'Bob Beta');
    logTest('Company B sees Bob Beta', companyBHasBob);
    const companyBSeeAlice = Array.isArray(examsB) && examsB.some(e => e.student_name === 'Alice Alpha');
    logTest('Company B does NOT see Alice Alpha (isolation!)', !companyBSeeAlice);

    // ═══════════════════════════════════════════════════════
    // 8. BULK EMAIL API
    // ═══════════════════════════════════════════════════════
    console.log('\n--- 8. Bulk Email API ---');
    const bulkRes = await makeRequest('POST', '/api/recruiter/send-bulk-email', {
      emails: ['student1@gmail.com', 'student2@yahoo.com'],
      subject: 'SkillProof Verified Assessment',
      body: 'Hello {name}, your score of {score}/100 in {skill} has been approved.'
    }, recruiterAlphaToken);
    logTest('Bulk email returns 200', bulkRes.statusCode === 200);
    logTest('Sent count matches', JSON.parse(bulkRes.body).sentCount === 2);

    // ═══════════════════════════════════════════════════════
    // 9. COMPANIES API
    // ═══════════════════════════════════════════════════════
    console.log('\n--- 9. Companies API ---');
    const companiesRes = await makeRequest('GET', '/api/companies');
    logTest('Companies endpoint returns 200', companiesRes.statusCode === 200);
    const companies = JSON.parse(companiesRes.body);
    logTest('At least 2 companies created', companies.length >= 2);
    const hasGoogle = companies.some(c => c.domain === 'google.com');
    const hasMicrosoft = companies.some(c => c.domain === 'microsoft.com');
    logTest('Google company exists', hasGoogle);
    logTest('Microsoft company exists', hasMicrosoft);

    // ═══════════════════════════════════════════════════════
    // 10. DOTFILE SECURITY
    // ═══════════════════════════════════════════════════════
    console.log('\n--- 10. Dotfile Access Denied ---');
    const dotfileRes = await makeRequest('GET', '/.env');
    logTest('.env file access blocked (not 200)', dotfileRes.statusCode !== 200);

    // ═══════════════════════════════════════════════════════
    // 11. RE-ATTEMPT OVERRIDE SECURITY GATES
    // ═══════════════════════════════════════════════════════
    console.log('\n--- 11. Re-attempt Override Security Gates ---');
    // Try to grant extra attempt when student has 0 attempts (less than maxAllowed=3)
    const grantAttemptRes = await makeRequest('POST', '/api/recruiter/grant-attempt', {
      recruiter_email: 'recruiter.alpha@google.com',
      student_email: 'student.test@gmail.com',
      skill_id: targetSkill.id
    }, recruiterAlphaToken);
    logTest('Grant attempt rejected when attempts are not exhausted (400)', grantAttemptRes.statusCode === 400);
    const grantAttemptData = JSON.parse(grantAttemptRes.body);
    logTest('Accurate error message returned', grantAttemptData.error && grantAttemptData.error.includes('Cannot grant extra attempt'));

    // Try to grant extra attempt with unauthorized user role
    const grantAttemptUnauthorized = await makeRequest('POST', '/api/recruiter/grant-attempt', {
      recruiter_email: 'student.test@gmail.com',
      student_email: 'student.test@gmail.com',
      skill_id: targetSkill.id
    }, studentToken);
    logTest('Grant attempt rejected for unauthorized role (403)', grantAttemptUnauthorized.statusCode === 403);

    // Exhausted candidate test flow
    const exhaustedEmail = `exhausted_${Date.now()}@google.com`;

    // 1. Dispatch candidate once
    await makeRequest('POST', '/api/recruiter/dispatch-and-evaluate', {
      candidates: [{ name: 'Exhausted Candidate', email: exhaustedEmail, skillId: targetSkill.id }],
      company_id: companyAId
    }, recruiterAlphaToken);
    // 2. Dispatch same candidate twice more to reach 3 attempts
    await makeRequest('POST', '/api/recruiter/dispatch-and-evaluate', {
      candidates: [{ name: 'Exhausted Candidate', email: exhaustedEmail, skillId: targetSkill.id }],
      company_id: companyAId
    }, recruiterAlphaToken);
    await makeRequest('POST', '/api/recruiter/dispatch-and-evaluate', {
      candidates: [{ name: 'Exhausted Candidate', email: exhaustedEmail, skillId: targetSkill.id }],
      company_id: companyAId
    }, recruiterAlphaToken);

    // Student now has exactly 3 attempts. Should be able to grant one more!
    const grantExhaustedRes = await makeRequest('POST', '/api/recruiter/grant-attempt', {
      recruiter_email: 'recruiter.alpha@google.com',
      student_email: exhaustedEmail,
      skill_id: targetSkill.id
    }, recruiterAlphaToken);
    logTest('Grant attempt succeeds when standard 3 attempts are exhausted (200)', grantExhaustedRes.statusCode === 200);

    // Try to grant *another* re-attempt when student has only used 3 attempts but allowed is now 4!
    const grantSecondExtraRes = await makeRequest('POST', '/api/recruiter/grant-attempt', {
      recruiter_email: 'recruiter.alpha@google.com',
      student_email: exhaustedEmail,
      skill_id: targetSkill.id
    }, recruiterAlphaToken);
    logTest('Grant second extra attempt fails because attempts (3) < maxAllowed (4) (400)', grantSecondExtraRes.statusCode === 400);

    // ═══════════════════════════════════════════════════════
    // 12. TECHNICAL RESUMPTION RECOVERY ATTEMPTS & LOCKOUT
    // ═══════════════════════════════════════════════════════
    console.log('\n--- 12. Technical Resumption Recovery Attempts & Lockout ---');
    const techStudentEmail = `tech_student_${Date.now()}@google.com`;

    // Dispatch the student first to generate a schedule and initial credentials
    const dispatchTech = await makeRequest('POST', '/api/recruiter/dispatch-and-evaluate', {
      candidates: [{ name: 'Tech Student', email: techStudentEmail, skillId: targetSkill.id }],
      company_id: companyAId
    }, recruiterAlphaToken);
    logTest('Dispatch technical candidate returns 200', dispatchTech.statusCode === 200);

    // Fetch the schedules for the student to retrieve the auto-generated schedule ID and password
    const schedulesRes = await makeRequest('GET', `/api/student/schedules?student_email=${techStudentEmail}`);
    const schedules = JSON.parse(schedulesRes.body);
    logTest('Schedules found for technical candidate', schedules.length > 0);

    const schedule = schedules[0];
    const scheduleId = schedule.id;
    const examPassword = schedule.exam_password || '';

    // Join 1: Start Scheduled (should succeed and initialize challenge with joins_count = 1)
    const join1 = await makeRequest('POST', '/api/exams/start-scheduled', {
      student_email: techStudentEmail,
      schedule_id: scheduleId,
      exam_password: examPassword
    });
    logTest('Join 1 (initial start) succeeds', join1.statusCode === 200);

    // Join 2: First Recovery (should succeed and set joins_count = 2)
    const join2 = await makeRequest('POST', '/api/exams/start-scheduled', {
      student_email: techStudentEmail,
      schedule_id: scheduleId,
      exam_password: examPassword
    });
    logTest('Join 2 (first resumption) succeeds', join2.statusCode === 200);

    // Join 3: Second Recovery (should succeed and set joins_count = 3)
    const join3 = await makeRequest('POST', '/api/exams/start-scheduled', {
      student_email: techStudentEmail,
      schedule_id: scheduleId,
      exam_password: examPassword
    });
    logTest('Join 3 (second resumption) succeeds', join3.statusCode === 200);

    // Join 4: Third Recovery (should succeed and set joins_count = 4)
    const join4 = await makeRequest('POST', '/api/exams/start-scheduled', {
      student_email: techStudentEmail,
      schedule_id: scheduleId,
      exam_password: examPassword
    });
    logTest('Join 4 (third resumption) succeeds', join4.statusCode === 200);

    // Join 5: Fourth Recovery (should fail with 400 because joins_count (4) >= max_joins (4))
    const join5 = await makeRequest('POST', '/api/exams/start-scheduled', {
      student_email: techStudentEmail,
      schedule_id: scheduleId,
      exam_password: examPassword
    });
    logTest('Join 5 (fourth resumption) blocked as expected (400)', join5.statusCode === 400);
    const join5Data = JSON.parse(join5.body);
    logTest('Lockout error message matches', join5Data.error && join5Data.error.includes('technical recovery attempts'));

    // Recruiter grants extra attempt to unlock the lockout
    const grantOverride = await makeRequest('POST', '/api/recruiter/grant-attempt', {
      recruiter_email: 'recruiter.alpha@google.com',
      student_email: techStudentEmail,
      skill_id: targetSkill.id
    }, recruiterAlphaToken);
    logTest('Recruiter override succeeds (200)', grantOverride.statusCode === 200);
    const overrideData = JSON.parse(grantOverride.body);
    logTest('Recruiter override message mentions technical recovery', overrideData.message && overrideData.message.includes('technical recovery'));

    // Join 6: Fifth Recovery (should now succeed after override!)
    const join6 = await makeRequest('POST', '/api/exams/start-scheduled', {
      student_email: techStudentEmail,
      schedule_id: scheduleId,
      exam_password: examPassword
    });
    logTest('Join 6 (resumption after override) succeeds', join6.statusCode === 200);

    // ═══════════════════════════════════════════════════════
    // FINAL SUMMARY
    // ═══════════════════════════════════════════════════════
    console.log('\n====================================================');
    console.log(`TEST SUITE RESULTS: ${passedTests} Passed | ${failedTests} Failed`);
    console.log('====================================================');

    if (failedTests > 0) {
      process.exit(1);
    } else {
      console.log('All E2E validation specifications are successfully satisfied!');
      process.exit(0);
    }

  } catch (err) {
    console.error('CRITICAL: Test execution error:', err);
    process.exit(1);
  }
}

setTimeout(runTests, 500);
