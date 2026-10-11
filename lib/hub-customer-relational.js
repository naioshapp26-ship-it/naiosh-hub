/**
 * Normalized customer center store (Postgres tables).
 * Source of truth when DATABASE_URL is set; hub_meta JSON blobs kept as rollback mirrors.
 * Does NOT create a parallel auth system — links to hub_users by email/customer_id.
 */
'use strict';

const crypto = require('crypto');

const CHECKPOINT = 'customer_relational_v1';

function dbEnabled() {
  try {
    return !!require('../db/migrate').getDatabaseUrl();
  } catch {
    return false;
  }
}

function normEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

function makeCustomerId(email) {
  return `CL-${crypto.createHash('sha1').update(normEmail(email)).digest('hex').slice(0, 8).toUpperCase()}`;
}

function makeAccountNo(email) {
  return `ACC-${crypto.createHash('sha1').update(normEmail(email)).digest('hex').slice(0, 8).toUpperCase()}`;
}

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
}

async function withClient(fn) {
  const { withClient: wc } = require('../db/migrate');
  return wc(fn);
}

async function upsertClientAccount(client = {}) {
  if (!dbEnabled()) return { ok: false, skipped: true };
  const email = normEmail(client.email);
  if (!email) return { ok: false, error: 'email required' };
  const customerId = client.customerId || client.clientId || makeCustomerId(email);
  const clientId = client.clientId || customerId;
  const accountNo = client.accountNo || makeAccountNo(email);
  await withClient(async (c) => {
    await c.query(
      `INSERT INTO hub_client_accounts (
         email, customer_id, client_id, account_no, name, phone, status, lifecycle, account_level,
         company, country, city, address, client_type, activity_type, language, avatar_url, naiosh_id,
         wallet, onboarding, systems, notifications, activity, internal_notes, extras,
         created_via, created_by_email, created_by_employee_id, last_login_at, created_at, updated_at
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,
         $10,$11,$12,$13,$14,$15,$16,$17,$18,
         $19::jsonb,$20::jsonb,$21::jsonb,$22::jsonb,$23::jsonb,$24::jsonb,$25::jsonb,
         $26,$27,$28,$29,$30,$31
       )
       ON CONFLICT (email) DO UPDATE SET
         customer_id = COALESCE(EXCLUDED.customer_id, hub_client_accounts.customer_id),
         client_id = COALESCE(NULLIF(EXCLUDED.client_id,''), hub_client_accounts.client_id),
         account_no = COALESCE(NULLIF(EXCLUDED.account_no,''), hub_client_accounts.account_no),
         name = COALESCE(NULLIF(EXCLUDED.name,''), hub_client_accounts.name),
         phone = COALESCE(NULLIF(EXCLUDED.phone,''), hub_client_accounts.phone),
         status = COALESCE(EXCLUDED.status, hub_client_accounts.status),
         lifecycle = COALESCE(EXCLUDED.lifecycle, hub_client_accounts.lifecycle),
         account_level = COALESCE(EXCLUDED.account_level, hub_client_accounts.account_level),
         company = COALESCE(EXCLUDED.company, hub_client_accounts.company),
         country = COALESCE(EXCLUDED.country, hub_client_accounts.country),
         city = COALESCE(EXCLUDED.city, hub_client_accounts.city),
         address = COALESCE(EXCLUDED.address, hub_client_accounts.address),
         client_type = COALESCE(EXCLUDED.client_type, hub_client_accounts.client_type),
         activity_type = COALESCE(EXCLUDED.activity_type, hub_client_accounts.activity_type),
         language = COALESCE(EXCLUDED.language, hub_client_accounts.language),
         avatar_url = COALESCE(NULLIF(EXCLUDED.avatar_url,''), hub_client_accounts.avatar_url),
         naiosh_id = COALESCE(EXCLUDED.naiosh_id, hub_client_accounts.naiosh_id),
         wallet = COALESCE(EXCLUDED.wallet, hub_client_accounts.wallet),
         onboarding = COALESCE(EXCLUDED.onboarding, hub_client_accounts.onboarding),
         systems = COALESCE(EXCLUDED.systems, hub_client_accounts.systems),
         notifications = COALESCE(EXCLUDED.notifications, hub_client_accounts.notifications),
         activity = COALESCE(EXCLUDED.activity, hub_client_accounts.activity),
         internal_notes = COALESCE(EXCLUDED.internal_notes, hub_client_accounts.internal_notes),
         extras = COALESCE(EXCLUDED.extras, hub_client_accounts.extras),
         last_login_at = COALESCE(EXCLUDED.last_login_at, hub_client_accounts.last_login_at),
         updated_at = NOW()`,
      [
        email,
        customerId,
        clientId,
        accountNo,
        client.name || email,
        client.phone || '',
        client.status || 'active',
        client.lifecycle || 'ONBOARDING',
        client.accountLevel || 'أساسي',
        client.company || '',
        client.country || '',
        client.city || '',
        client.address || '',
        client.clientType || '',
        client.activityType || '',
        client.language || 'ar',
        client.avatarUrl || '',
        client.naioshId || '',
        JSON.stringify(client.wallet || { paid: 0, free: 0, total: 0, ledger: [] }),
        JSON.stringify(client.onboarding || {}),
        JSON.stringify(client.systems || []),
        JSON.stringify(client.notifications || []),
        JSON.stringify(client.activity || []),
        JSON.stringify(client.internalNotes || []),
        JSON.stringify(client.extras || {}),
        client.createdVia || '',
        client.createdByEmail || '',
        client.createdByEmployeeId || '',
        client.lastLoginAt || null,
        client.createdAt || new Date().toISOString(),
        client.updatedAt || new Date().toISOString(),
      ]
    );
  });
  return { ok: true, email, customerId, clientId, accountNo };
}

