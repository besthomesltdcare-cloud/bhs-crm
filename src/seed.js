// Fictional sample data so the app is useful on first run. Every person and organisation below is
// invented, apart from Banks and the office number. Dates are relative to the day of first run.
import { transaction } from './db.js';
import { today, addDays } from './dates.js';

const REPS = [
  ['Banks', 'banks@besthomes.example', '020 8075 5833', 'Business Development Manager', 'active'],
  ['Amara Okafor', 'amara.okafor@besthomes.example', '07700 900101', 'Senior Partnerships Lead', 'active'],
  ['Daniel Whitmore', 'daniel.whitmore@besthomes.example', '07700 900102', 'Referrals Coordinator', 'active'],
  ['Priya Raman', 'priya.raman@besthomes.example', '07700 900103', 'Account Manager', 'active'],
  ['Tom Adeyemi', 'tom.adeyemi@besthomes.example', '07700 900104', 'Business Development Executive', 'inactive'],
];

// name, company, email prefix, phone suffix, location, status, rep index (1-based), notes
const CUSTOMERS = [
  ['Helen Marsh', 'Larkfield Community Trust', 'h.marsh@larkfield', '0101', 'Bromley', 'active', 1, 'Commissioning lead. Prefers a call before anything arrives by email.'],
  ['Marcus Bell', 'Ashgrove Housing Group', 'm.bell@ashgrove', '0102', 'Lewisham', 'active', 2, 'Looking for a support partner across two new supported living schemes.'],
  ['Sofia Nowak', 'Oakmere Care Partnership', 's.nowak@oakmere', '0103', 'Southwark', 'active', 3, 'Regular referrer for short-notice respite.'],
  ['James Okoro', 'Brookhollow Social Care', 'j.okoro@brookhollow', '0104', 'Bromley', 'active', 1, 'Annual review of the framework falls in the spring.'],
  ['Laura Fenwick', 'Willowmead Housing', 'l.fenwick@willowmead', '0105', 'Greenwich', 'lead', 4, 'Met at the south London housing forum.'],
  ['Ibrahim Yusuf', 'Harcombe Neuro Rehab', 'i.yusuf@harcombe', '0106', 'Lewisham', 'active', 2, 'Discharge planning contact. Wants clear timescales on proposals.'],
  ['Grace Thompson', 'Fernbank Advocacy', 'g.thompson@fernbank', '0107', 'Lambeth', 'lead', 3, 'Introduced by Sofia at Oakmere.'],
  ['Oliver Hart', 'Kestrel Support Services', 'o.hart@kestrel', '0108', 'Croydon', 'on_hold', 4, 'Budget freeze until the new financial year.'],
  ['Nadia Rahman', 'Meadowside Case Management', 'n.rahman@meadowside', '0109', 'Southwark', 'active', 1, 'Independent case manager. Good source of complex care referrals.'],
  ['Peter Lindqvist', 'Stonebridge Housing Co-op', 'p.lindqvist@stonebridge', '0110', 'Lewisham', 'active', 2, 'Board meets monthly, so decisions take time.'],
  ['Chloe Adams', 'Ravenscourt Family Support', 'c.adams@ravenscourt', '0111', 'Bromley', 'lead', 1, 'Asked for an information pack on supported living.'],
  ['Samuel Osei', 'Hollybrook Community Health', 's.osei@hollybrook', '0112', 'Southwark', 'active', 3, 'Community team manager.'],
  ['Eleanor Voss', 'Cedar Lane Trust', 'e.voss@cedarlane', '0113', 'Bromley', 'active', 4, 'Long-standing contact and a strong reference.'],
  ['Rafael Costa', 'Tidewater Housing Partners', 'r.costa@tidewater', '0114', 'Greenwich', 'lead', 2, 'Exploring new accommodation in the borough.'],
  ['Anita Desai', 'Northgate Care Brokerage', 'a.desai@northgate', '0115', 'Croydon', 'active', 3, 'Brokers packages for several local teams.'],
  ['Michael Greaves', 'Foxhill Autism Network', 'm.greaves@foxhill', '0116', 'Lewisham', 'active', 1, 'Runs a regional practice group that meets quarterly.'],
  ['Zainab Karim', 'Beechwood Supported Homes', 'z.karim@beechwood', '0117', 'Lambeth', 'on_hold', 4, 'Paused while their registration is updated.'],
  ['David Ellison', 'Pinehurst Mental Health Alliance', 'd.ellison@pinehurst', '0118', 'Southwark', 'active', 2, 'Interested in step-down support.'],
  ['Rachel Ng', 'Summerfield Housing Trust', 'r.ng@summerfield', '0119', 'Bromley', 'former', 3, 'Contract ended when the scheme transferred to another landlord.'],
  ['Kwame Boateng', 'Riverbend Social Enterprise', 'k.boateng@riverbend', '0120', 'Lewisham', 'lead', 1, 'Wants to discuss a joint bid.'],
  ['Isabel Moreno', 'Hawthorn Care Consultants', 'i.moreno@hawthorn', '0121', 'Greenwich', 'active', 3, 'Consultant for family-funded care.'],
  ['Stephen Clarke', 'Elmfield Learning Support', 's.clarke@elmfield', '0122', 'Croydon', 'lead', null, 'New enquiry through the website, not yet assigned.'],
  ['Fatima Hassan', 'Birchwood Community Links', 'f.hassan@birchwood', '0123', 'Southwark', 'former', 4, 'Team restructured, contact has moved on.'],
  ['Alan Prescott', 'Whitegate Housing Alliance', 'a.prescott@whitegate', '0124', 'Lambeth', 'active', 2, 'Quarterly review meetings in place.'],
];

