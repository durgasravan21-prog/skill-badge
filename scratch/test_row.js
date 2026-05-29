const masterSkillsList = [
  { id: 1, name: 'Python Programming' },
  { id: 2, name: 'React Development' }
];

function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function generateRowHTML(name = '', email = '', skillId = '', phone = '') {
  let selectOptions = '';
  (masterSkillsList || []).forEach(skill => {
    const selected = skill.id === skillId ? 'selected' : '';
    selectOptions += `<option value="${skill.id}" ${selected}>${skill.name}</option>`;
  });

  return `
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <span style="font-size:11px; font-weight:700; color:var(--orange-deep); text-transform:uppercase;">Candidate Details</span>
      <button onclick="this.closest('.dispatch-row').remove()" style="background:none; border:none; color:#C62828; cursor:pointer; font-size:11px; font-weight:700;" title="Remove">Remove</button>
    </div>
    <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:8px;">
      <input type="text" placeholder="Candidate Name" value="${escapeHTML(name)}" class="dispatch-name" style="padding:8px 10px; border:1.5px solid var(--gray-200); border-radius:var(--radius-sm); font-size:13px; font-family:var(--font-body); width:100%; box-sizing:border-box; background:var(--white); color:var(--gray-900);" />
      <input type="email" placeholder="Candidate Email" value="${escapeHTML(email)}" class="dispatch-email" style="padding:8px 10px; border:1.5px solid var(--gray-200); border-radius:var(--radius-sm); font-size:13px; font-family:var(--font-body); width:100%; box-sizing:border-box; background:var(--white); color:var(--gray-900);" />
      <input type="tel" placeholder="Phone Number (e.g. +919876543210)" value="${escapeHTML(phone)}" class="dispatch-phone" style="padding:8px 10px; border:1.5px solid var(--gray-200); border-radius:var(--radius-sm); font-size:13px; font-family:var(--font-body); width:100%; box-sizing:border-box; background:var(--white); color:var(--gray-900);" />
    </div>
    <select class="dispatch-skill" style="padding:8px 10px; border:1.5px solid var(--gray-200); border-radius:var(--radius-sm); font-size:13px; font-family:var(--font-body); width:100%; box-sizing:border-box; background:var(--white); color:var(--gray-900);">
      ${selectOptions}
    </select>
  `;
}

console.log(generateRowHTML('David Jones', 'david.jones@gmail.com', 1));