async function upsertProfileRow(profile = {}) {
  if (!dbEnabled()) return { ok: false, skipped: true };
  const email = normEmail(profile.email);
  if (!email) return { ok: false, error: 'email required' };
  const profileId = profile.profileId || uid('PRF');
  const accountNo = profile.accountNo || makeAccountNo(email);
  let resolvedProfileId = profileId;
  await withClient(async (c) => {
    const up = await c.query(
      `INSERT INTO hub_profiles (
         profile_id, account_no, email, full_name, phone, avatar_url, status,
         department, org_name, title, active_persona, public_opt_in, documents,
         city, country, personas, extras, created_at, updated_at
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,
         $8,$9,$10,$11,$12::jsonb,$13::jsonb,
         $14,$15,$16::jsonb,$17::jsonb,$18,$19
       )
       ON CONFLICT (email) DO UPDATE SET
         account_no = COALESCE(NULLIF(EXCLUDED.account_no,''), hub_profiles.account_no),
         full_name = COALESCE(NULLIF(EXCLUDED.full_name,''), hub_profiles.full_name),
         phone = COALESCE(NULLIF(EXCLUDED.phone,''), hub_profiles.phone),
         avatar_url = COALESCE(NULLIF(EXCLUDED.avatar_url,''), hub_profiles.avatar_url),
         status = COALESCE(EXCLUDED.status, hub_profiles.status),
         department = COALESCE(EXCLUDED.department, hub_profiles.department),
         org_name = COALESCE(EXCLUDED.org_name, hub_profiles.org_name),
         title = COALESCE(EXCLUDED.title, hub_profiles.title),
         active_persona = COALESCE(EXCLUDED.active_persona, hub_profiles.active_persona),
         public_opt_in = COALESCE(EXCLUDED.public_opt_in, hub_profiles.public_opt_in),
         documents = COALESCE(EXCLUDED.documents, hub_profiles.documents),
         city = COALESCE(EXCLUDED.city, hub_profiles.city),
         country = COALESCE(EXCLUDED.country, hub_profiles.country),
         personas = COALESCE(EXCLUDED.personas, hub_profiles.personas),
         extras = COALESCE(EXCLUDED.extras, hub_profiles.extras),
         updated_at = NOW()
       RETURNING profile_id, account_no`,
      [
        profileId,
        accountNo,
        email,
        profile.fullName || email,
        profile.phone || '',
        profile.avatarUrl || '',
        profile.status || 'active',
        profile.department || '',
        profile.orgName || '',
        profile.title || '',
        profile.activePersona || '',
        JSON.stringify(profile.publicOptIn || {}),
        JSON.stringify(profile.documents || []),
        profile.city || '',
        profile.country || '',
        JSON.stringify(profile.personas || []),
        JSON.stringify({
          avatarDiskUrl: profile.avatarDiskUrl || '',
          avatarMime: profile.avatarMime || '',
          avatarUpdatedAt: profile.avatarUpdatedAt || '',
        }),
        profile.createdAt || new Date().toISOString(),
        profile.updatedAt || new Date().toISOString(),
      ]
    );
    resolvedProfileId = up.rows[0]?.profile_id || profileId;
    const resolvedAccountNo = up.rows[0]?.account_no || accountNo;
    // Keep persona child rows in sync (best-effort) using resolved profile_id
    for (const persona of profile.personas || []) {
      const type = String(persona.type || '').toLowerCase();
      if (!type) continue;
      const pid = `${resolvedProfileId}-${type}`;
      await c.query(
        `INSERT INTO hub_profile_personas (id, profile_id, email, persona_type, status, refs, meta, linked_by, linked_at)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9)
         ON CONFLICT (email, persona_type) DO UPDATE SET
           profile_id = EXCLUDED.profile_id,
           status = EXCLUDED.status,
           refs = EXCLUDED.refs,
           meta = EXCLUDED.meta,
           linked_by = COALESCE(EXCLUDED.linked_by, hub_profile_personas.linked_by)`,
        [
          pid,
          resolvedProfileId,
          email,
          type,
          persona.status || 'active',
          JSON.stringify(persona.refs || {}),
          JSON.stringify(persona.meta || {}),
          persona.linkedBy || '',
          persona.linkedAt || new Date().toISOString(),
        ]
      );
    }
    void resolvedAccountNo;
  });
  return { ok: true, email, profileId: resolvedProfileId, accountNo };
}