// name, value, stage, customer index, rep index, days until expected close, probability
const OPEN_DEALS = [
  ['Supported living, 4 flats', 142000, 'new_lead', 11, 1, 60, 10],
  ['Home care block hours', 38500, 'new_lead', 5, 4, 75, 10],
  ['Respite beds pilot', 24000, 'new_lead', 22, 3, 90, 15],
  ['Autism support framework', 96000, 'new_lead', 20, 1, 80, 10],
  ['Step-down support service', 67000, 'contacted', 18, 2, 55, 20],
  ['Live-in care package', 58000, 'contacted', 21, 3, 40, 25],
  ['Supported living scheme, Phase 1', 186000, 'contacted', 14, 2, 70, 20],
  ['Complex care placement', 112000, 'qualified', 9, 1, 35, 40],
  ['Community outreach hours', 31000, 'qualified', 12, 3, 30, 45],
  ['Supported living, 6 bed house', 214000, 'qualified', 2, 2, 45, 40],
  ['Short breaks contract', 44500, 'proposal', 3, 3, 21, 60],
  ['Mental health support hours', 52000, 'proposal', 24, 2, 25, 55],
  ['Autism outreach service', 73000, 'proposal', 16, 1, 18, -1],
  ['Framework renewal 2026/27', 128000, 'negotiation', 4, 1, 12, 80],
  ['Discharge support pathway', 89000, 'negotiation', 6, 2, 9, 75],
  ['Home care extension', 41000, 'negotiation', 13, 4, 15, 85],
];

// name, value, outcome, customer index, rep index, days ago closed
const CLOSED_DEALS = [
  ['Respite care call-off', 21500, 'won', 3, 3, 3],
  ['Supported living, 3 flats', 118000, 'won', 1, 1, 6],
  ['Home care top-up', 16400, 'lost', 8, 4, 8],
  ['Complex care package', 94000, 'won', 9, 1, 24],
  ['Mental health outreach', 47500, 'won', 18, 2, 33],
  ['Live-in care cover', 36200, 'lost', 17, 4, 41],
  ['Community hours renewal', 28800, 'won', 12, 3, 52],
  ['Supported living, 5 bed house', 176000, 'won', 10, 2, 68],
  ['Autism day support', 42300, 'won', 16, 1, 84],
  ['Respite framework', 33500, 'lost', 15, 3, 95],
  ['Home care contract', 61000, 'won', 13, 4, 112],
  ['Supported living scheme, Phase 2', 158000, 'won', 2, 2, 131],
  ['Short breaks', 18900, 'lost', 19, 3, 146],
  ['Complex care pathway', 83000, 'won', 6, 2, 163],
  ['Family-funded live-in care', 54000, 'won', 21, 3, 182],
  ['Outreach hours', 26500, 'lost', 23, 4, 199],
  ['Framework call-off', 71500, 'won', 4, 1, 214],
  ['Supported living, 2 flats', 79000, 'won', 24, 2, 236],
  ['Home care block', 39000, 'won', 15, 3, 257],
  ['Respite pilot', 22000, 'lost', 7, 3, 273],
  ['Autism outreach pilot', 35500, 'won', 16, 1, 296],
  ['Community support', 48000, 'won', 13, 5, 318],
  ['Supported living review', 66000, 'lost', 19, 5, 335],
];