async function insertTicket(ticket, email) {
  if (!dbEnabled()) return { ok: false, skipped: true };
  const e = normEmail(email || ticket.clientEmail || ticket.email);
  await upsertClientAccount({ email: e, clientId: ticket.client_id, customerId: ticket.client_id });
  await withClient(async (c) => {
    await c.query(
      `INSERT INTO hub_client_tickets (
         id, email, customer_id, client_id, number, subject, category, department,
         priority, status, related_system_id, assigned_admin_id, messages, extras, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb,$15,$16)
       ON CONFLICT (id) DO UPDATE SET
         subject = EXCLUDED.subject,
         category = EXCLUDED.category,
         department = EXCLUDED.department,
         priority = EXCLUDED.priority,
         status = EXCLUDED.status,
         messages = EXCLUDED.messages,
         updated_at = NOW()`,
      [
        ticket.id,
        e,
        ticket.client_id || makeCustomerId(e),
        ticket.client_id || makeCustomerId(e),
        ticket.number || ticket.ticket_number,
        ticket.subject || '',
        ticket.category || 'دعم فني',
        ticket.department || ticket.category || 'دعم فني',
        ticket.priority || 'NORMAL',
        ticket.status || 'OPEN',
        ticket.related_system_id || ticket.systemCode || '',
        ticket.assigned_admin_id || null,
        JSON.stringify(ticket.messages || []),
        JSON.stringify({}),
        ticket.createdAt || ticket.created_at || new Date().toISOString(),
        ticket.updatedAt || ticket.updated_at || new Date().toISOString(),
      ]
    );
  });
  return { ok: true };
}

async function insertServiceRequest(item, email) {
  if (!dbEnabled()) return { ok: false, skipped: true };
  const e = normEmail(email || item.clientEmail || item.email);
  await upsertClientAccount({ email: e, clientId: item.client_id, customerId: item.client_id });
  await withClient(async (c) => {
    await c.query(
      `INSERT INTO hub_client_service_requests (
         id, email, customer_id, client_id, number, type, subject, message, related_system,
         priority, status, assigned_to, timeline, extras, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb,$15,$16)
       ON CONFLICT (id) DO UPDATE SET
         subject = EXCLUDED.subject,
         message = EXCLUDED.message,
         status = EXCLUDED.status,
         timeline = EXCLUDED.timeline,
         updated_at = NOW()`,
      [
        item.id,
        e,
        item.client_id || makeCustomerId(e),
        item.client_id || makeCustomerId(e),
        item.number,
        item.type || 'OTHER',
        item.subject || '',
        item.message || '',
        item.related_system || '',
        item.priority || 'NORMAL',
        item.status || 'NEW',
        item.assigned_to || null,
        JSON.stringify(item.timeline || []),
        JSON.stringify({}),
        item.created_at || new Date().toISOString(),
        item.updated_at || new Date().toISOString(),
      ]
    );
  });
  return { ok: true };
}