// title, description, days from today, priority, status, rep, customer index, deal index (open list)
const TASKS = [
  ['Send revised pricing to Ashgrove', 'Include the 6 bed house option.', -4, 'high', 'in_progress', 2, 2, 10],
  ['Chase signed framework terms', 'Awaiting countersignature.', -2, 'high', 'todo', 1, 4, 14],
  ['Follow up Fernbank introduction', '', -1, 'medium', 'todo', 3, 7, null],
  ['Update referral pathway document', 'Reflect the new respite capacity.', -6, 'low', 'todo', 4, null, null],
  ['Call Helen about capacity', 'Confirm next quarter numbers.', 0, 'high', 'todo', 1, 1, null],
  ['Prepare discharge pathway summary', '', 0, 'medium', 'in_progress', 2, 6, 15],
  ['Book visit to Oakmere', '', 0, 'low', 'todo', 3, 3, 11],
  ['Send information pack to Ravenscourt', 'Supported living overview.', 1, 'medium', 'todo', 1, 11, 1],
  ['Draft proposal for Foxhill outreach', '', 2, 'high', 'in_progress', 1, 16, 13],
  ['Review live-in care rota costs', '', 3, 'medium', 'todo', 3, 21, 6],
  ['Confirm Whitegate review date', '', 4, 'low', 'todo', 2, 24, 12],
  ['Prepare Cedar Lane contract variation', '', 5, 'medium', 'todo', 4, 13, 16],
  ['Introduce Tidewater to the team', '', 6, 'low', 'todo', 2, 14, 7],
  ['Qualify Meadowside referral', 'Check staffing and start date.', 7, 'high', 'todo', 1, 9, 8],
  ['Quarterly practice group talk', 'Slides for the Foxhill network.', 12, 'medium', 'todo', 1, 16, null],
  ['Review pipeline with the team', '', 14, 'medium', 'todo', 1, null, null],
  ['Send thank-you to Northgate', '', -9, 'low', 'done', 3, 15, null],
  ['Log outcome of Larkfield contract', '', -5, 'medium', 'done', 1, 1, null],
  ['Update Hollybrook contact details', '', -3, 'low', 'done', 3, 12, null],
  ['Issue Pinehurst start confirmation', '', -2, 'high', 'done', 2, 18, null],
];

export function seedIfEmpty(db) {
  if (Number(db.prepare('SELECT COUNT(*) n FROM reps').get().n) > 0) return;
  const t = today();
  const stamp = (daysAgo, hour = 9) => { const d = new Date(`${addDays(t, -daysAgo)}T00:00:00`); d.setHours(hour, 15 + (daysAgo % 40)); return new Date(Math.min(d.getTime(), Date.now() - (daysAgo + 1) * 600000)).toISOString(); };
  const STAGE_NAME = { new_lead: 'New Lead', contacted: 'Contacted', qualified: 'Qualified', proposal: 'Proposal', negotiation: 'Negotiation' };
  // Keep "this month" wins in this month, whatever day of the month the app is first run.
  const dayOfMonth = Number(t.slice(8));
  const inMonth = (daysAgo) => (daysAgo <= 6 ? Math.min(daysAgo, dayOfMonth - 1) : daysAgo);

  transaction(db, () => {
    const insRep = db.prepare('INSERT INTO reps (name,email,phone,role,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)');
    const insCustomer = db.prepare('INSERT INTO customers (name,company,email,phone,location,status,rep_id,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)');
    const insDeal = db.prepare(`INSERT INTO deals (name,value_p,close_date,stage,outcome,probability,notes,customer_id,rep_id,closed_on,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
    const insTask = db.prepare(`INSERT INTO tasks (title,description,due_date,priority,status,rep_id,customer_id,deal_id,completed_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
    const insActivity = db.prepare('INSERT INTO activity (kind,message,customer_id,deal_id,actor_id,created_at) VALUES (?,?,?,?,?,?)');
    const insNote = db.prepare('INSERT INTO notifications (rep_id,type,title,body,link,read_at,created_at) VALUES (?,?,?,?,?,?,?)');

    REPS.forEach(([name, email, phone, role, status], i) => {
      const ts = stamp(380 - i * 12);
      insRep.run(name, email, phone, role, status, ts, ts);
    });

    CUSTOMERS.forEach(([name, company, email, phone, location, status, rep, notes], i) => {
      const ts = stamp(i % 3 === 0 ? 20 + i : 150 + i * 9, 10);
      insCustomer.run(name, company, `${email}.example`, `020 7946 ${phone}`, location, status, rep, notes, ts, ts);
      insActivity.run('customer_created', `Customer "${name}" added`, i + 1, null, rep, ts);
    });

    const dealId = new Map();
    OPEN_DEALS.forEach(([name, value, stage, customer, rep, due, prob], i) => {
      const created = stamp(8 + (i * 5) % 40, 11);
      const closeDate = addDays(t, due);
      const res = insDeal.run(name, value * 100, closeDate, stage, null, prob < 0 ? 65 : prob, '', customer, rep, null, created, created);
      const id = Number(res.lastInsertRowid);
      dealId.set(i + 1, id);
      insActivity.run('deal_created', `Deal "${name}" created in New Lead`, customer, id, rep, created);
      if (stage !== 'new_lead') insActivity.run('deal_stage', `Deal "${name}" moved from New Lead to ${STAGE_NAME[stage]}`, customer, id, rep, stamp((i * 3) % 7, 14));
    });

    CLOSED_DEALS.forEach(([name, value, outcome, customer, rep, daysAgo]) => {
      const closed = addDays(t, -inMonth(daysAgo));
      const created = stamp(daysAgo + 45, 11);
      const when = stamp(inMonth(daysAgo), 16);
      const res = insDeal.run(name, value * 100, closed, 'closed', outcome, outcome === 'won' ? 100 : 0, '', customer, rep, closed, created, when);
      const id = Number(res.lastInsertRowid);
      insActivity.run('deal_created', `Deal "${name}" created in New Lead`, customer, id, rep, created);
      insActivity.run(`deal_${outcome}`, `Deal "${name}" marked ${outcome === 'won' ? 'Won' : 'Lost'} at £${value.toLocaleString('en-GB')}`, customer, id, rep, when);
    });

    TASKS.forEach(([title, description, offset, priority, status, rep, customer, deal]) => {
      const created = stamp(Math.max(1, 12 - offset), 9);
      const completed = status === 'done' ? stamp(Math.abs(offset), 15) : null;
      const dealFk = deal ? dealId.get(deal) : null;
      insTask.run(title, description, addDays(t, offset), priority, status, rep, customer, dealFk, completed, created, completed ?? created);
      if (status === 'done') insActivity.run('task_done', `Task "${title}" completed`, customer, dealFk, rep, completed);
    });

    const notes = [
      ['deal_won', 'Deal marked Won', 'Supported living, 3 flats (£118,000)', '#/deals/18', null, 6],
      ['task_assigned', 'Task assigned to you', 'Call Helen about capacity', '#/tasks/5', null, 1],
      ['deal_stage', 'Deal moved to Negotiation', 'Framework renewal 2026/27', `#/deals/${dealId.get(14)}`, null, 2],
      ['deal_assigned', 'Deal assigned to you', 'Autism support framework', `#/deals/${dealId.get(4)}`, stamp(4, 12), 5],
      ['task_assigned', 'Task assigned to you', 'Draft proposal for Foxhill outreach', '#/tasks/9', stamp(5, 12), 6],
      ['deal_lost', 'Deal marked Lost', 'Respite pilot (£22,000)', '#/deals', stamp(12, 12), 14],
    ];
    notes.forEach(([type, title, body, link, read, daysAgo]) => insNote.run(1, type, title, body, link, read, stamp(daysAgo, 13)));
    insNote.run(2, 'deal_stage', 'Deal moved to Negotiation', 'Discharge support pathway', `#/deals/${dealId.get(15)}`, null, stamp(1, 13));
    insNote.run(3, 'deal_won', 'Deal marked Won', 'Respite care call-off (£21,500)', '#/deals/17', null, stamp(3, 13));
    insNote.run(4, 'task_assigned', 'Task assigned to you', 'Prepare Cedar Lane contract variation', '#/tasks/12', null, stamp(2, 13));
  });
}