async function insertComplaint(item, email) {
  if (!dbEnabled()) return { ok: false, skipped: true };
  const e = normEmail(email || item.clientEmail || item.email);
  await upsertClientAccount({ email: e, clientId: item.client_id, customerId: item.client_id });
  await withClient(async (c) => {
    await c.query(
      `INSERT INTO hub_client_complaints (
         id, email, customer_id, client_id, number, category, subject, message, related_system,
         priority, status, assigned_to, resolution, timeline, extras, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15::jsonb,$16,$17)
       ON CONFLICT (id) DO UPDATE SET
         subject = EXCLUDED.subject,
         message = EXCLUDED.message,
         status = EXCLUDED.status,
         resolution = EXCLUDED.resolution,
         timeline = EXCLUDED.timeline,
         updated_at = NOW()`,
      [
        item.id,
        e,
        item.client_id || makeCustomerId(e),
        item.client_id || makeCustomerId(e),
        item.number,
        item.category || 'عام',
        item.subject || '',
        item.message || '',
        item.related_system || '',
        item.priority || 'NORMAL',
        item.status || 'OPEN',
        item.assigned_to || null,
        item.resolution || '',
        JSON.stringify(item.timeline || []),
        JSON.stringify({}),
        item.created_at || new Date().toISOString(),
        item.updated_at || new Date().toISOString(),
      ]
    );
  });
  return { ok: true };
}

async function insertAttachmentRef(att) {
  if (!dbEnabled() || !att?.id) return { ok: false, skipped: true };
  const email = normEmail(att.ownerEmail || att.email);
  const backend = att.storageBackend || process.env.HUB_OBJECT_STORAGE_BACKEND || 'db';
  await withClient(async (c) => {
    await c.query(
      `INSERT INTO hub_client_attachment_refs (
         id, email, entity_type, entity_id, category, storage_ref, storage_backend,
         original_file_name, mime_type, file_size, extras, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13)
       ON CONFLICT (id) DO UPDATE SET
         storage_ref = EXCLUDED.storage_ref,
         storage_backend = EXCLUDED.storage_backend,
         updated_at = NOW()`,
      [
        att.id,
        email,
        att.entityType,
        att.entityId,
        att.category || 'file',
        att.storageRef,
        backend,
        att.originalFileName || '',
        att.mimeType || '',
        Number(att.fileSize || 0),
        JSON.stringify({}),
        att.createdAt || new Date().toISOString(),
        new Date().toISOString(),
      ]
    );
  });
  return { ok: true };
}

function rowToClient(row, tickets, requests, complaints) {
  if (!row) return null;
  return {
    email: row.email,
    name: row.name,
    status: row.status,
    lifecycle: row.lifecycle,
    accountLevel: row.account_level,
    clientId: row.client_id,
    customerId: row.customer_id,
    accountNo: row.account_no,
    naioshId: row.naiosh_id || '',
    company: row.company || '',
    country: row.country || '',
    city: row.city || '',
    address: row.address || '',
    clientType: row.client_type || '',
    activityType: row.activity_type || '',
    language: row.language || 'ar',
    avatarUrl: row.avatar_url || '',
    phone: row.phone || '',
    systems: row.systems || [],
    wallet: row.wallet || { paid: 0, free: 0, total: 0, ledger: [] },
    notifications: row.notifications || [],
    activity: row.activity || [],
    internalNotes: row.internal_notes || [],
    onboarding: row.onboarding || {},
    tickets: tickets || [],
    serviceRequests: requests || [],
    complaints: complaints || [],
    orders: (row.extras && row.extras.orders) || [],
    subscriptions: (row.extras && row.extras.subscriptions) || [],
    invoices: (row.extras && row.extras.invoices) || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at,
    createdVia: row.created_via || '',
    createdByEmail: row.created_by_email || '',
    createdByEmployeeId: row.created_by_employee_id || '',
  };
}

function ticketFromRow(r) {
  return {
    id: r.id,
    number: r.number,
    ticket_number: r.number,
    client_id: r.client_id,
    clientEmail: r.email,
    subject: r.subject,
    category: r.category,
    department: r.department,
    priority: r.priority,
    status: r.status,
    related_system_id: r.related_system_id,
    systemCode: r.related_system_id,
    assigned_admin_id: r.assigned_admin_id,
    messages: r.messages || [],
    createdAt: r.created_at,
    created_at: r.created_at,
    updatedAt: r.updated_at,
    updated_at: r.updated_at,
  };
}

function requestFromRow(r) {
  return {
    id: r.id,
    number: r.number,
    client_id: r.client_id,
    clientEmail: r.email,
    type: r.type,
    subject: r.subject,
    message: r.message,
    related_system: r.related_system,
    priority: r.priority,
    status: r.status,
    assigned_to: r.assigned_to,
    timeline: r.timeline || [],
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

function complaintFromRow(r) {
  return {
    id: r.id,
    number: r.number,
    client_id: r.client_id,
    clientEmail: r.email,
    category: r.category,
    subject: r.subject,
    message: r.message,
    related_system: r.related_system,
    priority: r.priority,
    status: r.status,
    assigned_to: r.assigned_to,
    resolution: r.resolution || '',
    timeline: r.timeline || [],
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

async function getClientBundle(email) {
  if (!dbEnabled()) return null;
  const e = normEmail(email);
  return withClient(async (c) => {
    const acc = await c.query(`SELECT * FROM hub_client_accounts WHERE email = $1 LIMIT 1`, [e]);
    if (!acc.rows[0]) return null;
    // Sequential queries — pg client cannot safely run Promise.all on one connection
    const tickets = await c.query(
      `SELECT * FROM hub_client_tickets WHERE email = $1 ORDER BY created_at DESC`,
      [e]
    );
    const requests = await c.query(
      `SELECT * FROM hub_client_service_requests WHERE email = $1 ORDER BY created_at DESC`,
      [e]
    );
    const complaints = await c.query(
      `SELECT * FROM hub_client_complaints WHERE email = $1 ORDER BY created_at DESC`,
      [e]
    );
    return rowToClient(
      acc.rows[0],
      tickets.rows.map(ticketFromRow),
      requests.rows.map(requestFromRow),
      complaints.rows.map(complaintFromRow)
    );
  });
}

async function getProfileRow(email) {
  if (!dbEnabled()) return null;
  const e = normEmail(email);
  return withClient(async (c) => {
    const r = await c.query(`SELECT * FROM hub_profiles WHERE email = $1 LIMIT 1`, [e]);
    const row = r.rows[0];
    if (!row) return null;
    const extras = row.extras || {};
    return {
      profileId: row.profile_id,
      accountNo: row.account_no,
      email: row.email,
      fullName: row.full_name,
      phone: row.phone || '',
      city: row.city || '',
      country: row.country || '',
      avatarUrl: row.avatar_url || '',
      avatarDiskUrl: extras.avatarDiskUrl || '',
      avatarMime: extras.avatarMime || '',
      avatarUpdatedAt: extras.avatarUpdatedAt || '',
      status: row.status,
      department: row.department || '',
      orgName: row.org_name || '',
      title: row.title || '',
      personas: row.personas || [],
      activePersona: row.active_persona || '',
      documents: row.documents || [],
      publicOptIn: row.public_opt_in || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });
}

/**
 * Ensure portal + profile rows exist for a customer (idempotent, no overwrite of rich data).
 */
async function provisionCustomerBundle({ email, name, phone, customerId, city, country } = {}) {
  if (!dbEnabled()) return { ok: false, skipped: true };
  const e = normEmail(email);
  if (!e) return { ok: false, error: 'email required' };
  const cid = customerId || makeCustomerId(e);
  const accountNo = makeAccountNo(e);
  const existingClient = await getClientBundle(e);
  const existingProfile = await getProfileRow(e);

  const clientResult = await upsertClientAccount({
    email: e,
    name: name || existingClient?.name || e,
    phone: phone || existingClient?.phone || '',
    customerId: cid,
    clientId: existingClient?.clientId || cid,
    accountNo: existingClient?.accountNo || accountNo,
    city: city || existingClient?.city || '',
    country: country || existingClient?.country || '',
    status: existingClient?.status || 'active',
    lifecycle: existingClient?.lifecycle || 'ONBOARDING',
    wallet: existingClient?.wallet,
    onboarding: existingClient?.onboarding,
    systems: existingClient?.systems,
    notifications: existingClient?.notifications,
    activity: existingClient?.activity,
    createdAt: existingClient?.createdAt,
  });

  let personas = existingProfile?.personas || [];
  if (!personas.some((p) => p.type === 'client')) {
    personas = [
      {
        type: 'client',
        label: 'عميل',
        status: 'active',
        linkedAt: new Date().toISOString(),
        refs: { customerId: cid, clientId: cid },
        meta: {},
      },
      ...personas,
    ];
  }

  const profileResult = await upsertProfileRow({
    email: e,
    profileId: existingProfile?.profileId,
    accountNo: existingProfile?.accountNo || accountNo,
    fullName: name || existingProfile?.fullName || e,
    phone: phone || existingProfile?.phone || '',
    city: city || existingProfile?.city || '',
    country: country || existingProfile?.country || '',
    avatarUrl: existingProfile?.avatarUrl || '',
    personas,
    activePersona: existingProfile?.activePersona || 'client',
    documents: existingProfile?.documents || [],
    publicOptIn: existingProfile?.publicOptIn || {},
    status: existingProfile?.status || 'active',
    createdAt: existingProfile?.createdAt,
  });

  return {
    ok: true,
    created: { client: !existingClient, profile: !existingProfile },
    client: clientResult,
    profile: profileResult,
  };
}

async function listAttachmentRefs(entityType, entityId) {
  if (!dbEnabled()) return [];
  return withClient(async (c) => {
    const r = await c.query(
      `SELECT * FROM hub_client_attachment_refs WHERE entity_type = $1 AND entity_id = $2 ORDER BY created_at DESC`,
      [String(entityType), String(entityId)]
    );
    return r.rows.map((a) => ({
      id: a.id,
      entityType: a.entity_type,
      entityId: a.entity_id,
      category: a.category,
      storageRef: a.storage_ref,
      storageBackend: a.storage_backend,
      originalFileName: a.original_file_name,
      mimeType: a.mime_type,
      fileSize: a.file_size,
      ownerEmail: a.email,
      createdAt: a.created_at,
    }));
  });
}

async function counts() {
  if (!dbEnabled()) return {};
  return withClient(async (c) => {
    const q = async (sql) => (await c.query(sql)).rows[0].n;
    return {
      hubUsersCustomers: await q(`SELECT COUNT(*)::int AS n FROM hub_users WHERE role='customer'`),
      clientAccounts: await q(`SELECT COUNT(*)::int AS n FROM hub_client_accounts`),
      profiles: await q(`SELECT COUNT(*)::int AS n FROM hub_profiles`),
      tickets: await q(`SELECT COUNT(*)::int AS n FROM hub_client_tickets`),
      requests: await q(`SELECT COUNT(*)::int AS n FROM hub_client_service_requests`),
      complaints: await q(`SELECT COUNT(*)::int AS n FROM hub_client_complaints`),
      attachmentRefs: await q(`SELECT COUNT(*)::int AS n FROM hub_client_attachment_refs`),
      avatars: await q(`SELECT COUNT(*)::int AS n FROM hub_profile_avatars`),
    };
  });
}

async function loadMetaBlob(key) {
  return withClient(async (c) => {
    const r = await c.query(`SELECT value FROM hub_meta WHERE key = $1 LIMIT 1`, [key]);
    if (!r.rows[0]?.value) return null;
    const v = r.rows[0].value;
    return typeof v === 'string' ? JSON.parse(v) : v;
  });
}

async function migrateBlobsOnly() {
  const stats = {
    portalClients: 0,
    tickets: 0,
    requests: 0,
    complaints: 0,
    attachments: 0,
    profiles: 0,
  };

  const portal = await loadMetaBlob('client_portal_v1');
  if (portal?.clients) {
    for (const [email, client] of Object.entries(portal.clients)) {
      await upsertClientAccount({ ...client, email });
      stats.portalClients += 1;
      for (const t of client.tickets || []) {
        await insertTicket(t, email);
        stats.tickets += 1;
      }
      for (const r of client.serviceRequests || []) {
        await insertServiceRequest(r, email);
        stats.requests += 1;
      }
      for (const cm of client.complaints || []) {
        await insertComplaint(cm, email);
        stats.complaints += 1;
      }
    }
  }

  const attachments = await loadMetaBlob('client_attachments_v1');
  if (Array.isArray(attachments?.attachments)) {
    for (const att of attachments.attachments) {
      await insertAttachmentRef({
        ...att,
        ownerEmail: att.ownerEmail || att.email,
      });
      stats.attachments += 1;
    }
  }

  const profiles = await loadMetaBlob('profiles-360');
  if (profiles?.profiles) {
    for (const [email, profile] of Object.entries(profiles.profiles)) {
      await upsertProfileRow({ ...profile, email });
      stats.profiles += 1;
    }
  }
  return stats;
}

async function backfillMissingCustomers({ limit = 0, batchSize = 500 } = {}) {
  let backfilledUsers = 0;
  let processed = 0;

  // Set-based insert for missing client accounts (fast path)
  await withClient(async (c) => {
    const limClause = limit > 0 ? `LIMIT ${Number(limit)}` : '';
    const r = await c.query(`
      INSERT INTO hub_client_accounts (
        email, customer_id, client_id, account_no, name, phone, status, lifecycle,
        city, country, created_at, updated_at
      )
      SELECT
        lower(u.email),
        COALESCE(NULLIF(u.customer_id,''), 'CL-' || upper(substr(encode(digest(lower(u.email),'sha1'),'hex'),1,8))),
        COALESCE(NULLIF(u.customer_id,''), 'CL-' || upper(substr(encode(digest(lower(u.email),'sha1'),'hex'),1,8))),
        'ACC-' || upper(substr(encode(digest(lower(u.email),'sha1'),'hex'),1,8)),
        COALESCE(NULLIF(u.name_ar,''), u.email),
        COALESCE(u.phone,''),
        COALESCE(u.status,'active'),
        'ONBOARDING',
        COALESCE(u.city,''),
        COALESCE(u.governorate,''),
        COALESCE(u.created_at, NOW()),
        NOW()
      FROM hub_users u
      WHERE u.role = 'customer'
        AND NOT EXISTS (SELECT 1 FROM hub_client_accounts c WHERE c.email = lower(u.email))
      ${limClause}
      ON CONFLICT (email) DO NOTHING
    `);
    backfilledUsers += r.rowCount || 0;
  });

  // Set-based insert for missing profiles
  await withClient(async (c) => {
    const limClause = limit > 0 ? `LIMIT ${Number(limit)}` : '';
    const r = await c.query(`
      INSERT INTO hub_profiles (
        profile_id, account_no, email, full_name, phone, status, active_persona,
        city, country, personas, created_at, updated_at
      )
      SELECT
        'PRF-' || encode(gen_random_bytes(6),'hex'),
        'ACC-' || upper(substr(encode(digest(lower(u.email),'sha1'),'hex'),1,8)),
        lower(u.email),
        COALESCE(NULLIF(u.name_ar,''), u.email),
        COALESCE(u.phone,''),
        'active',
        'client',
        COALESCE(u.city,''),
        COALESCE(u.governorate,''),
        jsonb_build_array(jsonb_build_object(
          'type','client','label','عميل','status','active',
          'linkedAt', NOW(),
          'refs', jsonb_build_object(
            'customerId', COALESCE(NULLIF(u.customer_id,''), 'CL-' || upper(substr(encode(digest(lower(u.email),'sha1'),'hex'),1,8))),
            'clientId', COALESCE(NULLIF(u.customer_id,''), 'CL-' || upper(substr(encode(digest(lower(u.email),'sha1'),'hex'),1,8)))
          ),
          'meta', '{}'::jsonb
        )),
        COALESCE(u.created_at, NOW()),
        NOW()
      FROM hub_users u
      WHERE u.role = 'customer'
        AND NOT EXISTS (SELECT 1 FROM hub_profiles p WHERE p.email = lower(u.email))
      ${limClause}
      ON CONFLICT (email) DO NOTHING
    `);
    processed += r.rowCount || 0;
  });

  // pgcrypto digest may be unavailable — fall back to JS provision loop
  if (backfilledUsers === 0 && processed === 0) {
    const baseSql = `
      SELECT u.email, u.name_ar, u.phone, u.customer_id, u.city, u.governorate
      FROM hub_users u
      WHERE u.role = 'customer'
        AND (
          NOT EXISTS (SELECT 1 FROM hub_client_accounts c WHERE c.email = lower(u.email))
          OR NOT EXISTS (SELECT 1 FROM hub_profiles p WHERE p.email = lower(u.email))
        )
      ORDER BY u.created_at ASC`;
    for (;;) {
      const take = limit > 0 ? Math.min(batchSize, Math.max(0, limit - processed)) : batchSize;
      if (limit > 0 && take <= 0) break;
      const users = await withClient(async (c) => (await c.query(`${baseSql} LIMIT $1`, [take])).rows);
      if (!users.length) break;
      for (const u of users) {
        await provisionCustomerBundle({
          email: u.email,
          name: u.name_ar,
          phone: u.phone,
          customerId: u.customer_id || makeCustomerId(u.email),
          city: u.city || '',
          country: u.governorate || '',
        });
        backfilledUsers += 1;
        processed += 1;
      }
      if (users.length < take) break;
    }
  }

  return { backfilledUsers: Math.max(backfilledUsers, processed), processed: Math.max(backfilledUsers, processed) };
}

/**
 * Safe migrate: copy hub_meta blobs + backfill missing hub_users into relational tables.
 * Never deletes blobs. Idempotent upserts.
 */
async function migrateFromBlobsAndBackfill({ limit = 0, skipBackfill = false } = {}) {
  if (!dbEnabled()) return { ok: false, error: 'no database' };
  const { migrate } = require('../db/migrate');
  await migrate();

  const stats = {
    portalClients: 0,
    tickets: 0,
    requests: 0,
    complaints: 0,
    attachments: 0,
    profiles: 0,
    backfilledUsers: 0,
    before: await counts(),
  };

  Object.assign(stats, await migrateBlobsOnly());

  if (!skipBackfill) {
    const bf = await backfillMissingCustomers({ limit });
    stats.backfilledUsers = bf.backfilledUsers;
  }

  stats.after = await counts();
  await withClient(async (c) => {
    await c.query(
      `INSERT INTO hub_customer_migrate_checkpoints (name, stats, completed_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (name) DO UPDATE SET stats = EXCLUDED.stats, completed_at = NOW()`,
      [CHECKPOINT, JSON.stringify(stats)]
    );
  });

  return { ok: true, stats };
}

async function verifyMigrationIntegrity() {
  if (!dbEnabled()) return { ok: false };
  const c = await counts();
  const gaps = {
    usersWithoutClient: 0,
    usersWithoutProfile: 0,
  };
  await withClient(async (client) => {
    gaps.usersWithoutClient = (
      await client.query(
        `SELECT COUNT(*)::int AS n FROM hub_users u
         WHERE u.role='customer'
           AND NOT EXISTS (SELECT 1 FROM hub_client_accounts c WHERE c.email = lower(u.email))`
      )
    ).rows[0].n;
    gaps.usersWithoutProfile = (
      await client.query(
        `SELECT COUNT(*)::int AS n FROM hub_users u
         WHERE u.role='customer'
           AND NOT EXISTS (SELECT 1 FROM hub_profiles p WHERE p.email = lower(u.email))`
      )
    ).rows[0].n;
  });
  return {
    ok: gaps.usersWithoutClient === 0 && gaps.usersWithoutProfile === 0,
    counts: c,
    gaps,
  };
}

module.exports = {
  dbEnabled,
  normEmail,
  makeCustomerId,
  makeAccountNo,
  upsertClientAccount,
  upsertProfileRow,
  insertTicket,
  insertServiceRequest,
  insertComplaint,
  insertAttachmentRef,
  getClientBundle,
  getProfileRow,
  provisionCustomerBundle,
  listAttachmentRefs,
  counts,
  migrateBlobsOnly,
  backfillMissingCustomers,
  migrateFromBlobsAndBackfill,
  verifyMigrationIntegrity,
  CHECKPOINT,
};
