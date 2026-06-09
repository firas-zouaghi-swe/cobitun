import { PrismaClient, Prisma } from '@prisma/client';
import { randomBytes, scryptSync } from 'crypto';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Password hashing — mirrors src/lib/auth.ts
// ---------------------------------------------------------------------------
const SALT_LENGTH = 16;
const KEY_LENGTH = 64;

function hashPasswordParts(password: string): { salt: string; hash: string } {
  const salt = randomBytes(SALT_LENGTH).toString('hex');
  const derivedKey = scryptSync(password, salt, KEY_LENGTH).toString('hex');
  return { salt, hash: derivedKey };
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------
async function main() {
  console.log('=== COBITUN v3 Database Seed ===\n');

  // =======================================================================
  // PHASE 0 — Cleanup for Idempotency
  // Delete all non-enum/non-ref data so re-running produces identical results.
  // Enum and ref tables use upsert, so they're naturally idempotent.
  // =======================================================================
  console.log('--- Phase 0: Cleanup for Idempotency ---');
  const deleteOrder = [
    'policy_records', 'policies',
    'ioda_claim_suggestions', 'contact_submissions', 'notification_logs',
    'underwriting_notes', 'claim_rejections', 'claim_appeals',
    'policy_cancellations', 'idempotency_keys', 'email_verification_tokens',
    'password_reset_tokens', 'user_sessions', 'device_fingerprints',
    'ip_reputation', 'fraud_detection_results', 'notifications',
    'uploaded_files', 'workflow_claim_tasks', 'workflow_policy_tasks',
    'workflow_claims', 'workflow_policy_applications',
    'cyber_policy_renewals', 'parametric_policy_renewals',
    'cyber_policy_endorsements', 'parametric_policy_endorsements',
    'cyber_reinsurance_ceded', 'parametric_reinsurance_ceded',
    'reinsurance_treaties', 'cyber_claim_reserves', 'parametric_claim_reserves',
    'cyber_claims', 'cyber_policies', 'cyber_applications',
    'parametric_claims', 'trigger_events', 'incident_event_links',
    'merged_incidents', 'outage_events',
    'parametric_policies', 'payout_function_configs',
    'customer_questions', 'contact_messages', 'customers', 'users',
    'audit_logs',
  ];
  for (const table of deleteOrder) {
    try {
      await prisma.$executeRawUnsafe(`DELETE FROM "${table}"`);
    } catch {
      // Table may not exist yet on first run
    }
  }
  console.log('  Cleanup complete — all data tables cleared');

  // =======================================================================
  // PHASE 1 — Enum Tables
  // =======================================================================
  console.log('--- Phase 1: Enum Tables ---');

  // 1a. enum_user_role
  const superAdminRole = await prisma.enumUserRole.upsert({
    where: { roleCode: 'SUPER_ADMIN' },
    update: {},
    create: {
      roleCode: 'SUPER_ADMIN',
      roleName: 'Super Administrator',
      description: 'Super administrator — manage admins, view all data, system configuration',
      permissionsJson: JSON.stringify([
        'dashboard:view', 'users:manage', 'admins:manage', 'products:manage', 'categories:manage',
        'providers:manage', 'policies:manage', 'claims:manage', 'applications:manage',
        'settings:manage', 'reports:view', 'audit:view', 'workflows:manage',
        'endorsements:manage', 'renewals:manage', 'reinsurance:manage', 'system:configure',
      ]),
    },
  });

  const adminRole = await prisma.enumUserRole.upsert({
    where: { roleCode: 'ADMIN' },
    update: {},
    create: {
      roleCode: 'ADMIN',
      roleName: 'Administrator',
      description: 'Platform administration access — manage customers and their policies',
      permissionsJson: JSON.stringify([
        'dashboard:view', 'customers:manage', 'products:manage', 'categories:manage',
        'providers:manage', 'policies:manage', 'claims:manage', 'applications:manage',
        'settings:view', 'reports:view', 'audit:view', 'workflows:manage',
        'endorsements:manage', 'renewals:manage',
      ]),
    },
  });

  const customerRole = await prisma.enumUserRole.upsert({
    where: { roleCode: 'CUSTOMER' },
    update: {},
    create: {
      roleCode: 'CUSTOMER',
      roleName: 'Customer',
      description: 'Standard customer access — purchase policies, file claims, manage own profile',
      permissionsJson: JSON.stringify([
        'dashboard:view', 'policies:own', 'claims:own', 'applications:own',
        'profile:manage', 'questions:submit', 'endorsements:own', 'renewals:own',
      ]),
    },
  });
  console.log('  enum_user_role: SUPER_ADMIN, ADMIN, CUSTOMER');

  // 1b. enum_product_type
  const parametricType = await prisma.enumProductType.upsert({
    where: { typeCode: 'PARAMETRIC' },
    update: {},
    create: {
      typeCode: 'PARAMETRIC',
      typeName: 'Parametric',
      description: 'Parametric insurance — automatic payout triggered by predefined events',
    },
  });
  const indemnityType = await prisma.enumProductType.upsert({
    where: { typeCode: 'INDEMNITY' },
    update: {},
    create: {
      typeCode: 'INDEMNITY',
      typeName: 'Indemnity',
      description: 'Indemnity insurance — reimbursement based on proven actual loss',
    },
  });
  console.log('  enum_product_type: PARAMETRIC, INDEMNITY');

  // 1c. enum_sla_tier
  const bronzeTier = await prisma.enumSlaTier.upsert({
    where: { tierCode: 'Bronze' },
    update: {},
    create: {
      tierCode: 'Bronze',
      tierName: 'Bronze',
      mttrHours: 16,
      thresholdHours: 16,
      basePremiumFactor: 0.80,
      description: 'MTTR 16h — lower risk, lower premium factor',
    },
  });
  const silverTier = await prisma.enumSlaTier.upsert({
    where: { tierCode: 'Silver' },
    update: {},
    create: {
      tierCode: 'Silver',
      tierName: 'Silver',
      mttrHours: 8,
      thresholdHours: 8,
      basePremiumFactor: 1.00,
      description: 'MTTR 8h — baseline premium factor',
    },
  });
  const goldTier = await prisma.enumSlaTier.upsert({
    where: { tierCode: 'Gold' },
    update: {},
    create: {
      tierCode: 'Gold',
      tierName: 'Gold',
      mttrHours: 4,
      thresholdHours: 4,
      basePremiumFactor: 1.30,
      description: 'MTTR 4h — higher risk, higher premium factor',
    },
  });
  const platinumTier = await prisma.enumSlaTier.upsert({
    where: { tierCode: 'Platinum' },
    update: {},
    create: {
      tierCode: 'Platinum',
      tierName: 'Platinum',
      mttrHours: 2,
      thresholdHours: 2,
      basePremiumFactor: 1.80,
      description: 'MTTR 2h — highest risk, highest premium factor',
    },
  });
  console.log('  enum_sla_tier: Bronze, Silver, Gold, Platinum');

  // Helper map for SLA tier IDs
  const slaTierMap: Record<string, number> = {
    Bronze: bronzeTier.id,
    Silver: silverTier.id,
    Gold: goldTier.id,
    Platinum: platinumTier.id,
  };

  // 1d. enum_param_policy_status
  const paramPolicyStatuses = [
    { code: 'PENDING', name: 'Pending', isTerminal: 0, allowsClaims: 0, desc: 'Policy created, awaiting approval' },
    { code: 'APPROVED', name: 'Approved', isTerminal: 0, allowsClaims: 0, desc: 'Policy approved, awaiting activation' },
    { code: 'ACTIVE', name: 'Active', isTerminal: 0, allowsClaims: 1, desc: 'Policy is active and in force' },
    { code: 'SUSPENDED', name: 'Suspended', isTerminal: 0, allowsClaims: 0, desc: 'Policy temporarily suspended' },
    { code: 'CANCELLED', name: 'Cancelled', isTerminal: 1, allowsClaims: 0, desc: 'Policy cancelled by request' },
    { code: 'EXPIRED', name: 'Expired', isTerminal: 1, allowsClaims: 1, desc: 'Policy coverage period ended' },
    { code: 'REJECTED', name: 'Rejected', isTerminal: 1, allowsClaims: 0, desc: 'Policy application rejected' },
  ];
  for (const s of paramPolicyStatuses) {
    await prisma.enumParamPolicyStatus.upsert({
      where: { statusCode: s.code },
      update: {},
      create: {
        statusCode: s.code,
        statusName: s.name,
        isTerminal: s.isTerminal,
        allowsClaims: s.allowsClaims,
        description: s.desc,
      },
    });
  }
  console.log('  enum_param_policy_status:', paramPolicyStatuses.length, 'entries');

  // 1e. enum_param_claim_status
  const paramClaimStatuses = [
    { code: 'DETECTED', name: 'Detected', isTerminal: 0, allowsPayment: 0, desc: 'Outage event detected by IODA' },
    { code: 'VALIDATED', name: 'Validated', isTerminal: 0, allowsPayment: 0, desc: 'Outage validated against policy parameters' },
    { code: 'APPROVED', name: 'Approved', isTerminal: 0, allowsPayment: 1, desc: 'Claim approved for payout' },
    { code: 'PAID', name: 'Paid', isTerminal: 1, allowsPayment: 0, desc: 'Payout completed' },
    { code: 'DISPUTED', name: 'Disputed', isTerminal: 0, allowsPayment: 0, desc: 'Claim is under dispute' },
    { code: 'REJECTED', name: 'Rejected', isTerminal: 1, allowsPayment: 0, desc: 'Claim rejected' },
  ];
  for (const s of paramClaimStatuses) {
    await prisma.enumParamClaimStatus.upsert({
      where: { statusCode: s.code },
      update: {},
      create: {
        statusCode: s.code,
        statusName: s.name,
        isTerminal: s.isTerminal,
        allowsPayment: s.allowsPayment,
        description: s.desc,
      },
    });
  }
  console.log('  enum_param_claim_status:', paramClaimStatuses.length, 'entries');

  // 1f. enum_cyber_app_status
  const cyberAppStatuses = [
    { code: 'DRAFT', name: 'Draft', isTerminal: 0, desc: 'Application in progress' },
    { code: 'SUBMITTED', name: 'Submitted', isTerminal: 0, desc: 'Application submitted for review' },
    { code: 'UNDER_REVIEW', name: 'Under Review', isTerminal: 0, desc: 'Application being reviewed by underwriter' },
    { code: 'APPROVED', name: 'Approved', isTerminal: 1, desc: 'Application approved' },
    { code: 'REJECTED', name: 'Rejected', isTerminal: 1, desc: 'Application rejected' },
  ];
  for (const s of cyberAppStatuses) {
    await prisma.enumCyberAppStatus.upsert({
      where: { statusCode: s.code },
      update: {},
      create: {
        statusCode: s.code,
        statusName: s.name,
        isTerminal: s.isTerminal,
        description: s.desc,
      },
    });
  }
  console.log('  enum_cyber_app_status:', cyberAppStatuses.length, 'entries');

  // 1g. enum_cyber_policy_status
  const cyberPolicyStatuses = [
    { code: 'PENDING', name: 'Pending', isTerminal: 0, allowsClaims: 0, desc: 'Policy created, awaiting activation' },
    { code: 'ACTIVE', name: 'Active', isTerminal: 0, allowsClaims: 1, desc: 'Policy is active and in force' },
    { code: 'LAPSED', name: 'Lapsed', isTerminal: 1, allowsClaims: 0, desc: 'Policy lapsed due to non-payment' },
    { code: 'CANCELLED', name: 'Cancelled', isTerminal: 1, allowsClaims: 0, desc: 'Policy cancelled' },
    { code: 'EXPIRED', name: 'Expired', isTerminal: 1, allowsClaims: 1, desc: 'Policy coverage period ended' },
  ];
  for (const s of cyberPolicyStatuses) {
    await prisma.enumCyberPolicyStatus.upsert({
      where: { statusCode: s.code },
      update: {},
      create: {
        statusCode: s.code,
        statusName: s.name,
        isTerminal: s.isTerminal,
        allowsClaims: s.allowsClaims,
        description: s.desc,
      },
    });
  }
  console.log('  enum_cyber_policy_status:', cyberPolicyStatuses.length, 'entries');

  // 1h. enum_cyber_claim_status
  const cyberClaimStatuses = [
    { code: 'REPORTED', name: 'Reported', isTerminal: 0, allowsPayment: 0, desc: 'Claim reported by insured' },
    { code: 'UNDER_INVESTIGATION', name: 'Under Investigation', isTerminal: 0, allowsPayment: 0, desc: 'Claim under investigation' },
    { code: 'ADJUSTED', name: 'Adjusted', isTerminal: 0, allowsPayment: 0, desc: 'Claim adjusted by claims adjuster' },
    { code: 'APPROVED', name: 'Approved', isTerminal: 0, allowsPayment: 1, desc: 'Claim approved for payment' },
    { code: 'PAID', name: 'Paid', isTerminal: 1, allowsPayment: 0, desc: 'Claim paid out' },
    { code: 'DENIED', name: 'Denied', isTerminal: 1, allowsPayment: 0, desc: 'Claim denied' },
  ];
  for (const s of cyberClaimStatuses) {
    await prisma.enumCyberClaimStatus.upsert({
      where: { statusCode: s.code },
      update: {},
      create: {
        statusCode: s.code,
        statusName: s.name,
        isTerminal: s.isTerminal,
        allowsPayment: s.allowsPayment,
        description: s.desc,
      },
    });
  }
  console.log('  enum_cyber_claim_status:', cyberClaimStatuses.length, 'entries');

  // 1i. enum_security_posture
  const securityPostures = [
    { code: 'EXCELLENT', name: 'Excellent', multiplier: 0.70, desc: 'Best-in-class security controls' },
    { code: 'GOOD', name: 'Good', multiplier: 0.85, desc: 'Strong security posture with minor gaps' },
    { code: 'FAIR', name: 'Fair', multiplier: 1.00, desc: 'Adequate security posture — baseline multiplier' },
    { code: 'POOR', name: 'Poor', multiplier: 1.30, desc: 'Below-average security controls' },
    { code: 'UNKNOWN', name: 'Unknown', multiplier: 1.50, desc: 'Security posture not assessed — highest risk multiplier' },
  ];
  for (const sp of securityPostures) {
    await prisma.enumSecurityPosture.upsert({
      where: { postureCode: sp.code },
      update: {},
      create: {
        postureCode: sp.code,
        postureName: sp.name,
        riskMultiplier: sp.multiplier,
        description: sp.desc,
      },
    });
  }
  console.log('  enum_security_posture:', securityPostures.length, 'entries');

  // 1j. enum_incident_type
  const incidentTypes = [
    { code: 'BI', name: 'Business Interruption', desc: 'Lost revenue and extra costs during a cyber-caused outage' },
    { code: 'DR', name: 'Data Recovery', desc: 'Restoring corrupted, encrypted, or lost data' },
    { code: 'CE', name: 'Cyber Extortion', desc: 'Ransom payments, negotiation, and decryption tools' },
    { code: 'SR', name: 'System Rectification', desc: 'Restoring compromised systems to a known-good state' },
    { code: 'CM', name: 'Crisis Management', desc: 'PR, customer notification, credit monitoring' },
    { code: 'PL', name: 'Privacy Liability', desc: 'Customer claims resulting from a data breach' },
    { code: 'RD', name: 'Regulatory Defence', desc: 'Legal costs defending against regulatory actions' },
    { code: 'ML', name: 'Media Liability', desc: 'Defamation, IP, copyright via digital channels' },
    { code: 'SE', name: 'Social Engineering / Cyber Theft', desc: 'Funds transfer fraud from impersonation' },
    { code: 'OTHER', name: 'Other', desc: 'Other incident types not classified above' },
  ];
  for (const it of incidentTypes) {
    await prisma.enumIncidentType.upsert({
      where: { typeCode: it.code },
      update: {},
      create: {
        typeCode: it.code,
        typeName: it.name,
        description: it.desc,
      },
    });
  }
  console.log('  enum_incident_type:', incidentTypes.length, 'entries');

  // 1k. enum_workflow_app_status
  const workflowAppStatuses = [
    { code: 'ProviderContractUploaded', name: 'Provider Contract Uploaded', isTerminal: 0, actor: 'CUSTOMER', next: JSON.stringify(['AdminReviewing']), desc: 'Customer uploaded provider contract' },
    { code: 'AdminReviewing', name: 'Admin Reviewing', isTerminal: 0, actor: 'ADMIN', next: JSON.stringify(['PolicyContractGenerated', 'Rejected']), desc: 'Admin reviewing the application' },
    { code: 'PolicyContractGenerated', name: 'Policy Contract Generated', isTerminal: 0, actor: 'SYSTEM', next: JSON.stringify(['AwaitingSignatureAndPayment']), desc: 'System generated policy contract' },
    { code: 'AwaitingSignatureAndPayment', name: 'Awaiting Signature & Payment', isTerminal: 0, actor: 'CUSTOMER', next: JSON.stringify(['ReadyForFinalApproval']), desc: 'Waiting for customer to sign and pay' },
    { code: 'ReadyForFinalApproval', name: 'Ready for Final Approval', isTerminal: 0, actor: 'ADMIN', next: JSON.stringify(['UnderwritingCompleted', 'Rejected']), desc: 'Ready for final underwriting approval' },
    { code: 'UnderwritingCompleted', name: 'Underwriting Completed', isTerminal: 1, actor: 'SYSTEM', next: JSON.stringify(['END']), desc: 'Underwriting completed — policy issued' },
    { code: 'Rejected', name: 'Rejected', isTerminal: 1, actor: 'ADMIN', next: JSON.stringify(['END']), desc: 'Application rejected' },
  ];
  for (const s of workflowAppStatuses) {
    await prisma.enumWorkflowAppStatus.upsert({
      where: { statusCode: s.code },
      update: {},
      create: {
        statusCode: s.code,
        statusName: s.name,
        isTerminal: s.isTerminal,
        actorRequired: s.actor,
        nextStatesJson: s.next,
        description: s.desc,
      },
    });
  }
  console.log('  enum_workflow_app_status:', workflowAppStatuses.length, 'entries');

  // 1l. enum_workflow_claim_status
  const workflowClaimStatuses = [
    { code: 'Open', name: 'Open', isTerminal: 0, actor: 'CUSTOMER', next: JSON.stringify(['Submitted']), desc: 'Claim opened' },
    { code: 'Submitted', name: 'Submitted', isTerminal: 0, actor: 'CUSTOMER', next: JSON.stringify(['Completed']), desc: 'Claim submitted with documentation' },
    { code: 'Completed', name: 'Completed', isTerminal: 1, actor: 'ADMIN', next: JSON.stringify(['END']), desc: 'Claim processed and completed' },
  ];
  for (const s of workflowClaimStatuses) {
    await prisma.enumWorkflowClaimStatus.upsert({
      where: { statusCode: s.code },
      update: {},
      create: {
        statusCode: s.code,
        statusName: s.name,
        isTerminal: s.isTerminal,
        actorRequired: s.actor,
        nextStatesJson: s.next,
        description: s.desc,
      },
    });
  }
  console.log('  enum_workflow_claim_status:', workflowClaimStatuses.length, 'entries');

  // 1m. enum_task_actor
  const taskActors = [
    { code: 'CUSTOMER', name: 'Customer', desc: 'Action required from the customer' },
    { code: 'ADMIN', name: 'Admin', desc: 'Action required from an administrator' },
    { code: 'SYSTEM', name: 'System', desc: 'Automated system action' },
  ];
  for (const a of taskActors) {
    await prisma.enumTaskActor.upsert({
      where: { actorCode: a.code },
      update: {},
      create: {
        actorCode: a.code,
        actorName: a.name,
        description: a.desc,
      },
    });
  }
  console.log('  enum_task_actor:', taskActors.length, 'entries');

  // 1n. enum_task_status
  const taskStatuses = [
    { code: 'PENDING', name: 'Pending', isTerminal: 0, desc: 'Task is pending completion' },
    { code: 'COMPLETED', name: 'Completed', isTerminal: 1, desc: 'Task has been completed' },
  ];
  for (const s of taskStatuses) {
    await prisma.enumTaskStatus.upsert({
      where: { statusCode: s.code },
      update: {},
      create: {
        statusCode: s.code,
        statusName: s.name,
        isTerminal: s.isTerminal,
        description: s.desc,
      },
    });
  }
  console.log('  enum_task_status:', taskStatuses.length, 'entries');

  // 1o. enum_question_type
  const questionTypes = [
    { code: 'text', name: 'Text', desc: 'Free-text answer' },
    { code: 'number', name: 'Number', desc: 'Numeric answer' },
    { code: 'boolean', name: 'Boolean', desc: 'Yes/No answer' },
    { code: 'picklist', name: 'Picklist', desc: 'Select from predefined options' },
  ];
  const qtMap: Record<string, number> = {};
  for (const qt of questionTypes) {
    const record = await prisma.enumQuestionType.upsert({
      where: { typeCode: qt.code },
      update: {},
      create: {
        typeCode: qt.code,
        typeName: qt.name,
        description: qt.desc,
      },
    });
    qtMap[qt.code] = record.id;
  }
  console.log('  enum_question_type:', questionTypes.length, 'entries');

  // =======================================================================
  // PHASE 2 — Reference Tables (Actuarial Factors)
  // =======================================================================
  console.log('\n--- Phase 2: Reference Tables ---');

  // 2a. ref_sector — 16 sectors
  const sectors = [
    { code: 'Technology', name: 'Technology', factor: 1.35, desc: 'High digital exposure' },
    { code: 'Healthcare', name: 'Healthcare', factor: 1.20, desc: 'Sensitive data and regulatory requirements' },
    { code: 'Finance', name: 'Finance', factor: 1.50, desc: 'Highest risk — financial data and regulatory scrutiny' },
    { code: 'Retail', name: 'Retail', factor: 1.10, desc: 'Moderate digital dependency' },
    { code: 'Education', name: 'Education', factor: 0.90, desc: 'Lower risk profile' },
    { code: 'Government', name: 'Government', factor: 0.85, desc: 'State-backed infrastructure' },
    { code: 'Manufacturing', name: 'Manufacturing', factor: 1.00, desc: 'Baseline risk' },
    { code: 'Hospitality', name: 'Hospitality', factor: 1.15, desc: 'Booking and payment systems' },
    { code: 'Telecom', name: 'Telecom', factor: 1.40, desc: 'Critical infrastructure dependency' },
    { code: 'Media', name: 'Media', factor: 1.25, desc: 'Content delivery and digital platforms' },
    { code: 'Legal', name: 'Legal', factor: 1.10, desc: 'Confidential data handling' },
    { code: 'Logistics', name: 'Logistics', factor: 1.05, desc: 'Supply chain digital dependency' },
    { code: 'Agriculture', name: 'Agriculture', factor: 0.80, desc: 'Lowest digital risk' },
    { code: 'Energy', name: 'Energy', factor: 1.30, desc: 'Critical infrastructure — OT/IT convergence' },
    { code: 'Construction', name: 'Construction', factor: 0.95, desc: 'Moderate-low digital dependency' },
    { code: 'Other', name: 'Other', factor: 1.00, desc: 'Default baseline risk' },
  ];
  const sectorMap: Record<string, number> = {};
  for (const sec of sectors) {
    const record = await prisma.refSector.upsert({
      where: { sectorCode: sec.code },
      update: {},
      create: {
        sectorCode: sec.code,
        sectorName: sec.name,
        riskFactor: sec.factor,
        description: sec.desc,
      },
    });
    sectorMap[sec.code] = record.id;
  }
  console.log('  ref_sector:', sectors.length, 'entries');

  // 2b. ref_business_model — 5 models
  const businessModels = [
    { code: 'B2B', name: 'B2B', factor: 0.80, desc: 'Business-to-Business — longer contracts, lower churn' },
    { code: 'B2C', name: 'B2C', factor: 1.00, desc: 'Business-to-Consumer — baseline' },
    { code: 'B2B2C', name: 'B2B2C', factor: 0.90, desc: 'Hybrid B2B and B2C model' },
    { code: 'Marketplace', name: 'Marketplace', factor: 1.10, desc: 'Platform/marketplace — high transaction volume' },
    { code: 'SaaS', name: 'SaaS', factor: 0.75, desc: 'Software-as-a-Service — recurring revenue, lower volatility' },
  ];
  const bmMap: Record<string, number> = {};
  for (const bm of businessModels) {
    const record = await prisma.refBusinessModel.upsert({
      where: { modelCode: bm.code },
      update: {},
      create: {
        modelCode: bm.code,
        modelName: bm.name,
        riskFactor: bm.factor,
        description: bm.desc,
      },
    });
    bmMap[bm.code] = record.id;
  }
  console.log('  ref_business_model:', businessModels.length, 'entries');

  // 2c. ref_resilience_profile — 3 profiles
  const resilienceProfiles = [
    { code: 'High', name: 'High Resilience', factor: 0.75, desc: 'Multi-cloud, DR tested, automated failover' },
    { code: 'Medium', name: 'Medium Resilience', factor: 1.00, desc: 'Some redundancy, basic DR plan' },
    { code: 'Low', name: 'Low Resilience', factor: 1.3333, desc: 'Single provider, no DR, manual processes' },
  ];
  const rpMap: Record<string, number> = {};
  for (const rp of resilienceProfiles) {
    const record = await prisma.refResilienceProfile.upsert({
      where: { profileCode: rp.code },
      update: {},
      create: {
        profileCode: rp.code,
        profileName: rp.name,
        riskFactor: rp.factor,
        description: rp.desc,
      },
    });
    rpMap[rp.code] = record.id;
  }
  console.log('  ref_resilience_profile:', resilienceProfiles.length, 'entries');

  // 2d. ref_turnover_band — 5 bands
  const turnoverBands = [
    { code: 'Micro', name: 'Micro (0–100K)', min: 0, max: 100000, factor: 0.90, desc: 'Micro enterprise — turnover under 100K TND' },
    { code: 'Small', name: 'Small (100K–500K)', min: 100000, max: 500000, factor: 1.00, desc: 'Small enterprise — turnover 100K–500K TND' },
    { code: 'Medium', name: 'Medium (500K–2M)', min: 500000, max: 2000000, factor: 1.10, desc: 'Medium enterprise — turnover 500K–2M TND' },
    { code: 'Large', name: 'Large (2M–10M)', min: 2000000, max: 10000000, factor: 1.20, desc: 'Large enterprise — turnover 2M–10M TND' },
    { code: 'Enterprise', name: 'Enterprise (10M–50M)', min: 10000000, max: 50000000, factor: 1.30, desc: 'Enterprise — turnover 10M–50M TND' },
  ];
  const tbMap: Record<string, number> = {};
  for (const tb of turnoverBands) {
    const record = await prisma.refTurnoverBand.upsert({
      where: { bandCode: tb.code },
      update: {},
      create: {
        bandCode: tb.code,
        bandName: tb.name,
        minTurnover: tb.min,
        maxTurnover: tb.max,
        riskFactor: tb.factor,
        description: tb.desc,
      },
    });
    tbMap[tb.code] = record.id;
  }
  console.log('  ref_turnover_band:', turnoverBands.length, 'entries');

  // =======================================================================
  // PHASE 3 — System Settings
  // =======================================================================
  console.log('\n--- Phase 3: System Settings ---');

  const systemSettings = [
    { key: 'platform_name', value: 'COBITUN', type: 'string', category: 'general', desc: 'Platform display name', editable: 0 },
    { key: 'max_login_attempts', value: '5', type: 'integer', category: 'security', desc: 'Maximum failed login attempts before lockout', editable: 1 },
    { key: 'lockout_duration_minutes', value: '30', type: 'integer', category: 'security', desc: 'Account lockout duration in minutes', editable: 1 },
    { key: 'password_expiry_days', value: '90', type: 'integer', category: 'security', desc: 'Password expiration period in days', editable: 1 },
    { key: 'default_currency', value: 'TND', type: 'string', category: 'financial', desc: 'Default currency for premiums and payouts', editable: 0 },
    { key: 'ioda_api_base_url', value: 'https://ioda.caida.org/api', type: 'string', category: 'integration', desc: 'IODA API base URL for outage monitoring', editable: 1 },
    { key: 'ioda_check_interval_minutes', value: '15', type: 'integer', category: 'integration', desc: 'IODA outage check interval in minutes', editable: 1 },
  ];

  for (const setting of systemSettings) {
    await prisma.systemSetting.upsert({
      where: { settingKey_validFrom: { settingKey: setting.key, validFrom: new Date('2025-01-01T00:00:00.000Z') } },
      update: {},
      create: {
        settingKey: setting.key,
        settingValue: setting.value,
        valueType: setting.type,
        isEditable: setting.editable,
        category: setting.category,
        description: setting.desc,
        validFrom: new Date('2025-01-01T00:00:00.000Z'),
      },
    });
  }
  console.log('  system_settings:', systemSettings.length, 'entries');

  // =======================================================================
  // PHASE 4 — Sequence Registry
  // =======================================================================
  console.log('\n--- Phase 4: Sequence Registry ---');

  const sequences = [
    { name: 'parametric_policy', prefix: 'PAR', padding: 6, desc: 'Parametric policy number sequence' },
    { name: 'parametric_claim', prefix: 'PCL', padding: 6, desc: 'Parametric claim number sequence' },
    { name: 'cyber_application', prefix: 'CYB', padding: 6, desc: 'Cyber application number sequence' },
    { name: 'cyber_policy', prefix: 'CYP', padding: 6, desc: 'Cyber policy number sequence' },
    { name: 'cyber_claim', prefix: 'CCL', padding: 6, desc: 'Cyber claim number sequence' },
  ];

  for (const seq of sequences) {
    await prisma.sequenceRegistry.upsert({
      where: { sequenceName: seq.name },
      update: {},
      create: {
        sequenceName: seq.name,
        prefix: seq.prefix,
        paddingWidth: seq.padding,
        description: seq.desc,
      },
    });
  }
  console.log('  sequence_registry:', sequences.length, 'entries');

  // =======================================================================
  // PHASE 5 — Admin User
  // =======================================================================
  console.log('\n--- Phase 5: Admin User ---');

  const { salt: adminSalt, hash: adminHash } = hashPasswordParts('admin123');
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash: adminHash,
      passwordSalt: adminSalt,
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@cobitun.tn',
      roleId: adminRole.id,
      isActive: 1,
      emailVerified: 1,
      emailVerifiedAt: new Date(),
    },
  });
  console.log('  admin user:', admin.username, '(id:', admin.id, ')');

  // =======================================================================
  // PHASE 6 — Categories
  // =======================================================================
  console.log('\n--- Phase 6: Categories ---');

  const parametricCategory = await prisma.category.upsert({
    where: { code: 'PARAMETRIC_CLOUD' },
    update: {},
    create: {
      code: 'PARAMETRIC_CLOUD',
      categoryName: 'Parametric Cloud Outage',
      description: 'Parametric insurance covering cloud and internet outages for Tunisian SMEs. Automatic triggers powered by IODA real-time monitoring. No claims forms, no adjusters, no waiting.',
      sortOrder: 1,
      createdBy: admin.id,
    },
  });

  const cyberCategory = await prisma.category.upsert({
    where: { code: 'CYBER_INDEMNITY' },
    update: {},
    create: {
      code: 'CYBER_INDEMNITY',
      categoryName: 'Cyber Insurance (Indemnity)',
      description: 'Indemnity-based cyber insurance covering business interruption, data recovery, extortion, liability, and other first-party/third-party losses, complementary to the parametric cloud outage product.',
      sortOrder: 2,
      createdBy: admin.id,
    },
  });
  console.log('  categories: PARAMETRIC_CLOUD, CYBER_INDEMNITY');

  // =======================================================================
  // PHASE 7 — Products
  // =======================================================================
  console.log('\n--- Phase 7: Products ---');

  const parametricProduct = await prisma.product.upsert({
    where: { productCode: 'PARAMETRIC_CLOUD_OUTAGE' },
    update: {},
    create: {
      categoryId: parametricCategory.id,
      productCode: 'PARAMETRIC_CLOUD_OUTAGE',
      productName: 'Parametric Cloud Outage Policy',
      productTypeId: parametricType.id,
      description: 'Parametric cloud outage insurance for Tunisian SMEs with cloud dependency. Automatic payout when IODA detects an outage exceeding the provider MTTR threshold. No claims forms, no adjusters, no waiting. Covers upstream provider failures, ISP outages, and infrastructure disruptions. Pricing uses a granular actuarial formula with 16 sectors, 5 business models, 3 resilience profiles, and optional provider risk factors.',
      masterPolicyLimit: 5000000,
      currency: 'TND',
      baseRatePer1000: 1.32,
      minimumPremiumTnd: 500,
      coveragePeriodMonths: 12,
      isActive: 1,
      createdBy: admin.id,
    },
  });

  const cyberProduct = await prisma.product.upsert({
    where: { productCode: 'CYBER_INDEMNITY_COMP' },
    update: {},
    create: {
      categoryId: cyberCategory.id,
      productCode: 'CYBER_INDEMNITY_COMP',
      productName: 'Comprehensive Cyber Indemnity Policy',
      productTypeId: indemnityType.id,
      description: 'Indemnity-based cyber insurance for Tunisian SMEs. Covers actual financial losses from cyber events including business interruption, data recovery, extortion, and liability. Requires proof of loss, forensic claims adjustment, and strict underwriting controls. Complements the parametric cloud outage product to close coverage gaps for cloud-dependent businesses.',
      masterPolicyLimit: 5000000,
      masterDeductibleSir: 500000,
      indemnityPeriodDays: 365,
      currency: 'TND',
      baseRatePer1000: 0,
      minimumPremiumTnd: 2000,
      coveragePeriodMonths: 12,
      isActive: 1,
      createdBy: admin.id,
    },
  });
  console.log('  products: PARAMETRIC_CLOUD_OUTAGE, CYBER_INDEMNITY_COMP');

  // =======================================================================
  // PHASE 8 — Cloud Providers (15 Tunisian providers)
  // =======================================================================
  console.log('\n--- Phase 8: Cloud Providers ---');

  // Provider risk factors from actuarial study
  const providerRiskFactors: Record<number, { riskScore: number; premiumFactor: number }> = {
    37492: { riskScore: 76.1, premiumFactor: 1.38 },
    37693: { riskScore: 37.9, premiumFactor: 1.19 },
    37504: { riskScore: 92.5, premiumFactor: 1.46 },
    37717: { riskScore: 5.2, premiumFactor: 1.03 },
    37671: { riskScore: 58.6, premiumFactor: 1.29 },
    37703: { riskScore: 0, premiumFactor: 1.00 },
    328880: { riskScore: 76.1, premiumFactor: 1.38 },
    327934: { riskScore: 34.7, premiumFactor: 1.17 },
    328414: { riskScore: 54.5, premiumFactor: 1.27 },
    50624: { riskScore: 54.5, premiumFactor: 1.27 },
    53306: { riskScore: 54.5, premiumFactor: 1.27 },
    49584: { riskScore: 0, premiumFactor: 1.00 },
    328394: { riskScore: 0, premiumFactor: 1.00 },
  };

  // MTTR values per tier (from EnumSlaTier)
  const mttrMap: Record<string, number> = { Bronze: 16, Silver: 8, Gold: 4, Platinum: 2 };

  // Base premium factor per SLA tier (matches EnumSlaTier.basePremiumFactor above)
  const basePremiumFactorMap: Record<string, number> = { Bronze: 0.80, Silver: 1.00, Gold: 1.30, Platinum: 1.80 };

  const providers = [
    { asn: 2609, name: 'Tunisia BackBone AS', ioda: 'TN-BB-AS', tier: 'Gold' },
    { asn: 37693, name: 'OOREDOO TUNISIE SA', ioda: 'TUNISIANA', tier: 'Gold' },
    { asn: 37492, name: 'Orange Tunisie', ioda: 'ORANGE-TN', tier: 'Gold' },
    { asn: 327934, name: 'Tunisie Telecom', ioda: 'Tunisie-Telecom', tier: 'Gold' },
    { asn: 37671, name: '3S INF (Globalnet)', ioda: 'GLOBALNET-AS', tier: 'Silver' },
    { asn: 37504, name: 'EO Data Center', ioda: 'EODATACENTER', tier: 'Silver' },
    { asn: 37717, name: 'Centre de Calcul El Khawarizmi', ioda: 'EL-Khawarizmi', tier: 'Silver' },
    { asn: 37703, name: 'ATLAX', ioda: 'AS37703', tier: 'Bronze' },
    { asn: 328880, name: 'STE INTERNET SMART SOLUTIONS', ioda: 'STE-INTERNET-SMART', tier: 'Bronze' },
    { asn: 31245, name: 'ATI - Agence Tunisienne Internet', ioda: 'ATI-TN', tier: 'Bronze' },
    { asn: 49584, name: 'DATAXION', ioda: 'DATAXION', tier: 'Platinum' },
    { asn: 328414, name: 'STE NEXT STEP IT', ioda: 'Next-Step-IT-AS', tier: 'Bronze' },
    { asn: 328853, name: 'OXAHOST', ioda: 'OXAHOST-AS', tier: 'Bronze' },
    { asn: 328394, name: 'Reseaux Formation et Conseils', ioda: 'RFC-AS', tier: 'Bronze' },
    { asn: 329186, name: 'Focus Technology Solutions', ioda: 'Focus-Tech-AS', tier: 'Bronze' },
  ];

  for (const prov of providers) {
    // Derive premium factor from study when available; otherwise fall back to SLA tier base factor
    const basePf = basePremiumFactorMap[prov.tier] ?? 1.0;
    const studyEntry = providerRiskFactors[prov.asn];
    const riskScore = studyEntry ? studyEntry.riskScore : 0;
    const premiumFactor = studyEntry ? studyEntry.premiumFactor : basePf;

    await prisma.cloudProvider.upsert({
      where: { asn: String(prov.asn) },
      update: {
        organisationName: prov.name,
        iodaName: prov.ioda,
        slaTierId: slaTierMap[prov.tier],
        mttrHours: mttrMap[prov.tier] || 16,
        riskScore: riskScore,
        premiumFactor: premiumFactor,
        isActive: 1,
        updatedBy: admin.id,
      },
      create: {
        asn: String(prov.asn),
        organisationName: prov.name,
        iodaName: prov.ioda,
        slaTierId: slaTierMap[prov.tier],
        mttrHours: mttrMap[prov.tier] || 16,
        riskScore: riskScore,
        premiumFactor: premiumFactor,
        isActive: 1,
        createdBy: admin.id,
      },
    });
  }
  console.log('  cloud_providers:', providers.length, 'entries');

  // =======================================================================
  // PHASE 9 — Coverage Grants (Cyber Indemnity Product)
  // =======================================================================
  console.log('\n--- Phase 9: Coverage Grants ---');

  const coverageGrants = [
    {
      code: 'BI', name: 'Business Interruption',
      desc: 'Lost revenue and extra costs during a cyber-caused outage.',
      subLimitDefault: null, waitingHours: 12, isOptional: 0, sort: 1,
      exclusions: JSON.stringify(['INFRASTRUCTURE_FAILURE']),
    },
    {
      code: 'DR', name: 'Data Recovery',
      desc: 'Restoring corrupted, encrypted, or lost data.',
      subLimitDefault: null, waitingHours: 0, isOptional: 0, sort: 2,
      exclusions: JSON.stringify(['INFRASTRUCTURE_FAILURE']),
    },
    {
      code: 'CE', name: 'Cyber Extortion',
      desc: 'Ransom payments, negotiation, and decryption tools.',
      subLimitDefault: 2500000, waitingHours: 0, isOptional: 0, sort: 3,
      exclusions: JSON.stringify(['STATE_BACKED_ACTORS']),
    },
    {
      code: 'SR', name: 'System Rectification',
      desc: 'Restoring compromised systems to a known-good state.',
      subLimitDefault: null, waitingHours: 0, isOptional: 0, sort: 4,
      exclusions: JSON.stringify(['BRICKING']),
    },
    {
      code: 'CM', name: 'Crisis Management',
      desc: 'PR, customer notification, credit monitoring.',
      subLimitDefault: 500000, waitingHours: 0, isOptional: 0, sort: 5,
      exclusions: JSON.stringify(['BODILY_INJURY_PROPERTY_DAMAGE']),
    },
    {
      code: 'PL', name: 'Privacy Liability',
      desc: 'Customer claims resulting from a data breach.',
      subLimitDefault: null, waitingHours: 0, isOptional: 0, sort: 6,
      exclusions: JSON.stringify(['PRIOR_ACTS']),
    },
    {
      code: 'RD', name: 'Regulatory Defence',
      desc: 'Legal costs defending against regulatory actions.',
      subLimitDefault: 1000000, waitingHours: 0, isOptional: 0, sort: 7,
      exclusions: JSON.stringify(['UNINSURABLE_FINES']),
    },
    {
      code: 'ML', name: 'Media Liability',
      desc: 'Defamation, IP, copyright via digital channels.',
      subLimitDefault: 500000, waitingHours: 0, isOptional: 0, sort: 8,
      exclusions: JSON.stringify(['INTENTIONAL_ACTS']),
    },
    {
      code: 'SE', name: 'Social Engineering / Cyber Theft',
      desc: 'Funds transfer fraud from impersonation (endorsement required).',
      subLimitDefault: 1000000, waitingHours: 0, isOptional: 1, sort: 9,
      exclusions: JSON.stringify(['NOT_BASE_COVER']),
    },
  ];

  for (const cg of coverageGrants) {
    await prisma.coverageGrant.upsert({
      where: { productId_coverageCode: { productId: cyberProduct.id, coverageCode: cg.code } },
      update: {},
      create: {
        productId: cyberProduct.id,
        coverageCode: cg.code,
        coverageName: cg.name,
        subLimitDefault: cg.subLimitDefault,
        waitingPeriodHours: cg.waitingHours,
        exclusionsJson: cg.exclusions,
        isOptional: cg.isOptional,
        sortOrder: cg.sort,
      },
    });
  }
  console.log('  coverage_grants:', coverageGrants.length, 'entries');

  // =======================================================================
  // PHASE 10 — Product Exclusions (Cyber Indemnity Product)
  // =======================================================================
  console.log('\n--- Phase 10: Product Exclusions ---');

  const masterExclusions = [
    { code: 'WAR_AND_STATE_SPONSORED', name: 'War and State-Sponsored Cyber Operations', desc: 'War and state-sponsored cyber operations' },
    { code: 'INFRASTRUCTURE_FAILURE', name: 'Upstream Infrastructure Failure', desc: 'Upstream cloud/ISP infrastructure failure (covered by parametric product)' },
    { code: 'BODILY_INJURY_PROPERTY_DAMAGE', name: 'Bodily Injury & Property Damage', desc: 'Bodily injury and property damage' },
    { code: 'PRIOR_ACTS', name: 'Prior Acts', desc: 'Acts predating policy inception' },
    { code: 'NBCR', name: 'NBCR', desc: 'Nuclear, biological, chemical, and radiological events' },
    { code: 'SANCTIONS_TERRITORIAL', name: 'Sanctions & Territorial', desc: 'Sanctioned territories and persons' },
  ];

  for (const ex of masterExclusions) {
    await prisma.productExclusion.upsert({
      where: { productId_exclusionCode: { productId: cyberProduct.id, exclusionCode: ex.code } },
      update: {},
      create: {
        productId: cyberProduct.id,
        exclusionCode: ex.code,
        exclusionName: ex.name,
        description: ex.desc,
      },
    });
  }
  console.log('  product_exclusions:', masterExclusions.length, 'entries');

  // =======================================================================
  // PHASE 11 — Underwriting Questions (Cyber Indemnity Product)
  // =======================================================================
  console.log('\n--- Phase 11: Underwriting Questions ---');

  const underwritingQuestions = [
    { field: 'company_name', question: 'Legal company name', type: 'text', options: null, expected: null, required: 1, sort: 1 },
    { field: 'sector', question: 'Industry sector', type: 'picklist', options: JSON.stringify(['Technology', 'Finance', 'Healthcare', 'Manufacturing', 'Retail', 'Other']), expected: null, required: 1, sort: 2 },
    { field: 'annual_revenue_tnd', question: 'Annual revenue (TND)', type: 'number', options: null, expected: null, required: 1, sort: 3 },
    { field: 'employees', question: 'Number of employees', type: 'number', options: null, expected: null, required: 1, sort: 4 },
    { field: 'it_security_team_size', question: 'Size of internal IT/security team', type: 'number', options: null, expected: null, required: 0, sort: 5 },
    { field: 'mfa_enabled', question: 'Is Multi-Factor Authentication enabled on all remote access, email, and privileged accounts?', type: 'boolean', options: null, expected: 'true', required: 1, sort: 6 },
    { field: 'edr_deployed', question: 'Is Endpoint Detection & Response (EDR) deployed on all endpoints?', type: 'boolean', options: null, expected: 'true', required: 1, sort: 7 },
    { field: 'immutable_backups', question: 'Are immutable, air-gapped or offline backups in place?', type: 'boolean', options: null, expected: 'true', required: 1, sort: 8 },
    { field: 'patch_management_cadence', question: 'Patch management frequency', type: 'picklist', options: JSON.stringify(['Daily', 'Weekly', 'Monthly', 'Ad-hoc']), expected: null, required: 1, sort: 9 },
    { field: 'dmarc_dkim_spf', question: 'Are DMARC, DKIM, and SPF email security protocols configured?', type: 'boolean', options: null, expected: 'true', required: 1, sort: 10 },
    { field: 'network_segmentation', question: 'Is network segmentation implemented for critical systems?', type: 'boolean', options: null, expected: 'true', required: 1, sort: 11 },
    { field: 'ir_plan_tested', question: 'Do you have a documented and tested incident response plan?', type: 'boolean', options: null, expected: 'true', required: 1, sort: 12 },
    { field: 'employee_training', question: 'Is regular security awareness training conducted for employees?', type: 'boolean', options: null, expected: 'true', required: 1, sort: 13 },
    { field: 'prior_incidents', question: "Describe any cyber incidents in the last 3 years (or state 'None')", type: 'text', options: null, expected: null, required: 1, sort: 14 },
  ];

  for (const q of underwritingQuestions) {
    await prisma.underwritingQuestion.upsert({
      where: { productId_fieldName: { productId: cyberProduct.id, fieldName: q.field } },
      update: {},
      create: {
        productId: cyberProduct.id,
        fieldName: q.field,
        questionText: q.question,
        questionTypeId: qtMap[q.type],
        optionsJson: q.options,
        expectedAnswer: q.expected,
        isRequired: q.required,
        sortOrder: q.sort,
      },
    });
  }
  console.log('  underwriting_questions:', underwritingQuestions.length, 'entries');

  // =======================================================================

  // =======================================================================
  // PHASE 12 — Additional Users (10+)
  // =======================================================================
  console.log('\n--- Phase 12: Additional Users ---');

  const customerUsers: { username: string; firstName: string; lastName: string; email: string; mfa: number; sector: string; bm: string; company: string; regNum: string; taxId: string; turnover: number; tb: string; rp: string; address: string; city: string; mobile: string }[] = [
    { username: 'ahmed.b', firstName: 'Ahmed', lastName: 'Ben Ali', email: 'ahmed.benali@techvision.tn', mfa: 1, sector: 'Technology', bm: 'SaaS', company: 'TechVision Solutions', regNum: 'TN-REG-001', taxId: 'TAX-001', turnover: 1200000, tb: 'Medium', rp: 'High', address: '12 Rue de la Technologie', city: 'Tunis', mobile: '+216-20-001-001' },
    { username: 'fatma.m', firstName: 'Fatma', lastName: 'Mansouri', email: 'fatma.mansouri@finplus.tn', mfa: 0, sector: 'Finance', bm: 'B2B', company: 'FinPlus Tunisia', regNum: 'TN-REG-002', taxId: 'TAX-002', turnover: 8500000, tb: 'Large', rp: 'High', address: '45 Avenue Habib Bourguiba', city: 'Tunis', mobile: '+216-20-001-002' },
    { username: 'khaled.j', firstName: 'Khaled', lastName: 'Jemaa', email: 'khaled.jemaa@cloudmed.tn', mfa: 1, sector: 'Healthcare', bm: 'B2B2C', company: 'CloudMed TN', regNum: 'TN-REG-003', taxId: 'TAX-003', turnover: 3200000, tb: 'Medium', rp: 'Medium', address: '8 Rue Ibn Khaldoun', city: 'Sousse', mobile: '+216-20-001-003' },
    { username: 'salma.b', firstName: 'Salma', lastName: 'Bouazizi', email: 'salma.bouazizi@retailhub.tn', mfa: 0, sector: 'Retail', bm: 'B2C', company: 'RetailHub Tunisia', regNum: 'TN-REG-004', taxId: 'TAX-004', turnover: 750000, tb: 'Small', rp: 'Medium', address: '22 Rue de la Liberté', city: 'Sfax', mobile: '+216-20-001-004' },
    { username: 'youssef.k', firstName: 'Youssef', lastName: 'Khelifi', email: 'youssef.khelifi@energynet.tn', mfa: 1, sector: 'Energy', bm: 'B2B', company: 'EnergyNet Solutions', regNum: 'TN-REG-005', taxId: 'TAX-005', turnover: 15000000, tb: 'Enterprise', rp: 'High', address: '3 Avenue Mohammed V', city: 'Tunis', mobile: '+216-20-001-005' },
    { username: 'nadia.t', firstName: 'Nadia', lastName: 'Trabelsi', email: 'nadia.trabelsi@educonnect.tn', mfa: 0, sector: 'Education', bm: 'B2B2C', company: 'EduConnect TN', regNum: 'TN-REG-006', taxId: 'TAX-006', turnover: 450000, tb: 'Small', rp: 'Low', address: '15 Rue de l\'Indépendance', city: 'Monastir', mobile: '+216-20-001-006' },
    { username: 'omar.h', firstName: 'Omar', lastName: 'Hamdi', email: 'omar.hamdi@logipro.tn', mfa: 0, sector: 'Logistics', bm: 'Marketplace', company: 'LogiPro TN', regNum: 'TN-REG-007', taxId: 'TAX-007', turnover: 2800000, tb: 'Medium', rp: 'Medium', address: '7 Zone Industrielle', city: 'Bizerte', mobile: '+216-20-001-007' },
    { username: 'leila.m', firstName: 'Leila', lastName: 'Mokhtar', email: 'leila.mokhtar@mediastream.tn', mfa: 1, sector: 'Media', bm: 'B2C', company: 'MediaStream TN', regNum: 'TN-REG-008', taxId: 'TAX-008', turnover: 1800000, tb: 'Medium', rp: 'Medium', address: '50 Avenue de la République', city: 'Tunis', mobile: '+216-20-001-008' },
    { username: 'rachid.z', firstName: 'Rachid', lastName: 'Zouari', email: 'rachid.zouari@agromark.tn', mfa: 0, sector: 'Agriculture', bm: 'B2B', company: 'AgroMark Tunisia', regNum: 'TN-REG-009', taxId: 'TAX-009', turnover: 600000, tb: 'Small', rp: 'Low', address: '100 Route de Kairouan', city: 'Kairouan', mobile: '+216-20-001-009' },
    { username: 'amina.s', firstName: 'Amina', lastName: 'Salah', email: 'amina.salah@telecomplus.tn', mfa: 1, sector: 'Telecom', bm: 'B2B2C', company: 'TelecomPlus TN', regNum: 'TN-REG-010', taxId: 'TAX-010', turnover: 22000000, tb: 'Enterprise', rp: 'High', address: '1 Rue du 9 Avril', city: 'Tunis', mobile: '+216-20-001-010' },
  ];

  const customerUserIds: number[] = [];
  const customerIds: number[] = [];
  for (const cu of customerUsers) {
    const { salt: cuSalt, hash: cuHash } = hashPasswordParts('Customer123!');
    const cuUser = await prisma.user.upsert({
      where: { username: cu.username },
      update: {},
      create: {
        username: cu.username,
        passwordHash: cuHash,
        passwordSalt: cuSalt,
        firstName: cu.firstName,
        lastName: cu.lastName,
        email: cu.email,
        roleId: customerRole.id,
        isActive: 1,
        emailVerified: 1,
        emailVerifiedAt: new Date('2025-01-15T10:00:00.000Z'),
        mfaEnabled: cu.mfa,
        mfaSecret: cu.mfa ? 'JBSWY3DPEHPK3PXP' : null,
        lastLoginAt: new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)),
        lastLoginIp: `196.203.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
      },
    });
    customerUserIds.push(cuUser.id);

    const cust = await prisma.customer.upsert({
      where: { userId: cuUser.id },
      update: {},
      create: {
        userId: cuUser.id,
        companyName: cu.company,
        registrationNumber: cu.regNum,
        taxId: cu.taxId,
        sectorId: sectorMap[cu.sector],
        businessModelId: bmMap[cu.bm],
        address: cu.address,
        city: cu.city,
        country: 'Tunisia',
        mobile: cu.mobile,
        annualTurnoverTnd: cu.turnover,
        createdBy: admin.id,
      },
    });
    customerIds.push(cust.id);
  }

  // Additional admin users
  const { salt: admin2Salt, hash: admin2Hash } = hashPasswordParts('Admin456!');
  const admin2 = await prisma.user.upsert({
    where: { username: 'ops.admin' },
    update: {},
    create: {
      username: 'ops.admin',
      passwordHash: admin2Hash,
      passwordSalt: admin2Salt,
      firstName: 'Operations',
      lastName: 'Admin',
      email: 'ops.admin@cobitun.tn',
      roleId: adminRole.id,
      isActive: 1,
      emailVerified: 1,
      emailVerifiedAt: new Date(),
      mfaEnabled: 1,
      mfaSecret: 'K5QXY3LNMFUW4ZDB',
    },
  });
  const { salt: admin3Salt, hash: admin3Hash } = hashPasswordParts('Admin789!');
  const admin3 = await prisma.user.upsert({
    where: { username: 'uw.admin' },
    update: {},
    create: {
      username: 'uw.admin',
      passwordHash: admin3Hash,
      passwordSalt: admin3Salt,
      firstName: 'Underwriting',
      lastName: 'Admin',
      email: 'uw.admin@cobitun.tn',
      roleId: adminRole.id,
      isActive: 1,
      emailVerified: 1,
      emailVerifiedAt: new Date(),
    },
  });
  console.log('  users: 10 customer + 2 admin, customers: 10');

  // =======================================================================
  // PHASE 12.5 — Fraud Test Users & Intelligence
  // =======================================================================
  console.log('\n--- Phase 12.5: Fraud Test Users & Intelligence ---');

  const fraudTestUsers = [
    { username: 'legitimate1', firstName: 'Amine', lastName: 'Triki', email: 'legitimate1@trustedcorp.tn', mfa: 1, sector: 'Technology', bm: 'SaaS', company: 'TrustedCorp Solutions', regNum: 'TN-REG-011', taxId: 'TAX-011', turnover: 820000, tb: 'Medium', rp: 'High', address: '18 Rue du Lac', city: 'Tunis', mobile: '+216-20-002-001', website: 'https://trustedcorp.tn', emailVerified: 1, lastLoginIp: '10.0.0.1' },
    { username: 'legitimate2', firstName: 'Nadia', lastName: 'Selmi', email: 'legitimate2@securelogic.tn', mfa: 1, sector: 'Finance', bm: 'B2B', company: 'SecureLogic Finance', regNum: 'TN-REG-012', taxId: 'TAX-012', turnover: 6450000, tb: 'Large', rp: 'High', address: '22 Avenue Habib Bourguiba', city: 'Tunis', mobile: '+216-20-002-002', website: 'https://securelogic.tn', emailVerified: 1, lastLoginIp: '10.0.0.2' },
    { username: 'legitimate3', firstName: 'Safa', lastName: 'Kacem', email: 'legitimate3@brighthealth.tn', mfa: 1, sector: 'Healthcare', bm: 'B2B2C', company: 'BrightHealth TN', regNum: 'TN-REG-013', taxId: 'TAX-013', turnover: 3100000, tb: 'Medium', rp: 'Medium', address: '5 Rue de Carthage', city: 'Sfax', mobile: '+216-20-002-003', website: 'https://brighthealth.tn', emailVerified: 1, lastLoginIp: '10.0.0.3' },
    { username: 'legitimate4', firstName: 'Hichem', lastName: 'Bouaziz', email: 'legitimate4@clearchain.tn', mfa: 0, sector: 'Manufacturing', bm: 'B2B', company: 'ClearChain Manufacturing', regNum: 'TN-REG-014', taxId: 'TAX-014', turnover: 980000, tb: 'Medium', rp: 'Medium', address: '30 Route de Grombalia', city: 'Bizerte', mobile: '+216-20-002-004', website: 'https://clearchain.tn', emailVerified: 1, lastLoginIp: '10.0.0.4' },
    { username: 'legitimate5', firstName: 'Sonia', lastName: 'Mahmoud', email: 'legitimate5@agripulse.tn', mfa: 0, sector: 'Agriculture', bm: 'B2B', company: 'AgriPulse Tunisia', regNum: 'TN-REG-015', taxId: 'TAX-015', turnover: 540000, tb: 'Small', rp: 'Low', address: '14 Route de Kairouan', city: 'Kairouan', mobile: '+216-20-002-005', website: 'https://agripulse.tn', emailVerified: 1, lastLoginIp: '10.0.0.5' },
    { username: 'fakeuser1', firstName: 'Imad', lastName: 'Fake', email: 'fakeuser1@anonymous-shell.tn', mfa: 0, sector: 'Retail', bm: 'B2C', company: 'Anonymous Shell Corp', regNum: 'TN-REG-021', taxId: 'TAX-021', turnover: 150000, tb: 'Small', rp: 'High', address: '1 Rue des Entrepreneurs', city: 'Tunis', mobile: null, website: null, emailVerified: 0, lastLoginIp: '172.16.0.1' },
    { username: 'fakeuser2', firstName: 'Nizar', lastName: 'Fake', email: 'fakeuser2@anonymous-shell.tn', mfa: 0, sector: 'Logistics', bm: 'Marketplace', company: 'Phantom Logistics SARL', regNum: 'TN-REG-022', taxId: 'TAX-022', turnover: 120000, tb: 'Small', rp: 'High', address: '88 Zone Industrielle', city: 'Sfax', mobile: null, website: null, emailVerified: 0, lastLoginIp: '172.16.0.2' },
    { username: 'fakeuser3', firstName: 'Kamel', lastName: 'Fake', email: 'fakeuser3@anonymous-shell.tn', mfa: 0, sector: 'Media', bm: 'B2C', company: 'Ghost Media SARL', regNum: 'TN-REG-023', taxId: 'TAX-023', turnover: 98000, tb: 'Micro', rp: 'High', address: '9 Boulevard de la Marina', city: 'Sousse', mobile: null, website: null, emailVerified: 0, lastLoginIp: '172.16.0.3' },
    { username: 'fakeuser4', firstName: 'Rania', lastName: 'Fake', email: 'fakeuser4@anonymous-shell.tn', mfa: 0, sector: 'Education', bm: 'B2B2C', company: 'Shadow Educations', regNum: 'TN-REG-024', taxId: 'TAX-024', turnover: 75000, tb: 'Micro', rp: 'High', address: '44 Avenue de Paris', city: 'Monastir', mobile: null, website: null, emailVerified: 0, lastLoginIp: '172.16.0.4' },
    { username: 'fakeuser5', firstName: 'Nour', lastName: 'Fake', email: 'fakeuser5@anonymous-shell.tn', mfa: 0, sector: 'Telecom', bm: 'B2B2C', company: 'Phantom Telecom SARL', regNum: 'TN-REG-025', taxId: 'TAX-025', turnover: 102000, tb: 'Micro', rp: 'High', address: '16 Rue du Commerce', city: 'Tunis', mobile: null, website: null, emailVerified: 0, lastLoginIp: '172.16.0.5' },
    { username: 'review1', firstName: 'Yassine', lastName: 'Review', email: 'review1@review.cobitun.tn', mfa: 1, sector: 'Technology', bm: 'SaaS', company: 'ReviewOne TN', regNum: 'TN-REG-031', taxId: 'TAX-031', turnover: 420000, tb: 'Small', rp: 'Medium', address: '11 Rue de l’Innovation', city: 'Tunis', mobile: '+216-20-002-006', website: null, emailVerified: 1, lastLoginIp: '41.225.0.1' },
    { username: 'review2', firstName: 'Hend', lastName: 'Review', email: 'review2@review.cobitun.tn', mfa: 1, sector: 'Finance', bm: 'B2B', company: 'ReviewTwo Finance', regNum: 'TN-REG-032', taxId: 'TAX-032', turnover: 760000, tb: 'Medium', rp: 'Medium', address: '60 Avenue du Lac', city: 'Sfax', mobile: '+216-20-002-007', website: null, emailVerified: 1, lastLoginIp: '41.225.0.2' },
    { username: 'review3', firstName: 'Majd', lastName: 'Review', email: 'review3@review.cobitun.tn', mfa: 1, sector: 'Healthcare', bm: 'B2B2C', company: 'ReviewThree Health', regNum: 'TN-REG-033', taxId: 'TAX-033', turnover: 1950000, tb: 'Medium', rp: 'High', address: '90 Rue du 2 Mars', city: 'Sousse', mobile: '+216-20-002-008', website: null, emailVerified: 1, lastLoginIp: '41.225.0.3' },
  ];

  const fraudIpReputationData = [
    { ip: '10.0.0.1', accountCount: 8, fakeCount: 0, riskScore: 5.5, blocked: 0, notes: 'Known good corporate office network' },
    { ip: '10.0.0.2', accountCount: 6, fakeCount: 1, riskScore: 14.2, blocked: 0, notes: 'Trusted remote access with mild historic risk' },
    { ip: '10.0.0.3', accountCount: 2, fakeCount: 0, riskScore: 8.1, blocked: 0, notes: 'Healthcare partner network' },
    { ip: '172.16.0.1', accountCount: 15, fakeCount: 12, riskScore: 93.7, blocked: 1, notes: 'Frequent fake account creation source' },
    { ip: '172.16.0.2', accountCount: 10, fakeCount: 8, riskScore: 88.3, blocked: 1, notes: 'Anonymous proxy / VPN cluster' },
    { ip: '41.225.0.1', accountCount: 4, fakeCount: 0, riskScore: 16.2, blocked: 0, notes: 'Local mobile ISP with legit traffic' },
    { ip: '41.225.0.2', accountCount: 3, fakeCount: 1, riskScore: 41.9, blocked: 0, notes: 'New device cluster under review' },
  ];

  const fraudDeviceFingerprintData = [
    { fingerprint: 'DEVICE-FP-LEGIT-001', userCount: 3, riskScore: 4.5, blocked: 0 },
    { fingerprint: 'DEVICE-FP-LEGIT-002', userCount: 2, riskScore: 7.8, blocked: 0 },
    { fingerprint: 'DEVICE-FP-FAKE-001', userCount: 12, riskScore: 92.4, blocked: 1 },
    { fingerprint: 'DEVICE-FP-FAKE-002', userCount: 10, riskScore: 88.8, blocked: 1 },
    { fingerprint: 'DEVICE-FP-REVIEW-001', userCount: 4, riskScore: 47.0, blocked: 0 },
  ];

  const fraudDetectionData = [
    { username: 'legitimate1', verdict: 'LEGITIMATE', ruleScore: 6.7, llmScore: 8.2, finalScore: 7.4, humanLabel: 'confirmed_legit' },
    { username: 'legitimate2', verdict: 'LEGITIMATE', ruleScore: 12.1, llmScore: 7.9, finalScore: 10.0, humanLabel: 'confirmed_legit' },
    { username: 'legitimate3', verdict: 'LEGITIMATE', ruleScore: 9.4, llmScore: 6.8, finalScore: 8.1, humanLabel: 'confirmed_legit' },
    { username: 'legitimate4', verdict: 'LEGITIMATE', ruleScore: 18.9, llmScore: 5.6, finalScore: 11.5, humanLabel: 'confirmed_legit' },
    { username: 'legitimate5', verdict: 'LEGITIMATE', ruleScore: 10.2, llmScore: 6.5, finalScore: 8.4, humanLabel: 'confirmed_legit' },
    { username: 'fakeuser1', verdict: 'FAKE', ruleScore: 92.2, llmScore: 95.1, finalScore: 93.5, humanLabel: 'confirmed_fake' },
    { username: 'fakeuser2', verdict: 'FAKE', ruleScore: 88.0, llmScore: 91.3, finalScore: 89.6, humanLabel: 'confirmed_fake' },
    { username: 'fakeuser3', verdict: 'FAKE', ruleScore: 91.7, llmScore: 92.0, finalScore: 91.8, humanLabel: 'confirmed_fake' },
    { username: 'fakeuser4', verdict: 'FAKE', ruleScore: 94.5, llmScore: 93.2, finalScore: 93.9, humanLabel: 'confirmed_fake' },
    { username: 'fakeuser5', verdict: 'FAKE', ruleScore: 89.9, llmScore: 90.5, finalScore: 90.2, humanLabel: 'confirmed_fake' },
    { username: 'review1', verdict: 'REVIEW', ruleScore: 42.0, llmScore: 45.1, finalScore: 43.5, humanLabel: null },
    { username: 'review2', verdict: 'REVIEW', ruleScore: 47.5, llmScore: 48.2, finalScore: 47.8, humanLabel: null },
    { username: 'review3', verdict: 'REVIEW', ruleScore: 54.8, llmScore: 50.9, finalScore: 52.8, humanLabel: null },
  ];

  for (const fu of fraudTestUsers) {
    const { salt: fuSalt, hash: fuHash } = hashPasswordParts('Customer123!');
    const fuUser = await prisma.user.upsert({
      where: { username: fu.username },
      update: {},
      create: {
        username: fu.username,
        passwordHash: fuHash,
        passwordSalt: fuSalt,
        firstName: fu.firstName,
        lastName: fu.lastName,
        email: fu.email,
        roleId: customerRole.id,
        isActive: 1,
        emailVerified: fu.emailVerified,
        emailVerifiedAt: fu.emailVerified ? new Date('2025-02-01T10:00:00.000Z') : null,
        mfaEnabled: fu.mfa,
        mfaSecret: fu.mfa ? 'JBSWY3DPEHPK3PXP' : null,
        lastLoginAt: new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)),
        lastLoginIp: fu.lastLoginIp,
      },
    });
    customerUserIds.push(fuUser.id);

    const cust = await prisma.customer.upsert({
      where: { userId: fuUser.id },
      update: {},
      create: {
        userId: fuUser.id,
        companyName: fu.company,
        registrationNumber: fu.regNum,
        taxId: fu.taxId,
        sectorId: sectorMap[fu.sector],
        businessModelId: bmMap[fu.bm],
        address: fu.address,
        city: fu.city,
        country: 'Tunisia',
        mobile: fu.mobile,
        website: fu.website,
        annualTurnoverTnd: fu.turnover,
        createdBy: admin.id,
      },
    });
    customerIds.push(cust.id);
  }

  for (const ip of fraudIpReputationData) {
    await prisma.ipReputation.upsert({
      where: { ip: ip.ip },
      update: {
        lastSeen: new Date(),
        accountCount: ip.accountCount,
        fakeCount: ip.fakeCount,
        riskScore: ip.riskScore,
        blocked: ip.blocked,
        notes: ip.notes,
        updatedAt: new Date(),
      },
      create: {
        ip: ip.ip,
        accountCount: ip.accountCount,
        fakeCount: ip.fakeCount,
        riskScore: ip.riskScore,
        blocked: ip.blocked,
        notes: ip.notes,
        firstSeen: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        lastSeen: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  for (const device of fraudDeviceFingerprintData) {
    await prisma.deviceFingerprint.upsert({
      where: { fingerprint: device.fingerprint },
      update: {
        lastSeen: new Date(),
        userCount: device.userCount,
        riskScore: device.riskScore,
        blocked: device.blocked,
        updatedAt: new Date(),
      },
      create: {
        fingerprint: device.fingerprint,
        userCount: device.userCount,
        firstSeen: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        lastSeen: new Date(),
        riskScore: device.riskScore,
        blocked: device.blocked,
        updatedAt: new Date(),
      },
    });
  }

  for (const fr of fraudDetectionData) {
    const user = await prisma.user.findUnique({ where: { username: fr.username } });
    if (!user) continue;
    const existing = await prisma.fraudDetectionResult.findFirst({ where: { userId: user.id } });
    if (existing) {
      await prisma.fraudDetectionResult.update({
        where: { id: existing.id },
        data: {
          ruleScore: fr.ruleScore,
          ruleFlags: JSON.stringify([]),
          llmScore: fr.llmScore,
          llmReasoning: null,
          finalScore: fr.finalScore,
          verdict: fr.verdict,
          modelUsed: 'ollama-fraud-v1',
          latencyMs: 120.0,
          ipAtCheck: user.lastLoginIp,
          uaAtCheck: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          humanLabel: fr.humanLabel,
        },
      });
    } else {
      await prisma.fraudDetectionResult.create({
        data: {
          userId: user.id,
          ruleScore: fr.ruleScore,
          ruleFlags: JSON.stringify([]),
          llmScore: fr.llmScore,
          llmReasoning: null,
          finalScore: fr.finalScore,
          verdict: fr.verdict,
          modelUsed: 'ollama-fraud-v1',
          latencyMs: 120.0,
          ipAtCheck: user.lastLoginIp,
          uaAtCheck: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          humanLabel: fr.humanLabel,
          createdAt: new Date(),
        },
      });
    }
  }

  console.log('  fraud users: 13, ip_reputation entries: 7, device fingerprints: 5, fraud detection results:', fraudDetectionData.length);

  // =======================================================================
  // PHASE 13 — Payout Function Configs (3+)
  // =======================================================================
  console.log('\n--- Phase 13: Payout Function Configs ---');

  const linearConfig = await prisma.payoutFunctionConfig.upsert({
    where: { configCode: 'LINEAR_STANDARD' },
    update: {},
    create: {
      configName: 'Linear Standard Payout',
      configCode: 'LINEAR_STANDARD',
      functionType: 'LINEAR',
      description: 'Linear payout — proportional to outage duration',
      linearMultiplier: 1.0,
      isActive: 1,
      createdBy: admin.id,
    },
  });
  const stepConfig = await prisma.payoutFunctionConfig.upsert({
    where: { configCode: 'STEP_TIERED' },
    update: {},
    create: {
      configName: 'Step Tiered Payout',
      configCode: 'STEP_TIERED',
      functionType: 'STEP',
      description: 'Step-function payout with increasing tiers per hour bracket',
      stepConfigJson: JSON.stringify([{ from: 0, to: 4, payoutPct: 25 }, { from: 4, to: 8, payoutPct: 50 }, { from: 8, to: 16, payoutPct: 75 }, { from: 16, to: 999, payoutPct: 100 }]),
      isActive: 1,
      createdBy: admin.id,
    },
  });
  const hybridConfig = await prisma.payoutFunctionConfig.upsert({
    where: { configCode: 'HYBRID_BASE_STEP' },
    update: {},
    create: {
      configName: 'Hybrid Base + Step Payout',
      configCode: 'HYBRID_BASE_STEP',
      functionType: 'HYBRID',
      description: 'Hybrid payout — base rate plus step adjustments',
      hybridBaseRate: 0.5,
      hybridStepConfigJson: JSON.stringify([{ threshold: 4, multiplier: 1.0 }, { threshold: 8, multiplier: 1.5 }, { threshold: 16, multiplier: 2.0 }]),
      isActive: 1,
      createdBy: admin.id,
    },
  });
  console.log('  payout_function_configs: 3');


  // =======================================================================
  // PHASE 14 — Parametric Policies (20+, across ALL statuses)
  // =======================================================================
  console.log('\n--- Phase 14: Parametric Policies ---');

  // Fetch enum status IDs for lookup
  const paramPolicyStatusMap: Record<string, number> = {};
  for (const s of await prisma.enumParamPolicyStatus.findMany()) {
    paramPolicyStatusMap[s.statusCode] = s.id;
  }
  const paramClaimStatusMap: Record<string, number> = {};
  for (const s of await prisma.enumParamClaimStatus.findMany()) {
    paramClaimStatusMap[s.statusCode] = s.id;
  }
  const cyberAppStatusMap: Record<string, number> = {};
  for (const s of await prisma.enumCyberAppStatus.findMany()) {
    cyberAppStatusMap[s.statusCode] = s.id;
  }
  const cyberPolicyStatusMap: Record<string, number> = {};
  for (const s of await prisma.enumCyberPolicyStatus.findMany()) {
    cyberPolicyStatusMap[s.statusCode] = s.id;
  }
  const cyberClaimStatusMap: Record<string, number> = {};
  for (const s of await prisma.enumCyberClaimStatus.findMany()) {
    cyberClaimStatusMap[s.statusCode] = s.id;
  }
  const wfAppStatusMap: Record<string, number> = {};
  for (const s of await prisma.enumWorkflowAppStatus.findMany()) {
    wfAppStatusMap[s.statusCode] = s.id;
  }
  const wfClaimStatusMap: Record<string, number> = {};
  for (const s of await prisma.enumWorkflowClaimStatus.findMany()) {
    wfClaimStatusMap[s.statusCode] = s.id;
  }
  const taskActorMap: Record<string, number> = {};
  for (const a of await prisma.enumTaskActor.findMany()) {
    taskActorMap[a.actorCode] = a.id;
  }
  const taskStatusMap: Record<string, number> = {};
  for (const s of await prisma.enumTaskStatus.findMany()) {
    taskStatusMap[s.statusCode] = s.id;
  }
  const secPostureMap: Record<string, number> = {};
  for (const sp of await prisma.enumSecurityPosture.findMany()) {
    secPostureMap[sp.postureCode] = sp.id;
  }
  const incidentTypeMap: Record<string, number> = {};
  for (const it of await prisma.enumIncidentType.findMany()) {
    incidentTypeMap[it.typeCode] = it.id;
  }

  // Get cloud provider IDs
  const providerList = await prisma.cloudProvider.findMany({ orderBy: { id: 'asc' } });
  const providerIds = providerList.map(p => p.id);

  // Helper: days ago
  const daysAgo = (d: number) => new Date(Date.now() - d * 24 * 60 * 60 * 1000);

  const paramPoliciesData: { num: string; custIdx: number; provIdx: number; sector: string; bm: string; tb: string; rp: string; turnover: number; status: string; effective?: Date; expiry?: Date; payoutConfigId?: number }[] = [
    { num: 'PAR-000001', custIdx: 0, provIdx: 0, sector: 'Technology', bm: 'SaaS', tb: 'Medium', rp: 'High', turnover: 1200000, status: 'PENDING', effective: daysAgo(5), expiry: daysAgo(-360) },
    { num: 'PAR-000002', custIdx: 1, provIdx: 1, sector: 'Finance', bm: 'B2B', tb: 'Large', rp: 'High', turnover: 8500000, status: 'PENDING', effective: daysAgo(3), expiry: daysAgo(-362) },
    { num: 'PAR-000003', custIdx: 2, provIdx: 2, sector: 'Healthcare', bm: 'B2B2C', tb: 'Medium', rp: 'Medium', turnover: 3200000, status: 'APPROVED', effective: daysAgo(10), expiry: daysAgo(-355) },
    { num: 'PAR-000004', custIdx: 3, provIdx: 3, sector: 'Retail', bm: 'B2C', tb: 'Small', rp: 'Medium', turnover: 750000, status: 'APPROVED', effective: daysAgo(8), expiry: daysAgo(-357) },
    { num: 'PAR-000005', custIdx: 4, provIdx: 4, sector: 'Energy', bm: 'B2B', tb: 'Enterprise', rp: 'High', turnover: 15000000, status: 'ACTIVE', effective: daysAgo(30), expiry: daysAgo(-335) },
    { num: 'PAR-000006', custIdx: 5, provIdx: 5, sector: 'Education', bm: 'B2B2C', tb: 'Small', rp: 'Low', turnover: 450000, status: 'ACTIVE', effective: daysAgo(45), expiry: daysAgo(-320) },
    { num: 'PAR-000007', custIdx: 6, provIdx: 6, sector: 'Logistics', bm: 'Marketplace', tb: 'Medium', rp: 'Medium', turnover: 2800000, status: 'ACTIVE', effective: daysAgo(60), expiry: daysAgo(-305) },
    { num: 'PAR-000008', custIdx: 7, provIdx: 7, sector: 'Media', bm: 'B2C', tb: 'Medium', rp: 'Medium', turnover: 1800000, status: 'SUSPENDED', effective: daysAgo(50), expiry: daysAgo(-315) },
    { num: 'PAR-000009', custIdx: 8, provIdx: 8, sector: 'Agriculture', bm: 'B2B', tb: 'Small', rp: 'Low', turnover: 600000, status: 'SUSPENDED', effective: daysAgo(40), expiry: daysAgo(-325) },
    { num: 'PAR-000010', custIdx: 9, provIdx: 9, sector: 'Telecom', bm: 'B2B2C', tb: 'Enterprise', rp: 'High', turnover: 22000000, status: 'CANCELLED', effective: daysAgo(70), expiry: daysAgo(60) },
    { num: 'PAR-000011', custIdx: 0, provIdx: 10, sector: 'Technology', bm: 'SaaS', tb: 'Small', rp: 'Medium', turnover: 800000, status: 'CANCELLED', effective: daysAgo(80), expiry: daysAgo(50) },
    { num: 'PAR-000012', custIdx: 1, provIdx: 11, sector: 'Finance', bm: 'B2B', tb: 'Medium', rp: 'High', turnover: 1800000, status: 'EXPIRED', effective: daysAgo(400), expiry: daysAgo(35) },
    { num: 'PAR-000013', custIdx: 2, provIdx: 12, sector: 'Healthcare', bm: 'B2B2C', tb: 'Large', rp: 'Medium', turnover: 5000000, status: 'EXPIRED', effective: daysAgo(380), expiry: daysAgo(15) },
    { num: 'PAR-000014', custIdx: 3, provIdx: 0, sector: 'Retail', bm: 'B2C', tb: 'Micro', rp: 'Low', turnover: 80000, status: 'REJECTED', effective: undefined, expiry: undefined },
    { num: 'PAR-000015', custIdx: 4, provIdx: 1, sector: 'Energy', bm: 'B2B', tb: 'Large', rp: 'High', turnover: 7000000, status: 'REJECTED', effective: undefined, expiry: undefined },
    { num: 'PAR-000016', custIdx: 5, provIdx: 2, sector: 'Education', bm: 'B2B2C', tb: 'Medium', rp: 'Low', turnover: 1200000, status: 'ACTIVE', effective: daysAgo(20), expiry: daysAgo(-345), payoutConfigId: linearConfig.id },
    { num: 'PAR-000017', custIdx: 6, provIdx: 3, sector: 'Logistics', bm: 'Marketplace', tb: 'Small', rp: 'Medium', turnover: 500000, status: 'ACTIVE', effective: daysAgo(25), expiry: daysAgo(-340), payoutConfigId: stepConfig.id },
    { num: 'PAR-000018', custIdx: 7, provIdx: 4, sector: 'Media', bm: 'B2C', tb: 'Medium', rp: 'Medium', turnover: 2000000, status: 'ACTIVE', effective: daysAgo(55), expiry: daysAgo(-310), payoutConfigId: hybridConfig.id },
    { num: 'PAR-000019', custIdx: 8, provIdx: 5, sector: 'Agriculture', bm: 'B2B', tb: 'Micro', rp: 'Low', turnover: 50000, status: 'ACTIVE', effective: daysAgo(35), expiry: daysAgo(-330) },
    { num: 'PAR-000020', custIdx: 9, provIdx: 6, sector: 'Telecom', bm: 'B2B2C', tb: 'Large', rp: 'High', turnover: 9500000, status: 'APPROVED', effective: daysAgo(2), expiry: daysAgo(-363) },
  ];

  const paramPolicyIds: number[] = [];
  for (const pp of paramPoliciesData) {
    const hourlyRev = Math.round(pp.turnover / 8766);
    const basePrem = Math.round(hourlyRev * 1.32);
    const commPrem = Math.round(basePrem * 1.1);
    const provAdjPrem = Math.round(commPrem * 1.15);
    const finalPrem = Math.round(provAdjPrem * 1.0);
    const maxInsured = 72;
    const hourlyPayout = hourlyRev;
    const maxPayout = hourlyPayout * maxInsured;
    const premRate = +(finalPrem / pp.turnover * 1000).toFixed(4);
    const secFactor = +(sectorMap[pp.sector] ? 1.35 : 1.0);
    const bmFactor = +(bmMap[pp.bm] ? 0.80 : 1.0);
    const tbFactor = +(tbMap[pp.tb] ? 1.1 : 1.0);
    const rpFactor = +(rpMap[pp.rp] ? 1.0 : 1.0);

    const record = await prisma.parametricPolicy.upsert({
      where: { policyNumber: pp.num },
      update: {},
      create: {
        policyNumber: pp.num,
        customerId: customerIds[pp.custIdx],
        cloudProviderId: providerIds[pp.provIdx],
        productId: parametricProduct.id,
        sectorId: sectorMap[pp.sector],
        businessModelId: bmMap[pp.bm],
        turnoverBandId: tbMap[pp.tb],
        resilienceProfileId: rpMap[pp.rp],
        annualTurnoverTnd: pp.turnover,
        hourlyRevenue: hourlyRev,
        basePremium: basePrem,
        commercialPremium: commPrem,
        providerAdjustedPremium: provAdjPrem,
        finalPremium: finalPrem,
        premiumRatePct: premRate,
        maxInsuredHours: maxInsured,
        hourlyPayoutRate: hourlyPayout,
        maxPayoutAmount: maxPayout,
        payoutFunctionConfigId: pp.payoutConfigId ?? null,
        sectorFactorAtCreation: secFactor,
        businessModelFactorAtCreation: bmFactor,
        turnoverBandFactorAtCreation: tbFactor,
        resilienceFactorAtCreation: rpFactor,
        providerFactorAtCreation: 1.15,
        loadingFactorAtCreation: 1.32,
        underwritingDecision: ['ACTIVE', 'APPROVED', 'EXPIRED'].includes(pp.status) ? 'ACCEPT' : (pp.status === 'REJECTED' ? 'REJECT' : 'PENDING'),
        underwrittenBy: ['ACTIVE', 'APPROVED', 'EXPIRED'].includes(pp.status) ? admin.id : null,
        underwrittenAt: ['ACTIVE', 'APPROVED', 'EXPIRED'].includes(pp.status) ? daysAgo(30) : null,
        statusId: paramPolicyStatusMap[pp.status],
        effectiveDate: pp.effective,
        expiryDate: pp.expiry,
        createdBy: admin.id,
      },
    });
    paramPolicyIds.push(record.id);
  }
  console.log('  parametric_policies:', paramPoliciesData.length);

  // =======================================================================
  // PHASE 15 — Outage Events (10+)
  // =======================================================================
  console.log('\n--- Phase 15: Outage Events ---');

  const outageEventsData: { provIdx: number; start: Date; end: Date; datasource: string; score: number; severity: string; processed: number }[] = [
    { provIdx: 0, start: daysAgo(2), end: new Date(daysAgo(2).getTime() + 6 * 3600 * 1000), datasource: 'ioda', score: 85.5, severity: 'high', processed: 1 },
    { provIdx: 1, start: daysAgo(5), end: new Date(daysAgo(5).getTime() + 3 * 3600 * 1000), datasource: 'ioda', score: 45.2, severity: 'medium', processed: 1 },
    { provIdx: 2, start: daysAgo(8), end: new Date(daysAgo(8).getTime() + 12 * 3600 * 1000), datasource: 'ioda', score: 92.1, severity: 'critical', processed: 1 },
    { provIdx: 3, start: daysAgo(12), end: new Date(daysAgo(12).getTime() + 2 * 3600 * 1000), datasource: 'ioda', score: 30.5, severity: 'low', processed: 1 },
    { provIdx: 4, start: daysAgo(15), end: new Date(daysAgo(15).getTime() + 8 * 3600 * 1000), datasource: 'ioda', score: 70.0, severity: 'high', processed: 1 },
    { provIdx: 5, start: daysAgo(20), end: new Date(daysAgo(20).getTime() + 4 * 3600 * 1000), datasource: 'ioda', score: 55.3, severity: 'medium', processed: 0 },
    { provIdx: 6, start: daysAgo(25), end: new Date(daysAgo(25).getTime() + 1 * 3600 * 1000), datasource: 'ioda', score: 15.8, severity: 'low', processed: 0 },
    { provIdx: 7, start: daysAgo(30), end: new Date(daysAgo(30).getTime() + 10 * 3600 * 1000), datasource: 'ioda', score: 88.0, severity: 'critical', processed: 1 },
    { provIdx: 8, start: daysAgo(35), end: new Date(daysAgo(35).getTime() + 5 * 3600 * 1000), datasource: 'ioda', score: 60.4, severity: 'medium', processed: 0 },
    { provIdx: 9, start: daysAgo(40), end: new Date(daysAgo(40).getTime() + 7 * 3600 * 1000), datasource: 'ioda', score: 75.9, severity: 'high', processed: 1 },
    { provIdx: 10, start: daysAgo(45), end: new Date(daysAgo(45).getTime() + 20 * 3600 * 1000), datasource: 'ioda', score: 95.0, severity: 'critical', processed: 1 },
    { provIdx: 11, start: daysAgo(50), end: new Date(daysAgo(50).getTime() + 3 * 3600 * 1000), datasource: 'ioda', score: 40.1, severity: 'medium', processed: 0 },
  ];

  const outageEventIds: number[] = [];
  for (let i = 0; i < outageEventsData.length; i++) {
    const oe = outageEventsData[i];
    const durationSec = Math.round((oe.end.getTime() - oe.start.getTime()) / 1000);
    const durationHrs = +(durationSec / 3600).toFixed(4);
    const record = await prisma.outageEvent.create({
      data: {
        cloudProviderId: providerIds[oe.provIdx],
        iodaEventId: `IODA-EVT-${String(i + 1).padStart(6, '0')}`,
        eventStart: oe.start,
        eventEnd: oe.end,
        durationSeconds: durationSec,
        durationHours: durationHrs,
        datasource: oe.datasource,
        score: oe.score,
        severity: oe.severity,
        processed: oe.processed,
        processedAt: oe.processed ? new Date(oe.start.getTime() + 60000) : null,
        processingBatchId: oe.processed ? `BATCH-${daysAgo(0).toISOString().slice(0, 10)}` : null,
      },
    });
    outageEventIds.push(record.id);
  }
  console.log('  outage_events:', outageEventsData.length);

  // =======================================================================
  // PHASE 16 — Merged Incidents (5+)
  // =======================================================================
  console.log('\n--- Phase 16: Merged Incidents ---');

  const mergedIncidentsData: { provIdx: number; start: Date; end: Date; nRaw: number; maxScore: number; avgScore: number; triggerChecked: number; eventIndices: number[] }[] = [
    { provIdx: 0, start: daysAgo(2), end: new Date(daysAgo(2).getTime() + 7 * 3600 * 1000), nRaw: 2, maxScore: 85.5, avgScore: 65.0, triggerChecked: 1, eventIndices: [0] },
    { provIdx: 2, start: daysAgo(8), end: new Date(daysAgo(8).getTime() + 14 * 3600 * 1000), nRaw: 3, maxScore: 92.1, avgScore: 78.5, triggerChecked: 1, eventIndices: [2] },
    { provIdx: 4, start: daysAgo(15), end: new Date(daysAgo(15).getTime() + 9 * 3600 * 1000), nRaw: 2, maxScore: 70.0, avgScore: 58.0, triggerChecked: 1, eventIndices: [4] },
    { provIdx: 7, start: daysAgo(30), end: new Date(daysAgo(30).getTime() + 11 * 3600 * 1000), nRaw: 2, maxScore: 88.0, avgScore: 72.0, triggerChecked: 0, eventIndices: [7] },
    { provIdx: 10, start: daysAgo(45), end: new Date(daysAgo(45).getTime() + 22 * 3600 * 1000), nRaw: 4, maxScore: 95.0, avgScore: 82.0, triggerChecked: 0, eventIndices: [10] },
    { provIdx: 9, start: daysAgo(40), end: new Date(daysAgo(40).getTime() + 8 * 3600 * 1000), nRaw: 1, maxScore: 75.9, avgScore: 75.9, triggerChecked: 1, eventIndices: [9] },
  ];

  const mergedIncidentIds: number[] = [];
  for (const mi of mergedIncidentsData) {
    const durSec = Math.round((mi.end.getTime() - mi.start.getTime()) / 1000);
    const durHrs = +(durSec / 3600).toFixed(4);
    const record = await prisma.mergedIncident.create({
      data: {
        cloudProviderId: providerIds[mi.provIdx],
        incidentStart: mi.start,
        incidentEnd: mi.end,
        durationSeconds: durSec,
        durationHours: durHrs,
        nRawEvents: mi.nRaw,
        maxScore: mi.maxScore,
        avgScore: mi.avgScore,
        isTriggerChecked: mi.triggerChecked,
        triggerCheckedAt: mi.triggerChecked ? new Date(mi.start.getTime() + 300000) : null,
      },
    });
    mergedIncidentIds.push(record.id);

    // Create IncidentEventLinks
    for (const evtIdx of mi.eventIndices) {
      if (evtIdx < outageEventIds.length) {
        await prisma.incidentEventLink.create({
          data: {
            incidentId: record.id,
            eventId: outageEventIds[evtIdx],
          },
        }).catch(() => { /* link may already exist */ });
      }
    }
  }
  console.log('  merged_incidents:', mergedIncidentsData.length);

  // =======================================================================
  // PHASE 17 — Trigger Events (3+)
  // =======================================================================
  console.log('\n--- Phase 17: Trigger Events ---');

  const triggerEventsData: { provIdx: number; incidentIdx: number; insuredHrs: number; thresholdHrs: number; claimCreated: number; adminReviewed: number; affectedPolicies: number; estPayout: number }[] = [
    { provIdx: 0, incidentIdx: 0, insuredHrs: 7, thresholdHrs: 4, claimCreated: 1, adminReviewed: 1, affectedPolicies: 2, estPayout: 150000 },
    { provIdx: 2, incidentIdx: 1, insuredHrs: 14, thresholdHrs: 4, claimCreated: 1, adminReviewed: 1, affectedPolicies: 1, estPayout: 280000 },
    { provIdx: 4, incidentIdx: 2, insuredHrs: 9, thresholdHrs: 8, claimCreated: 1, adminReviewed: 0, affectedPolicies: 3, estPayout: 350000 },
    { provIdx: 9, incidentIdx: 5, insuredHrs: 8, thresholdHrs: 8, claimCreated: 0, adminReviewed: 0, affectedPolicies: 0, estPayout: 0 },
  ];

  const triggerEventIds: number[] = [];
  for (const te of triggerEventsData) {
    const provider = providerList[te.provIdx];
    const record = await prisma.triggerEvent.create({
      data: {
        cloudProviderId: providerIds[te.provIdx],
        mergedIncidentId: mergedIncidentIds[te.incidentIdx],
        slaTierId: provider.slaTierId,
        insuredHours: te.insuredHrs,
        thresholdHours: te.thresholdHrs,
        affectedPoliciesCount: te.affectedPolicies,
        totalEstimatedPayout: te.estPayout,
        claimCreated: te.claimCreated,
        claimsCreatedAt: te.claimCreated ? daysAgo(1) : null,
        adminReviewed: te.adminReviewed,
        adminReviewedAt: te.adminReviewed ? daysAgo(1) : null,
        adminReviewedBy: te.adminReviewed ? admin.id : null,
        adminNotes: te.adminReviewed ? 'Reviewed and confirmed trigger event' : null,
      },
    });
    triggerEventIds.push(record.id);
  }
  console.log('  trigger_events:', triggerEventsData.length);

  // =======================================================================
  // PHASE 18 — Parametric Claims (15+, across ALL statuses)
  // =======================================================================
  console.log('\n--- Phase 18: Parametric Claims ---');

  const paramClaimsData: { num: string; policyIdx: number; triggerIdx: number | null; durationHrs: number; status: string; autoApproved: number; reviewedBy: number | null; paidBy: number | null }[] = [
    { num: 'PCL-000001', policyIdx: 4, triggerIdx: 0, durationHrs: 7, status: 'DETECTED', autoApproved: 0, reviewedBy: null, paidBy: null },
    { num: 'PCL-000002', policyIdx: 5, triggerIdx: 1, durationHrs: 14, status: 'DETECTED', autoApproved: 0, reviewedBy: null, paidBy: null },
    { num: 'PCL-000003', policyIdx: 6, triggerIdx: 2, durationHrs: 9, status: 'VALIDATED', autoApproved: 0, reviewedBy: null, paidBy: null },
    { num: 'PCL-000004', policyIdx: 4, triggerIdx: null, durationHrs: 5, status: 'VALIDATED', autoApproved: 0, reviewedBy: null, paidBy: null },
    { num: 'PCL-000005', policyIdx: 5, triggerIdx: null, durationHrs: 8, status: 'APPROVED', autoApproved: 1, reviewedBy: admin.id, paidBy: null },
    { num: 'PCL-000006', policyIdx: 6, triggerIdx: null, durationHrs: 3, status: 'APPROVED', autoApproved: 1, reviewedBy: admin.id, paidBy: null },
    { num: 'PCL-000007', policyIdx: 4, triggerIdx: null, durationHrs: 6, status: 'PAID', autoApproved: 1, reviewedBy: admin.id, paidBy: admin.id },
    { num: 'PCL-000008', policyIdx: 5, triggerIdx: null, durationHrs: 10, status: 'PAID', autoApproved: 0, reviewedBy: admin.id, paidBy: admin.id },
    { num: 'PCL-000009', policyIdx: 6, triggerIdx: null, durationHrs: 2, status: 'DISPUTED', autoApproved: 0, reviewedBy: admin.id, paidBy: null },
    { num: 'PCL-000010', policyIdx: 4, triggerIdx: null, durationHrs: 4, status: 'DISPUTED', autoApproved: 0, reviewedBy: admin.id, paidBy: null },
    { num: 'PCL-000011', policyIdx: 5, triggerIdx: null, durationHrs: 1, status: 'REJECTED', autoApproved: 0, reviewedBy: admin.id, paidBy: null },
    { num: 'PCL-000012', policyIdx: 6, triggerIdx: null, durationHrs: 0.5, status: 'REJECTED', autoApproved: 0, reviewedBy: admin.id, paidBy: null },
    { num: 'PCL-000013', policyIdx: 4, triggerIdx: null, durationHrs: 8, status: 'APPROVED', autoApproved: 1, reviewedBy: admin.id, paidBy: null },
    { num: 'PCL-000014', policyIdx: 5, triggerIdx: null, durationHrs: 12, status: 'PAID', autoApproved: 1, reviewedBy: admin.id, paidBy: admin.id },
    { num: 'PCL-000015', policyIdx: 6, triggerIdx: null, durationHrs: 6, status: 'VALIDATED', autoApproved: 0, reviewedBy: null, paidBy: null },
  ];

  const paramClaimIds: number[] = [];
  for (const pc of paramClaimsData) {
    const policy = paramPoliciesData[pc.policyIdx];
    const hourlyPayout = Math.round(policy.turnover / 8766);
    const payoutAmt = Math.round(hourlyPayout * pc.durationHrs);
    const record = await prisma.parametricClaim.upsert({
      where: { claimNumber: pc.num },
      update: {},
      create: {
        claimNumber: pc.num,
        customerId: customerIds[policy.custIdx],
        policyId: paramPolicyIds[pc.policyIdx],
        triggerEventId: pc.triggerIdx !== null ? triggerEventIds[pc.triggerIdx] : null,
        outageDurationHours: pc.durationHrs,
        hourlyPayoutRate: hourlyPayout,
        payoutAmount: payoutAmt,
        payoutCalculationJson: JSON.stringify({ durationHours: pc.durationHrs, hourlyRate: hourlyPayout, payoutAmount: payoutAmt, formula: 'duration * hourlyRate' }),
        statusId: paramClaimStatusMap[pc.status],
        autoApproved: pc.autoApproved,
        autoApprovedAt: pc.autoApproved ? daysAgo(2) : null,
        autoApprovalThreshold: 250000,
        reviewedBy: pc.reviewedBy,
        reviewedAt: pc.reviewedBy ? daysAgo(1) : null,
        reviewNotes: pc.reviewedBy ? 'Reviewed by underwriting team' : null,
        paidBy: pc.paidBy,
        paidAt: pc.paidBy ? daysAgo(0) : null,
        payoutTransactionId: pc.paidBy ? `TXN-${pc.num}` : null,
        payoutMethod: pc.paidBy ? 'BANK_TRANSFER' : null,
        initialReserve: payoutAmt,
        currentReserve: payoutAmt,
        createdBy: admin.id,
      },
    });
    paramClaimIds.push(record.id);
  }
  console.log('  parametric_claims:', paramClaimsData.length);

  // =======================================================================
  // PHASE 19 — Cyber Applications (15+, across ALL statuses)
  // =======================================================================
  console.log('\n--- Phase 19: Cyber Applications ---');

  const cyberAppsData: { num: string; custIdx: number; posture: string; riskScore: number; premium: number; status: string; secAnswers: object }[] = [
    { num: 'CYB-000001', custIdx: 0, posture: 'EXCELLENT', riskScore: 15, premium: 8500, status: 'DRAFT', secAnswers: { mfa_enabled: true, edr_deployed: true, immutable_backups: true, patch_cadence: 'Weekly', network_segmentation: true } },
    { num: 'CYB-000002', custIdx: 1, posture: 'GOOD', riskScore: 25, premium: 18000, status: 'DRAFT', secAnswers: { mfa_enabled: true, edr_deployed: true, immutable_backups: false, patch_cadence: 'Monthly', network_segmentation: true } },
    { num: 'CYB-000003', custIdx: 2, posture: 'FAIR', riskScore: 45, premium: 12000, status: 'SUBMITTED', secAnswers: { mfa_enabled: true, edr_deployed: false, immutable_backups: true, patch_cadence: 'Monthly', network_segmentation: false } },
    { num: 'CYB-000004', custIdx: 3, posture: 'POOR', riskScore: 65, premium: 6500, status: 'SUBMITTED', secAnswers: { mfa_enabled: false, edr_deployed: false, immutable_backups: false, patch_cadence: 'Ad-hoc', network_segmentation: false } },
    { num: 'CYB-000005', custIdx: 4, posture: 'EXCELLENT', riskScore: 12, premium: 35000, status: 'SUBMITTED', secAnswers: { mfa_enabled: true, edr_deployed: true, immutable_backups: true, patch_cadence: 'Daily', network_segmentation: true } },
    { num: 'CYB-000006', custIdx: 5, posture: 'FAIR', riskScore: 40, premium: 4500, status: 'UNDER_REVIEW', secAnswers: { mfa_enabled: true, edr_deployed: false, immutable_backups: false, patch_cadence: 'Monthly', network_segmentation: true } },
    { num: 'CYB-000007', custIdx: 6, posture: 'POOR', riskScore: 70, premium: 15000, status: 'UNDER_REVIEW', secAnswers: { mfa_enabled: false, edr_deployed: false, immutable_backups: false, patch_cadence: 'Ad-hoc', network_segmentation: false } },
    { num: 'CYB-000008', custIdx: 7, posture: 'GOOD', riskScore: 30, premium: 9000, status: 'UNDER_REVIEW', secAnswers: { mfa_enabled: true, edr_deployed: true, immutable_backups: true, patch_cadence: 'Weekly', network_segmentation: true } },
    { num: 'CYB-000009', custIdx: 8, posture: 'GOOD', riskScore: 28, premium: 5500, status: 'APPROVED', secAnswers: { mfa_enabled: true, edr_deployed: true, immutable_backups: true, patch_cadence: 'Weekly', network_segmentation: true } },
    { num: 'CYB-000010', custIdx: 9, posture: 'EXCELLENT', riskScore: 10, premium: 42000, status: 'APPROVED', secAnswers: { mfa_enabled: true, edr_deployed: true, immutable_backups: true, patch_cadence: 'Daily', network_segmentation: true } },
    { num: 'CYB-000011', custIdx: 0, posture: 'POOR', riskScore: 75, premium: 12000, status: 'REJECTED', secAnswers: { mfa_enabled: false, edr_deployed: false, immutable_backups: false, patch_cadence: 'Ad-hoc', network_segmentation: false } },
    { num: 'CYB-000012', custIdx: 1, posture: 'UNKNOWN', riskScore: 85, premium: 22000, status: 'REJECTED', secAnswers: { mfa_enabled: false, edr_deployed: false, immutable_backups: false, patch_cadence: 'Ad-hoc', network_segmentation: false } },
    { num: 'CYB-000013', custIdx: 2, posture: 'FAIR', riskScore: 42, premium: 11000, status: 'SUBMITTED', secAnswers: { mfa_enabled: true, edr_deployed: false, immutable_backups: true, patch_cadence: 'Monthly', network_segmentation: false } },
    { num: 'CYB-000014', custIdx: 3, posture: 'GOOD', riskScore: 32, premium: 7000, status: 'UNDER_REVIEW', secAnswers: { mfa_enabled: true, edr_deployed: true, immutable_backups: true, patch_cadence: 'Weekly', network_segmentation: true } },
    { num: 'CYB-000015', custIdx: 4, posture: 'GOOD', riskScore: 22, premium: 28000, status: 'SUBMITTED', secAnswers: { mfa_enabled: true, edr_deployed: true, immutable_backups: true, patch_cadence: 'Weekly', network_segmentation: true } },
  ];

  const cyberAppIds: number[] = [];
  for (const ca of cyberAppsData) {
    const record = await prisma.cyberApplication.upsert({
      where: { applicationNumber: ca.num },
      update: {},
      create: {
        applicationNumber: ca.num,
        customerId: customerIds[ca.custIdx],
        productId: cyberProduct.id,
        answersJson: JSON.stringify(ca.secAnswers),
        riskScore: ca.riskScore,
        securityPostureId: secPostureMap[ca.posture],
        calculatedPremium: ca.premium,
        selectedCoveragesJson: JSON.stringify(['BI', 'DR', 'CE', 'SR', 'CM', 'PL', 'RD']),
        statusId: cyberAppStatusMap[ca.status],
        submittedAt: ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'].includes(ca.status) ? daysAgo(20) : null,
        underReviewAt: ['UNDER_REVIEW', 'APPROVED', 'REJECTED'].includes(ca.status) ? daysAgo(15) : null,
        underReviewBy: ['UNDER_REVIEW', 'APPROVED', 'REJECTED'].includes(ca.status) ? admin.id : null,
        decisionAt: ['APPROVED', 'REJECTED'].includes(ca.status) ? daysAgo(10) : null,
        decisionBy: ['APPROVED', 'REJECTED'].includes(ca.status) ? admin.id : null,
        decisionNotes: ca.status === 'REJECTED' ? 'Security posture does not meet minimum requirements' : (ca.status === 'APPROVED' ? 'Application meets underwriting criteria' : null),
        createdBy: admin.id,
      },
    });
    cyberAppIds.push(record.id);
  }
  console.log('  cyber_applications:', cyberAppsData.length);

  // =======================================================================
  // PHASE 20 — Cyber Policies (10+, across ALL statuses)
  // =======================================================================
  console.log('\n--- Phase 20: Cyber Policies ---');

  // Create additional cyber applications for policies that need unique app IDs
  const extraCyberAppsData = [
    { num: 'CYB-EX-000003', custIdx: 0, posture: 'GOOD', riskScore: 25, premium: 8500, status: 'APPROVED', secAnswers: { mfa_enabled: true, edr_deployed: true, immutable_backups: true, patch_cadence: 'Weekly', network_segmentation: true } },
    { num: 'CYB-EX-000004', custIdx: 1, posture: 'GOOD', riskScore: 20, premium: 18000, status: 'APPROVED', secAnswers: { mfa_enabled: true, edr_deployed: true, immutable_backups: true, patch_cadence: 'Weekly', network_segmentation: true } },
    { num: 'CYB-EX-000005', custIdx: 2, posture: 'FAIR', riskScore: 40, premium: 12000, status: 'APPROVED', secAnswers: { mfa_enabled: true, edr_deployed: false, immutable_backups: false, patch_cadence: 'Monthly', network_segmentation: true } },
    { num: 'CYB-EX-000006', custIdx: 3, posture: 'POOR', riskScore: 60, premium: 6500, status: 'REJECTED', secAnswers: { mfa_enabled: false, edr_deployed: false, immutable_backups: false, patch_cadence: 'Ad-hoc', network_segmentation: false } },
    { num: 'CYB-EX-000007', custIdx: 4, posture: 'EXCELLENT', riskScore: 10, premium: 35000, status: 'APPROVED', secAnswers: { mfa_enabled: true, edr_deployed: true, immutable_backups: true, patch_cadence: 'Daily', network_segmentation: true } },
    { num: 'CYB-EX-000008', custIdx: 5, posture: 'FAIR', riskScore: 45, premium: 4500, status: 'APPROVED', secAnswers: { mfa_enabled: true, edr_deployed: false, immutable_backups: true, patch_cadence: 'Monthly', network_segmentation: false } },
    { num: 'CYB-EX-000009', custIdx: 6, posture: 'POOR', riskScore: 70, premium: 15000, status: 'REJECTED', secAnswers: { mfa_enabled: false, edr_deployed: false, immutable_backups: false, patch_cadence: 'Ad-hoc', network_segmentation: false } },
    { num: 'CYB-EX-000010', custIdx: 7, posture: 'GOOD', riskScore: 28, premium: 9000, status: 'APPROVED', secAnswers: { mfa_enabled: true, edr_deployed: true, immutable_backups: true, patch_cadence: 'Weekly', network_segmentation: true } },
    { num: 'CYB-EX-000011', custIdx: 8, posture: 'GOOD', riskScore: 30, premium: 5500, status: 'APPROVED', secAnswers: { mfa_enabled: true, edr_deployed: true, immutable_backups: true, patch_cadence: 'Weekly', network_segmentation: true } },
    { num: 'CYB-EX-000012', custIdx: 9, posture: 'EXCELLENT', riskScore: 8, premium: 42000, status: 'APPROVED', secAnswers: { mfa_enabled: true, edr_deployed: true, immutable_backups: true, patch_cadence: 'Daily', network_segmentation: true } },
    { num: 'CYB-EX-000013', custIdx: 0, posture: 'GOOD', riskScore: 22, premium: 8500, status: 'APPROVED', secAnswers: { mfa_enabled: true, edr_deployed: true, immutable_backups: true, patch_cadence: 'Weekly', network_segmentation: true } },
    { num: 'CYB-EX-000014', custIdx: 1, posture: 'GOOD', riskScore: 18, premium: 18000, status: 'APPROVED', secAnswers: { mfa_enabled: true, edr_deployed: true, immutable_backups: true, patch_cadence: 'Weekly', network_segmentation: true } },
  ];

  const extraCyberAppIds: number[] = [];
  for (const ca of extraCyberAppsData) {
    const record = await prisma.cyberApplication.upsert({
      where: { applicationNumber: ca.num },
      update: {},
      create: {
        applicationNumber: ca.num,
        customerId: customerIds[ca.custIdx],
        productId: cyberProduct.id,
        answersJson: JSON.stringify(ca.secAnswers),
        riskScore: ca.riskScore,
        securityPostureId: secPostureMap[ca.posture],
        calculatedPremium: ca.premium,
        selectedCoveragesJson: JSON.stringify(['BI', 'DR', 'CE', 'SR', 'CM', 'PL', 'RD']),
        statusId: cyberAppStatusMap[ca.status],
        submittedAt: daysAgo(30),
        underReviewAt: daysAgo(25),
        underReviewBy: admin.id,
        decisionAt: daysAgo(20),
        decisionBy: admin.id,
        decisionNotes: ca.status === 'APPROVED' ? 'Application meets underwriting criteria' : 'Application rejected',
        createdBy: admin.id,
      },
    });
    extraCyberAppIds.push(record.id);
  }

  const cyberPoliciesData: { num: string; extraAppIdx: number; custIdx: number; limit: number; premium: number; status: string; effective: Date; expiry: Date; coverages: string[] }[] = [
    { num: 'CYP-000001', extraAppIdx: 0, custIdx: 0, limit: 2000000, premium: 8500, status: 'PENDING', effective: daysAgo(1), expiry: daysAgo(-364), coverages: ['BI', 'DR', 'CE', 'SR'] },
    { num: 'CYP-000002', extraAppIdx: 1, custIdx: 1, limit: 4000000, premium: 18000, status: 'PENDING', effective: daysAgo(0), expiry: daysAgo(-365), coverages: ['BI', 'DR', 'CE', 'SR', 'CM', 'PL', 'RD'] },
    { num: 'CYP-000003', extraAppIdx: 2, custIdx: 2, limit: 3000000, premium: 12000, status: 'ACTIVE', effective: daysAgo(60), expiry: daysAgo(-305), coverages: ['BI', 'DR', 'CE', 'SR', 'CM', 'PL'] },
    { num: 'CYP-000004', extraAppIdx: 3, custIdx: 3, limit: 1500000, premium: 6500, status: 'ACTIVE', effective: daysAgo(45), expiry: daysAgo(-320), coverages: ['BI', 'DR', 'CE'] },
    { num: 'CYP-000005', extraAppIdx: 4, custIdx: 4, limit: 5000000, premium: 35000, status: 'ACTIVE', effective: daysAgo(30), expiry: daysAgo(-335), coverages: ['BI', 'DR', 'CE', 'SR'] },
    { num: 'CYP-000006', extraAppIdx: 5, custIdx: 5, limit: 1000000, premium: 4500, status: 'LAPSED', effective: daysAgo(120), expiry: daysAgo(60), coverages: ['BI', 'DR', 'CE'] },
    { num: 'CYP-000007', extraAppIdx: 6, custIdx: 6, limit: 2000000, premium: 15000, status: 'LAPSED', effective: daysAgo(100), expiry: daysAgo(45), coverages: ['BI', 'DR', 'CE', 'SR', 'CM', 'PL', 'RD'] },
    { num: 'CYP-000008', extraAppIdx: 7, custIdx: 7, limit: 3000000, premium: 9000, status: 'CANCELLED', effective: daysAgo(90), expiry: daysAgo(30), coverages: ['BI', 'DR'] },
    { num: 'CYP-000009', extraAppIdx: 8, custIdx: 8, limit: 2000000, premium: 5500, status: 'CANCELLED', effective: daysAgo(80), expiry: daysAgo(20), coverages: ['BI', 'DR', 'CE', 'SR'] },
    { num: 'CYP-000010', extraAppIdx: 9, custIdx: 9, limit: 5000000, premium: 42000, status: 'EXPIRED', effective: daysAgo(400), expiry: daysAgo(35), coverages: ['BI', 'DR', 'CE', 'SR', 'CM'] },
    { num: 'CYP-000011', extraAppIdx: 10, custIdx: 0, limit: 2000000, premium: 8500, status: 'EXPIRED', effective: daysAgo(380), expiry: daysAgo(15), coverages: ['BI', 'DR', 'CE'] },
    { num: 'CYP-000012', extraAppIdx: 11, custIdx: 1, limit: 5000000, premium: 18000, status: 'ACTIVE', effective: daysAgo(15), expiry: daysAgo(-350), coverages: ['BI', 'DR', 'CE', 'SR', 'CM', 'PL', 'RD', 'ML'] },
  ];

  const cyberPolicyIds: number[] = [];
  for (const cp of cyberPoliciesData) {
    const record = await prisma.cyberPolicy.upsert({
      where: { policyNumber: cp.num },
      update: {},
      create: {
        policyNumber: cp.num,
        applicationId: extraCyberAppIds[cp.extraAppIdx],
        customerId: customerIds[cp.custIdx],
        productId: cyberProduct.id,
        policyLimit: cp.limit,
        deductibleSir: 5000,
        premium: cp.premium,
        selectedCoveragesJson: JSON.stringify(cp.coverages),
        endorsementsJson: JSON.stringify(['INITIAL_POLICY']),
        exclusionsJson: JSON.stringify(['WAR_AND_STATE_SPONSORED', 'INFRASTRUCTURE_FAILURE']),
        statusId: cyberPolicyStatusMap[cp.status],
        effectiveDate: cp.effective,
        expiryDate: cp.expiry,
        createdBy: admin.id,
      },
    });
    cyberPolicyIds.push(record.id);
  }
  console.log('  cyber_policies:', cyberPoliciesData.length);

  // =======================================================================
  // PHASE 21 — Cyber Claims (10+, across ALL statuses)
  // =======================================================================
  console.log('\n--- Phase 21: Cyber Claims ---');

  const cyberClaimsData: { num: string; policyIdx: number; custIdx: number; incidentType: string; estLoss: number; status: string; adjustedAmt: number | null; approvedAmt: number | null; paidAmt: number | null }[] = [
    { num: 'CCL-000001', policyIdx: 2, custIdx: 0, incidentType: 'BI', estLoss: 120000, status: 'REPORTED', adjustedAmt: null, approvedAmt: null, paidAmt: null },
    { num: 'CCL-000002', policyIdx: 3, custIdx: 1, incidentType: 'DR', estLoss: 85000, status: 'REPORTED', adjustedAmt: null, approvedAmt: null, paidAmt: null },
    { num: 'CCL-000003', policyIdx: 4, custIdx: 2, incidentType: 'CE', estLoss: 250000, status: 'UNDER_INVESTIGATION', adjustedAmt: null, approvedAmt: null, paidAmt: null },
    { num: 'CCL-000004', policyIdx: 2, custIdx: 0, incidentType: 'SR', estLoss: 95000, status: 'UNDER_INVESTIGATION', adjustedAmt: null, approvedAmt: null, paidAmt: null },
    { num: 'CCL-000005', policyIdx: 3, custIdx: 1, incidentType: 'PL', estLoss: 180000, status: 'ADJUSTED', adjustedAmt: 165000, approvedAmt: null, paidAmt: null },
    { num: 'CCL-000006', policyIdx: 4, custIdx: 2, incidentType: 'CM', estLoss: 45000, status: 'ADJUSTED', adjustedAmt: 42000, approvedAmt: null, paidAmt: null },
    { num: 'CCL-000007', policyIdx: 2, custIdx: 0, incidentType: 'BI', estLoss: 300000, status: 'APPROVED', adjustedAmt: 280000, approvedAmt: 280000, paidAmt: null },
    { num: 'CCL-000008', policyIdx: 3, custIdx: 1, incidentType: 'DR', estLoss: 150000, status: 'APPROVED', adjustedAmt: 140000, approvedAmt: 140000, paidAmt: null },
    { num: 'CCL-000009', policyIdx: 4, custIdx: 2, incidentType: 'CE', estLoss: 500000, status: 'PAID', adjustedAmt: 450000, approvedAmt: 450000, paidAmt: 450000 },
    { num: 'CCL-000010', policyIdx: 2, custIdx: 0, incidentType: 'SR', estLoss: 60000, status: 'PAID', adjustedAmt: 55000, approvedAmt: 55000, paidAmt: 55000 },
    { num: 'CCL-000011', policyIdx: 3, custIdx: 1, incidentType: 'RD', estLoss: 200000, status: 'DENIED', adjustedAmt: null, approvedAmt: null, paidAmt: null },
    { num: 'CCL-000012', policyIdx: 4, custIdx: 2, incidentType: 'ML', estLoss: 75000, status: 'DENIED', adjustedAmt: null, approvedAmt: null, paidAmt: null },
  ];

  const cyberClaimIds: number[] = [];
  for (const cc of cyberClaimsData) {
    const record = await prisma.cyberClaim.upsert({
      where: { claimNumber: cc.num },
      update: {},
      create: {
        claimNumber: cc.num,
        policyId: cyberPolicyIds[cc.policyIdx],
        customerId: customerIds[cc.custIdx],
        incidentDate: daysAgo(Math.floor(Math.random() * 30) + 5),
        incidentDiscoveredDate: daysAgo(Math.floor(Math.random() * 10) + 2),
        incidentTypeId: incidentTypeMap[cc.incidentType],
        incidentDescription: `Cyber incident of type ${cc.incidentType} affecting operations`,
        estimatedLoss: cc.estLoss,
        assignedInvestigator: ['UNDER_INVESTIGATION', 'ADJUSTED', 'APPROVED', 'PAID'].includes(cc.status) ? admin.id : null,
        investigationStartedAt: ['UNDER_INVESTIGATION', 'ADJUSTED', 'APPROVED', 'PAID'].includes(cc.status) ? daysAgo(15) : null,
        investigationNotes: ['UNDER_INVESTIGATION', 'ADJUSTED', 'APPROVED', 'PAID'].includes(cc.status) ? 'Investigation ongoing' : null,
        adjustedAmount: cc.adjustedAmt,
        adjustedAt: cc.adjustedAmt ? daysAgo(7) : null,
        adjustedBy: cc.adjustedAmt ? admin.id : null,
        adjustmentReason: cc.adjustedAmt ? 'Adjusted based on investigation findings' : null,
        approvedAmount: cc.approvedAmt,
        approvedAt: cc.approvedAmt ? daysAgo(5) : null,
        approvedBy: cc.approvedAmt ? admin.id : null,
        approvalNotes: cc.approvedAmt ? 'Approved for payment' : null,
        paidAmount: cc.paidAmt,
        paidAt: cc.paidAmt ? daysAgo(2) : null,
        paidBy: cc.paidAmt ? admin.id : null,
        payoutTransactionId: cc.paidAmt ? `TXN-${cc.num}` : null,
        payoutMethod: cc.paidAmt ? 'BANK_TRANSFER' : null,
        statusId: cyberClaimStatusMap[cc.status],
        initialReserve: cc.estLoss,
        currentReserve: cc.adjustedAmt ?? cc.estLoss,
        createdBy: admin.id,
      },
    });
    cyberClaimIds.push(record.id);
  }
  console.log('  cyber_claims:', cyberClaimsData.length);


  // =======================================================================
  // PHASE 22 — Claim Reserves (both parametric and cyber)
  // =======================================================================
  console.log('\n--- Phase 22: Claim Reserves ---');

  const paramReservesData = [
    { claimIdx: 0, type: 'IBNR', amount: 50000, reason: 'Initial IBNR reserve' },
    { claimIdx: 4, type: 'OUTSTANDING', amount: 120000, reason: 'Outstanding claim reserve' },
    { claimIdx: 6, type: 'FINAL', amount: 95000, reason: 'Final reserve adjustment' },
  ];
  for (const pr of paramReservesData) {
    await prisma.parametricClaimReserve.create({
      data: {
        parametricClaimId: paramClaimIds[pr.claimIdx],
        reserveType: pr.type,
        reserveAmount: pr.amount,
        reserveCurrency: 'TND',
        adjustmentReason: pr.reason,
        actuarialMethod: 'CHAIN_LADDER',
        confidenceLevel: 0.95,
        createdBy: admin.id,
      },
    }).catch(() => {});
  }

  const cyberReservesData = [
    { claimIdx: 4, type: 'IBNR', amount: 80000, reason: 'Initial IBNR reserve for cyber claim' },
    { claimIdx: 6, type: 'OUTSTANDING', amount: 150000, reason: 'Outstanding cyber claim reserve' },
    { claimIdx: 8, type: 'FINAL', amount: 450000, reason: 'Final reserve for paid claim' },
  ];
  for (const cr of cyberReservesData) {
    await prisma.cyberClaimReserve.create({
      data: {
        cyberClaimId: cyberClaimIds[cr.claimIdx],
        reserveType: cr.type,
        reserveAmount: cr.amount,
        reserveCurrency: 'TND',
        adjustmentReason: cr.reason,
        actuarialMethod: 'BORNHUETTER_FERGUSON',
        confidenceLevel: 0.90,
        createdBy: admin.id,
      },
    }).catch(() => {});
  }
  console.log('  parametric_claim_reserves: 3, cyber_claim_reserves: 3');

  // =======================================================================
  // PHASE 23 — Reinsurance Treaties (3+)
  // =======================================================================
  console.log('\n--- Phase 23: Reinsurance Treaties ---');

  const treaty1 = await prisma.reinsuranceTreaty.upsert({
    where: { treatyNumber: 'TRE-2025-QS-001' },
    update: {},
    create: {
      treatyNumber: 'TRE-2025-QS-001',
      treatyName: 'Quota Share Treaty 2025',
      reinsurerName: 'Munich Re Tunisia Branch',
      reinsurerContact: 'Ahmed Muller',
      reinsurerEmail: 'ahmed.muller@munichre.tn',
      reinsurerPhone: '+216-71-000-001',
      treatyType: 'QUOTA_SHARE',
      treatyStartDate: new Date('2025-01-01'),
      treatyEndDate: new Date('2025-12-31'),
      cessionPct: 0.40,
      retentionAmount: 2000000,
      limitAmount: 5000000,
      reinsurancePremiumPct: 0.35,
      profitCommissionPct: 0.10,
      noClaimBonusPct: 0.05,
      status: 'ACTIVE',
      createdBy: admin.id,
    },
  });
  const treaty2 = await prisma.reinsuranceTreaty.upsert({
    where: { treatyNumber: 'TRE-2025-XOL-001' },
    update: {},
    create: {
      treatyNumber: 'TRE-2025-XOL-001',
      treatyName: 'Excess of Loss Treaty 2025',
      reinsurerName: 'Swiss Re North Africa',
      reinsurerContact: 'Claude Berber',
      reinsurerEmail: 'claude.berber@swissre.tn',
      reinsurerPhone: '+216-71-000-002',
      treatyType: 'EXCESS_OF_LOSS',
      treatyStartDate: new Date('2025-01-01'),
      treatyEndDate: new Date('2025-12-31'),
      attachmentPoint: 1000000,
      limitAmount: 4000000,
      reinsurancePremiumPct: 0.25,
      profitCommissionPct: 0.08,
      noClaimBonusPct: 0.03,
      status: 'ACTIVE',
      createdBy: admin.id,
    },
  });
  const treaty3 = await prisma.reinsuranceTreaty.upsert({
    where: { treatyNumber: 'TRE-2025-SS-001' },
    update: {},
    create: {
      treatyNumber: 'TRE-2025-SS-001',
      treatyName: 'Surplus Share Treaty 2025',
      reinsurerName: 'SCOR Tunisia',
      reinsurerContact: 'Mohamed Garni',
      reinsurerEmail: 'mohamed.garni@scor.tn',
      reinsurerPhone: '+216-71-000-003',
      treatyType: 'SURPLUS_SHARE',
      treatyStartDate: new Date('2025-01-01'),
      treatyEndDate: new Date('2025-12-31'),
      cessionPct: 0.30,
      retentionAmount: 1500000,
      limitAmount: 3000000,
      reinsurancePremiumPct: 0.28,
      profitCommissionPct: 0.12,
      noClaimBonusPct: 0.04,
      status: 'ACTIVE',
      createdBy: admin.id,
    },
  });
  console.log('  reinsurance_treaties: 3');

  // =======================================================================
  // PHASE 24 — Reinsurance Ceded (both parametric and cyber)
  // =======================================================================
  console.log('\n--- Phase 24: Reinsurance Ceded ---');

  await prisma.parametricReinsuranceCeded.upsert({
    where: { treatyId_parametricPolicyId: { treatyId: treaty1.id, parametricPolicyId: paramPolicyIds[4] } },
    update: {},
    create: {
      treatyId: treaty1.id,
      parametricPolicyId: paramPolicyIds[4],
      grossPremium: 2800000,
      cededPremium: 1120000,
      netPremium: 1680000,
      createdBy: admin.id,
    },
  });
  await prisma.parametricReinsuranceCeded.upsert({
    where: { treatyId_parametricPolicyId: { treatyId: treaty2.id, parametricPolicyId: paramPolicyIds[5] } },
    update: {},
    create: {
      treatyId: treaty2.id,
      parametricPolicyId: paramPolicyIds[5],
      grossPremium: 950000,
      cededPremium: 237500,
      netPremium: 712500,
      createdBy: admin.id,
    },
  });

  await prisma.cyberReinsuranceCeded.upsert({
    where: { treatyId_cyberPolicyId: { treatyId: treaty1.id, cyberPolicyId: cyberPolicyIds[2] } },
    update: {},
    create: {
      treatyId: treaty1.id,
      cyberPolicyId: cyberPolicyIds[2],
      grossPremium: 8500,
      cededPremium: 3400,
      netPremium: 5100,
      createdBy: admin.id,
    },
  });
  await prisma.cyberReinsuranceCeded.upsert({
    where: { treatyId_cyberPolicyId: { treatyId: treaty3.id, cyberPolicyId: cyberPolicyIds[3] } },
    update: {},
    create: {
      treatyId: treaty3.id,
      cyberPolicyId: cyberPolicyIds[3],
      grossPremium: 18000,
      cededPremium: 5400,
      netPremium: 12600,
      createdBy: admin.id,
    },
  });
  console.log('  parametric_reinsurance_ceded: 2, cyber_reinsurance_ceded: 2');

  // =======================================================================
  // PHASE 25 — Endorsements (both parametric and cyber)
  // =======================================================================
  console.log('\n--- Phase 25: Endorsements ---');

  await prisma.parametricPolicyEndorsement.upsert({
    where: { endorsementNumber: 'END-PAR-000001' },
    update: {},
    create: {
      parametricPolicyId: paramPolicyIds[4],
      endorsementNumber: 'END-PAR-000001',
      endorsementType: 'COVERAGE_CHANGE',
      previousValuesJson: JSON.stringify({ maxInsuredHours: 72 }),
      newValuesJson: JSON.stringify({ maxInsuredHours: 96 }),
      changeDescription: 'Increased max insured hours from 72 to 96',
      premiumAdjustment: 15000,
      premiumAdjustmentType: 'INCREASE',
      effectiveDate: daysAgo(10),
      requestedBy: customerUserIds[4],
      status: 'PENDING',
      createdBy: admin.id,
    },
  });
  await prisma.parametricPolicyEndorsement.upsert({
    where: { endorsementNumber: 'END-PAR-000002' },
    update: {},
    create: {
      parametricPolicyId: paramPolicyIds[5],
      endorsementNumber: 'END-PAR-000002',
      endorsementType: 'TURNOVER_UPDATE',
      previousValuesJson: JSON.stringify({ annualTurnover: 450000 }),
      newValuesJson: JSON.stringify({ annualTurnover: 650000 }),
      changeDescription: 'Updated annual turnover to reflect growth',
      premiumAdjustment: 5000,
      premiumAdjustmentType: 'INCREASE',
      effectiveDate: daysAgo(15),
      requestedBy: customerUserIds[5],
      approvedBy: admin.id,
      approvedAt: daysAgo(12),
      approvalNotes: 'Approved — turnover verified',
      status: 'APPROVED',
      createdBy: admin.id,
    },
  });

  await prisma.cyberPolicyEndorsement.upsert({
    where: { endorsementNumber: 'END-CYP-000001' },
    update: {},
    create: {
      cyberPolicyId: cyberPolicyIds[2],
      endorsementNumber: 'END-CYP-000001',
      endorsementType: 'LIMIT_INCREASE',
      previousValuesJson: JSON.stringify({ policyLimit: 3000000 }),
      newValuesJson: JSON.stringify({ policyLimit: 4000000 }),
      changeDescription: 'Increased policy limit by 1M TND',
      premiumAdjustment: 3000,
      premiumAdjustmentType: 'INCREASE',
      effectiveDate: daysAgo(8),
      requestedBy: customerUserIds[0],
      status: 'PENDING',
      createdBy: admin.id,
    },
  });
  await prisma.cyberPolicyEndorsement.upsert({
    where: { endorsementNumber: 'END-CYP-000002' },
    update: {},
    create: {
      cyberPolicyId: cyberPolicyIds[3],
      endorsementNumber: 'END-CYP-000002',
      endorsementType: 'COVERAGE_ADDITION',
      previousValuesJson: JSON.stringify({ coverages: ['BI', 'DR', 'CE', 'SR', 'CM', 'PL', 'RD'] }),
      newValuesJson: JSON.stringify({ coverages: ['BI', 'DR', 'CE', 'SR', 'CM', 'PL', 'RD', 'SE'] }),
      changeDescription: 'Added Social Engineering coverage',
      premiumAdjustment: 2500,
      premiumAdjustmentType: 'INCREASE',
      effectiveDate: daysAgo(20),
      requestedBy: customerUserIds[1],
      approvedBy: admin.id,
      approvedAt: daysAgo(18),
      approvalNotes: 'Approved — SE coverage added with sub-limit',
      status: 'APPROVED',
      createdBy: admin.id,
    },
  });
  console.log('  parametric_endorsements: 2, cyber_endorsements: 2');

  // =======================================================================
  // PHASE 26 — Renewals (both parametric and cyber)
  // =======================================================================
  console.log('\n--- Phase 26: Renewals ---');

  await prisma.parametricPolicyRenewal.upsert({
    where: { renewalNumber: 'REN-PAR-000001' },
    update: {},
    create: {
      parentPolicyId: paramPolicyIds[4],
      renewalNumber: 'REN-PAR-000001',
      renewalTermMonths: 12,
      previousPremium: 2800000,
      newPremium: 2950000,
      premiumAdjustmentReason: 'Annual adjustment based on claims experience',
      claimsCountPeriod: 1,
      claimsAmountPeriod: 95000,
      status: 'PENDING',
      quotedAt: daysAgo(5),
      quotedBy: admin.id,
      createdBy: admin.id,
    },
  });
  await prisma.parametricPolicyRenewal.upsert({
    where: { renewalNumber: 'REN-PAR-000002' },
    update: {},
    create: {
      parentPolicyId: paramPolicyIds[5],
      renewalNumber: 'REN-PAR-000002',
      renewalTermMonths: 12,
      previousPremium: 950000,
      newPremium: 980000,
      premiumAdjustmentReason: 'No claims — small increase for inflation',
      claimsCountPeriod: 0,
      claimsAmountPeriod: 0,
      status: 'ACCEPTED',
      quotedAt: daysAgo(30),
      quotedBy: admin.id,
      acceptedAt: daysAgo(25),
      createdBy: admin.id,
    },
  });

  await prisma.cyberPolicyRenewal.upsert({
    where: { renewalNumber: 'REN-CYP-000001' },
    update: {},
    create: {
      parentPolicyId: cyberPolicyIds[2],
      renewalNumber: 'REN-CYP-000001',
      renewalTermMonths: 12,
      previousPremium: 8500,
      newPremium: 9200,
      premiumAdjustmentReason: 'Risk profile improvement — lower increase',
      claimsCountPeriod: 0,
      claimsAmountPeriod: 0,
      status: 'PENDING',
      quotedAt: daysAgo(3),
      quotedBy: admin.id,
      createdBy: admin.id,
    },
  });
  await prisma.cyberPolicyRenewal.upsert({
    where: { renewalNumber: 'REN-CYP-000002' },
    update: {},
    create: {
      parentPolicyId: cyberPolicyIds[3],
      renewalNumber: 'REN-CYP-000002',
      renewalTermMonths: 12,
      previousPremium: 18000,
      newPremium: 19500,
      premiumAdjustmentReason: 'Market rate adjustment',
      claimsCountPeriod: 1,
      claimsAmountPeriod: 140000,
      status: 'ACCEPTED',
      quotedAt: daysAgo(20),
      quotedBy: admin.id,
      acceptedAt: daysAgo(15),
      createdBy: admin.id,
    },
  });
  console.log('  parametric_renewals: 2, cyber_renewals: 2');

  // =======================================================================
  // PHASE 27 — Workflow Policy Applications (20+, across ALL 7 statuses)
  // =======================================================================
  console.log('\n--- Phase 27: Workflow Policy Applications ---');

  const wfAppsData: { num: string; custIdx: number; status: string; premium: number | null; providerContractUrl: string | null; policyContractUrl: string | null; signedContractUrl: string | null; paymentTxId: string | null; paymentMethod: string | null; paymentStatus: string | null; customerSignedAt: Date | null; adminFinalizedBy: number | null; rejectionReason: string | null; paramPolicyId: number | null }[] = [
    // S1: ProviderContractUploaded (2)
    { num: 'WF-APP-000001', custIdx: 0, status: 'ProviderContractUploaded', premium: null, providerContractUrl: '/uploads/provider-contract-001.pdf', policyContractUrl: null, signedContractUrl: null, paymentTxId: null, paymentMethod: null, paymentStatus: null, customerSignedAt: null, adminFinalizedBy: null, rejectionReason: null, paramPolicyId: null },
    { num: 'WF-APP-000002', custIdx: 1, status: 'ProviderContractUploaded', premium: null, providerContractUrl: '/uploads/provider-contract-002.pdf', policyContractUrl: null, signedContractUrl: null, paymentTxId: null, paymentMethod: null, paymentStatus: null, customerSignedAt: null, adminFinalizedBy: null, rejectionReason: null, paramPolicyId: null },
    // S2: AdminReviewing (2)
    { num: 'WF-APP-000003', custIdx: 2, status: 'AdminReviewing', premium: null, providerContractUrl: '/uploads/provider-contract-003.pdf', policyContractUrl: null, signedContractUrl: null, paymentTxId: null, paymentMethod: null, paymentStatus: null, customerSignedAt: null, adminFinalizedBy: null, rejectionReason: null, paramPolicyId: null },
    { num: 'WF-APP-000004', custIdx: 3, status: 'AdminReviewing', premium: null, providerContractUrl: '/uploads/provider-contract-004.pdf', policyContractUrl: null, signedContractUrl: null, paymentTxId: null, paymentMethod: null, paymentStatus: null, customerSignedAt: null, adminFinalizedBy: null, rejectionReason: null, paramPolicyId: null },
    // S3: PolicyContractGenerated (2)
    { num: 'WF-APP-000005', custIdx: 4, status: 'PolicyContractGenerated', premium: 35000, providerContractUrl: '/uploads/provider-contract-005.pdf', policyContractUrl: '/uploads/policy-contract-005.pdf', signedContractUrl: null, paymentTxId: null, paymentMethod: null, paymentStatus: null, customerSignedAt: null, adminFinalizedBy: null, rejectionReason: null, paramPolicyId: null },
    { num: 'WF-APP-000006', custIdx: 5, status: 'PolicyContractGenerated', premium: 4500, providerContractUrl: '/uploads/provider-contract-006.pdf', policyContractUrl: '/uploads/policy-contract-006.pdf', signedContractUrl: null, paymentTxId: null, paymentMethod: null, paymentStatus: null, customerSignedAt: null, adminFinalizedBy: null, rejectionReason: null, paramPolicyId: null },
    // S4: AwaitingSignatureAndPayment (3)
    { num: 'WF-APP-000007', custIdx: 6, status: 'AwaitingSignatureAndPayment', premium: 15000, providerContractUrl: '/uploads/provider-contract-007.pdf', policyContractUrl: '/uploads/policy-contract-007.pdf', signedContractUrl: null, paymentTxId: null, paymentMethod: null, paymentStatus: null, customerSignedAt: null, adminFinalizedBy: null, rejectionReason: null, paramPolicyId: null },
    { num: 'WF-APP-000008', custIdx: 7, status: 'AwaitingSignatureAndPayment', premium: 9000, providerContractUrl: '/uploads/provider-contract-008.pdf', policyContractUrl: '/uploads/policy-contract-008.pdf', signedContractUrl: null, paymentTxId: null, paymentMethod: null, paymentStatus: null, customerSignedAt: null, adminFinalizedBy: null, rejectionReason: null, paramPolicyId: null },
    { num: 'WF-APP-000009', custIdx: 8, status: 'AwaitingSignatureAndPayment', premium: 5500, providerContractUrl: '/uploads/provider-contract-009.pdf', policyContractUrl: '/uploads/policy-contract-009.pdf', signedContractUrl: null, paymentTxId: null, paymentMethod: null, paymentStatus: null, customerSignedAt: null, adminFinalizedBy: null, rejectionReason: null, paramPolicyId: null },
    // S5: ReadyForFinalApproval (2)
    { num: 'WF-APP-000010', custIdx: 9, status: 'ReadyForFinalApproval', premium: 42000, providerContractUrl: '/uploads/provider-contract-010.pdf', policyContractUrl: '/uploads/policy-contract-010.pdf', signedContractUrl: '/uploads/signed-policy-010.pdf', paymentTxId: 'PAY-TXN-010', paymentMethod: 'BANK_TRANSFER', paymentStatus: 'COMPLETED', customerSignedAt: daysAgo(3), adminFinalizedBy: null, rejectionReason: null, paramPolicyId: null },
    { num: 'WF-APP-000011', custIdx: 0, status: 'ReadyForFinalApproval', premium: 8500, providerContractUrl: '/uploads/provider-contract-011.pdf', policyContractUrl: '/uploads/policy-contract-011.pdf', signedContractUrl: '/uploads/signed-policy-011.pdf', paymentTxId: 'PAY-TXN-011', paymentMethod: 'CREDIT_CARD', paymentStatus: 'COMPLETED', customerSignedAt: daysAgo(2), adminFinalizedBy: null, rejectionReason: null, paramPolicyId: null },
    // S6: UnderwritingCompleted (3)
    { num: 'WF-APP-000012', custIdx: 1, status: 'UnderwritingCompleted', premium: 18000, providerContractUrl: '/uploads/provider-contract-012.pdf', policyContractUrl: '/uploads/policy-contract-012.pdf', signedContractUrl: '/uploads/signed-policy-012.pdf', paymentTxId: 'PAY-TXN-012', paymentMethod: 'BANK_TRANSFER', paymentStatus: 'COMPLETED', customerSignedAt: daysAgo(10), adminFinalizedBy: admin.id, rejectionReason: null, paramPolicyId: paramPolicyIds[4] },
    { num: 'WF-APP-000013', custIdx: 2, status: 'UnderwritingCompleted', premium: 12000, providerContractUrl: '/uploads/provider-contract-013.pdf', policyContractUrl: '/uploads/policy-contract-013.pdf', signedContractUrl: '/uploads/signed-policy-013.pdf', paymentTxId: 'PAY-TXN-013', paymentMethod: 'BANK_TRANSFER', paymentStatus: 'COMPLETED', customerSignedAt: daysAgo(8), adminFinalizedBy: admin.id, rejectionReason: null, paramPolicyId: paramPolicyIds[5] },
    { num: 'WF-APP-000014', custIdx: 3, status: 'UnderwritingCompleted', premium: 6500, providerContractUrl: '/uploads/provider-contract-014.pdf', policyContractUrl: '/uploads/policy-contract-014.pdf', signedContractUrl: '/uploads/signed-policy-014.pdf', paymentTxId: 'PAY-TXN-014', paymentMethod: 'CREDIT_CARD', paymentStatus: 'COMPLETED', customerSignedAt: daysAgo(5), adminFinalizedBy: admin2.id, rejectionReason: null, paramPolicyId: paramPolicyIds[6] },
    // S7: Rejected (3)
    { num: 'WF-APP-000015', custIdx: 4, status: 'Rejected', premium: null, providerContractUrl: '/uploads/provider-contract-015.pdf', policyContractUrl: null, signedContractUrl: null, paymentTxId: null, paymentMethod: null, paymentStatus: null, customerSignedAt: null, adminFinalizedBy: null, rejectionReason: 'Provider contract invalid — missing digital signature', paramPolicyId: null },
    { num: 'WF-APP-000016', custIdx: 5, status: 'Rejected', premium: null, providerContractUrl: '/uploads/provider-contract-016.pdf', policyContractUrl: null, signedContractUrl: null, paymentTxId: null, paymentMethod: null, paymentStatus: null, customerSignedAt: null, adminFinalizedBy: null, rejectionReason: 'Insufficient turnover documentation provided', paramPolicyId: null },
    { num: 'WF-APP-000017', custIdx: 6, status: 'Rejected', premium: null, providerContractUrl: '/uploads/provider-contract-017.pdf', policyContractUrl: null, signedContractUrl: null, paymentTxId: null, paymentMethod: null, paymentStatus: null, customerSignedAt: null, adminFinalizedBy: null, rejectionReason: 'Cloud provider not in approved list', paramPolicyId: null },
  ];

  const wfAppIds: number[] = [];
  for (const wa of wfAppsData) {
    const record = await prisma.workflowPolicyApplication.upsert({
      where: { applicationNumber: wa.num },
      update: {},
      create: {
        applicationNumber: wa.num,
        customerId: customerIds[wa.custIdx],
        productId: parametricProduct.id,
        providerContractPdfUrl: wa.providerContractUrl,
        insurancePolicyContractPdfUrl: wa.policyContractUrl,
        signedPolicyContractPdfUrl: wa.signedContractUrl,
        premiumAmount: wa.premium,
        paymentTransactionId: wa.paymentTxId,
        paymentMethod: wa.paymentMethod,
        paymentStatus: wa.paymentStatus,
        premiumPaidAt: wa.paymentTxId ? daysAgo(3) : null,
        customerSignedAt: wa.customerSignedAt,
        customerSignatureIp: wa.customerSignedAt ? '196.203.1.1' : null,
        adminFinalSignatureAt: wa.adminFinalizedBy ? daysAgo(2) : null,
        adminFinalizedBy: wa.adminFinalizedBy,
        adminFinalSignatureIp: wa.adminFinalizedBy ? '10.0.0.1' : null,
        parametricPolicyId: wa.paramPolicyId,
        statusId: wfAppStatusMap[wa.status],
        rejectedBy: wa.status === 'Rejected' ? admin.id : null,
        rejectedAt: wa.status === 'Rejected' ? daysAgo(5) : null,
        rejectionReason: wa.rejectionReason,
        createdBy: admin.id,
      },
    });
    wfAppIds.push(record.id);
  }
  console.log('  workflow_policy_applications:', wfAppsData.length);

  // =======================================================================
  // PHASE 28 — Workflow Claims (10+, across ALL 3 statuses)
  // =======================================================================
  console.log('\n--- Phase 28: Workflow Claims ---');

  const wfClaimsData: { num: string; appIdx: number; custIdx: number; status: string; lossAmount: number | null; payoutAmount: number | null }[] = [
    { num: 'WF-CLM-000001', appIdx: 11, custIdx: 1, status: 'Open', lossAmount: 50000, payoutAmount: null },
    { num: 'WF-CLM-000002', appIdx: 12, custIdx: 2, status: 'Open', lossAmount: 80000, payoutAmount: null },
    { num: 'WF-CLM-000003', appIdx: 13, custIdx: 3, status: 'Open', lossAmount: 30000, payoutAmount: null },
    { num: 'WF-CLM-000004', appIdx: 11, custIdx: 1, status: 'Submitted', lossAmount: 120000, payoutAmount: null },
    { num: 'WF-CLM-000005', appIdx: 12, custIdx: 2, status: 'Submitted', lossAmount: 95000, payoutAmount: null },
    { num: 'WF-CLM-000006', appIdx: 13, custIdx: 3, status: 'Submitted', lossAmount: 45000, payoutAmount: null },
    { num: 'WF-CLM-000007', appIdx: 11, custIdx: 1, status: 'Completed', lossAmount: 200000, payoutAmount: 180000 },
    { num: 'WF-CLM-000008', appIdx: 12, custIdx: 2, status: 'Completed', lossAmount: 150000, payoutAmount: 135000 },
    { num: 'WF-CLM-000009', appIdx: 13, custIdx: 3, status: 'Completed', lossAmount: 75000, payoutAmount: 67500 },
    { num: 'WF-CLM-000010', appIdx: 11, custIdx: 1, status: 'Submitted', lossAmount: 60000, payoutAmount: null },
  ];

  const wfClaimIds: number[] = [];
  for (const wc of wfClaimsData) {
    const record = await prisma.workflowClaim.upsert({
      where: { claimNumber: wc.num },
      update: {},
      create: {
        claimNumber: wc.num,
        policyApplicationId: wfAppIds[wc.appIdx],
        customerId: customerIds[wc.custIdx],
        declarationOfLossPdfUrl: wc.status !== 'Open' ? `/uploads/declaration-of-loss-${wc.num}.pdf` : null,
        lossAmount: wc.lossAmount,
        lossStartDate: wc.lossAmount ? daysAgo(15) : null,
        lossEndDate: wc.lossAmount ? daysAgo(10) : null,
        lossDescription: wc.lossAmount ? 'Cloud outage resulting in business interruption losses' : null,
        payoutAmount: wc.payoutAmount,
        payoutTransactionId: wc.payoutAmount ? `TXN-${wc.num}` : null,
        payoutMethod: wc.payoutAmount ? 'BANK_TRANSFER' : null,
        statusId: wfClaimStatusMap[wc.status],
        paidBy: wc.payoutAmount ? admin.id : null,
        paidAt: wc.payoutAmount ? daysAgo(1) : null,
        createdBy: admin.id,
      },
    });
    wfClaimIds.push(record.id);
  }
  console.log('  workflow_claims:', wfClaimsData.length);

  // =======================================================================
  // PHASE 29 — Workflow Tasks (both policy and claim)
  // =======================================================================
  console.log('\n--- Phase 29: Workflow Tasks ---');

  const wfPolicyTasksData: { appIdx: number; actor: string; action: string; status: string; completed: boolean }[] = [
    { appIdx: 0, actor: 'ADMIN', action: 'Review provider contract', status: 'PENDING', completed: false },
    { appIdx: 1, actor: 'ADMIN', action: 'Review provider contract', status: 'PENDING', completed: false },
    { appIdx: 2, actor: 'ADMIN', action: 'Verify contract authenticity', status: 'COMPLETED', completed: true },
    { appIdx: 3, actor: 'ADMIN', action: 'Assess risk profile', status: 'PENDING', completed: false },
    { appIdx: 10, actor: 'ADMIN', action: 'Final approval of underwriting', status: 'PENDING', completed: false },
  ];

  for (const t of wfPolicyTasksData) {
    await prisma.workflowPolicyTask.create({
      data: {
        policyApplicationId: wfAppIds[t.appIdx],
        actorId: taskActorMap[t.actor],
        actionRequired: t.action,
        actionDetailsJson: JSON.stringify({ description: t.action }),
        priority: 'MEDIUM',
        dueDate: daysAgo(-3),
        statusId: taskStatusMap[t.status],
        completedBy: t.completed ? admin.id : null,
        completedAt: t.completed ? daysAgo(5) : null,
        completionNotes: t.completed ? 'Task completed successfully' : null,
        createdBy: admin.id,
      },
    }).catch(() => {});
  }

  const wfClaimTasksData: { claimIdx: number; actor: string; action: string; status: string; completed: boolean }[] = [
    { claimIdx: 3, actor: 'CUSTOMER', action: 'Upload declaration of loss', status: 'PENDING', completed: false },
    { claimIdx: 4, actor: 'ADMIN', action: 'Review loss documentation', status: 'COMPLETED', completed: true },
    { claimIdx: 6, actor: 'ADMIN', action: 'Process payout', status: 'COMPLETED', completed: true },
  ];

  for (const t of wfClaimTasksData) {
    await prisma.workflowClaimTask.create({
      data: {
        workflowClaimId: wfClaimIds[t.claimIdx],
        actorId: taskActorMap[t.actor],
        actionRequired: t.action,
        actionDetailsJson: JSON.stringify({ description: t.action }),
        priority: 'HIGH',
        dueDate: daysAgo(-2),
        statusId: taskStatusMap[t.status],
        completedBy: t.completed ? admin.id : null,
        completedAt: t.completed ? daysAgo(3) : null,
        completionNotes: t.completed ? 'Task completed successfully' : null,
        createdBy: admin.id,
      },
    }).catch(() => {});
  }
  console.log('  workflow_policy_tasks: 5, workflow_claim_tasks: 3');

  // =======================================================================
  // PHASE 30 — Audit Logs (50+)
  // =======================================================================
  console.log('\n--- Phase 30: Audit Logs ---');

  const auditCategories = ['POLICY_CREATE', 'POLICY_UPDATE', 'CLAIM_CREATE', 'CLAIM_UPDATE', 'WORKFLOW_STATE_CHANGE', 'USER_LOGIN', 'USER_CREATE', 'PAYMENT_PROCESS'];
  const wfStatusCodes = ['ProviderContractUploaded', 'AdminReviewing', 'PolicyContractGenerated', 'AwaitingSignatureAndPayment', 'ReadyForFinalApproval', 'UnderwritingCompleted', 'Rejected'];
  const auditEntries: { entityType: string; entityId: number; action: string; category: string; meta: string }[] = [];

  // Generate audit logs for workflow state changes
  for (let i = 0; i < wfAppIds.length; i++) {
    const statusCode = wfStatusCodes[Math.min(i, wfStatusCodes.length - 1)];
    const prevStatus = i > 0 ? wfStatusCodes[Math.min(i - 1, wfStatusCodes.length - 1)] : null;
    auditEntries.push({
      entityType: 'WorkflowPolicyApplication',
      entityId: wfAppIds[i],
      action: `STATUS_CHANGE_TO_${statusCode}`,
      category: 'WORKFLOW_STATE_CHANGE',
      meta: JSON.stringify({ from_state: prevStatus, to_state: statusCode, actor_id: admin.id, actor_role: 'ADMIN', timestamp: daysAgo(Math.floor(Math.random() * 30)).toISOString(), action_type: 'status_change', correlation_id: `corr-wf-${i}` }),
    });
  }

  // Add more audit logs for variety
  for (let i = 0; i < 20; i++) {
    auditEntries.push({
      entityType: ['ParametricPolicy', 'CyberPolicy', 'ParametricClaim', 'CyberClaim'][i % 4],
      entityId: (i % 4 === 0 ? paramPolicyIds : i % 4 === 1 ? cyberPolicyIds : i % 4 === 2 ? paramClaimIds : cyberClaimIds)[i % 10] ?? 1,
      action: ['CREATE', 'UPDATE', 'STATUS_CHANGE'][i % 3],
      category: auditCategories[i % auditCategories.length],
      meta: JSON.stringify({ actor_id: admin.id, actor_role: 'ADMIN', timestamp: daysAgo(i).toISOString(), action_type: 'crud' }),
    });
  }

  // Add user login audits
  for (let i = 0; i < 10; i++) {
    auditEntries.push({
      entityType: 'User',
      entityId: i < customerUserIds.length ? customerUserIds[i] : admin.id,
      action: 'LOGIN',
      category: 'USER_LOGIN',
      meta: JSON.stringify({ ip_address: `196.203.${i}.1`, user_agent: 'Mozilla/5.0' }),
    });
  }

  for (const ae of auditEntries) {
    await prisma.auditLog.create({
      data: {
        entityType: ae.entityType,
        entityId: ae.entityId,
        action: ae.action,
        actionCategory: ae.category,
        metadataJson: ae.meta,
        actorId: admin.id,
        actorType: 'USER',
        ipAddress: '10.0.0.1',
        userAgent: 'COBITUN-Seed/1.0',
        requestPath: '/api/seed',
        correlationId: `corr-${Math.random().toString(36).slice(2, 10)}`,
      },
    }).catch(() => {});
  }
  console.log('  audit_logs:', auditEntries.length);

  // =======================================================================
  // PHASE 31 — Uploaded Files (5+)
  // =======================================================================
  console.log('\n--- Phase 31: Uploaded Files ---');

  const uploadedFilesData: { name: string; category: string; policyId?: number; cyberPolicyId?: number; paramClaimId?: number; cyberClaimId?: number; wfAppId?: number; wfClaimId?: number }[] = [
    { name: 'provider-contract-techvision.pdf', category: 'PROVIDER_CONTRACT', policyId: paramPolicyIds[4], wfAppId: wfAppIds[0] },
    { name: 'policy-contract-finplus.pdf', category: 'POLICY_CONTRACT', policyId: paramPolicyIds[5], wfAppId: wfAppIds[5] },
    { name: 'declaration-of-loss-001.pdf', category: 'DECLARATION_OF_LOSS', paramClaimId: paramClaimIds[0] },
    { name: 'cyber-policy-contract-cloudmed.pdf', category: 'POLICY_CONTRACT', cyberPolicyId: cyberPolicyIds[2] },
    { name: 'cyber-claim-evidence-001.pdf', category: 'CLAIM_EVIDENCE', cyberClaimId: cyberClaimIds[0] },
    { name: 'signed-policy-010.pdf', category: 'SIGNED_POLICY', wfAppId: wfAppIds[9] },
    { name: 'payout-proof-001.pdf', category: 'PAYOUT_PROOF', paramClaimId: paramClaimIds[6] },
  ];

  for (const uf of uploadedFilesData) {
    await prisma.uploadedFile.create({
      data: {
        fileName: uf.name,
        filePath: `/uploads/${uf.name}`,
        mimeType: 'application/pdf',
        fileSizeBytes: Math.floor(Math.random() * 500000) + 50000,
        fileHashSha256: `sha256-${Math.random().toString(36).slice(2, 34)}`,
        fileCategory: uf.category,
        virusScanStatus: 'CLEAN',
        virusScannedAt: daysAgo(1),
        uploadedBy: admin.id,
        parametricPolicyId: uf.policyId ?? null,
        cyberPolicyId: uf.cyberPolicyId ?? null,
        parametricClaimId: uf.paramClaimId ?? null,
        cyberClaimId: uf.cyberClaimId ?? null,
        workflowPolicyAppId: uf.wfAppId ?? null,
        workflowClaimId: uf.wfClaimId ?? null,
      },
    }).catch(() => {});
  }
  console.log('  uploaded_files:', uploadedFilesData.length);


  // =======================================================================
  // PHASE 32 — Notifications (10+)
  // =======================================================================
  console.log('\n--- Phase 32: Notifications ---');

  const notifsData: { recipientIdx: number; type: string; title: string; message: string; isRead: number; deliveryMethod: string; paramPolicyId?: number; cyberPolicyId?: number; paramClaimId?: number; cyberClaimId?: number }[] = [
    { recipientIdx: 0, type: 'POLICY_CREATED', title: 'Policy Created', message: 'Your parametric policy PAR-000005 has been created', isRead: 1, deliveryMethod: 'IN_APP', paramPolicyId: paramPolicyIds[4] },
    { recipientIdx: 1, type: 'POLICY_ACTIVE', title: 'Policy Activated', message: 'Your parametric policy PAR-000006 is now active', isRead: 0, deliveryMethod: 'IN_APP', paramPolicyId: paramPolicyIds[5] },
    { recipientIdx: 2, type: 'CLAIM_DETECTED', title: 'Claim Detected', message: 'An outage claim PCL-000001 has been detected for your policy', isRead: 0, deliveryMethod: 'IN_APP', paramClaimId: paramClaimIds[0] },
    { recipientIdx: 3, type: 'CLAIM_PAID', title: 'Claim Paid', message: 'Your claim PCL-000007 has been paid', isRead: 1, deliveryMethod: 'EMAIL', paramClaimId: paramClaimIds[6] },
    { recipientIdx: 4, type: 'PAYMENT_RECEIVED', title: 'Payment Received', message: 'We received your premium payment for policy PAR-000005', isRead: 1, deliveryMethod: 'IN_APP', paramPolicyId: paramPolicyIds[4] },
    { recipientIdx: 5, type: 'ENDORSEMENT_PENDING', title: 'Endorsement Pending', message: 'Your endorsement request is pending approval', isRead: 0, deliveryMethod: 'IN_APP' },
    { recipientIdx: 6, type: 'RENEWAL_QUOTE', title: 'Renewal Quote Available', message: 'Your policy renewal quote is ready for review', isRead: 0, deliveryMethod: 'EMAIL' },
    { recipientIdx: 7, type: 'CYBER_CLAIM_UPDATE', title: 'Cyber Claim Update', message: 'Your cyber claim CCL-000005 has been adjusted', isRead: 0, deliveryMethod: 'IN_APP', cyberClaimId: cyberClaimIds[4] },
    { recipientIdx: 8, type: 'WORKFLOW_STATUS_CHANGE', title: 'Application Status Updated', message: 'Your application WF-APP-000012 has been completed', isRead: 1, deliveryMethod: 'IN_APP' },
    { recipientIdx: 9, type: 'POLICY_EXPIRING', title: 'Policy Expiring Soon', message: 'Your policy CYP-000010 is expiring in 30 days', isRead: 0, deliveryMethod: 'EMAIL', cyberPolicyId: cyberPolicyIds[9] },
    { recipientIdx: 0, type: 'CYBER_CLAIM_DENIED', title: 'Cyber Claim Denied', message: 'Your cyber claim CCL-000011 has been denied', isRead: 0, deliveryMethod: 'IN_APP', cyberClaimId: cyberClaimIds[10] },
    { recipientIdx: 1, type: 'MFA_ENABLED', title: 'MFA Enabled', message: 'Multi-factor authentication has been enabled on your account', isRead: 1, deliveryMethod: 'IN_APP' },
  ];

  for (const n of notifsData) {
    await prisma.notification.create({
      data: {
        recipientId: customerUserIds[n.recipientIdx],
        notificationType: n.type,
        title: n.title,
        message: n.message,
        isRead: n.isRead,
        readAt: n.isRead ? daysAgo(1) : null,
        deliveryMethod: n.deliveryMethod,
        emailSent: n.deliveryMethod === 'EMAIL' ? 1 : 0,
        emailSentAt: n.deliveryMethod === 'EMAIL' ? daysAgo(2) : null,
        parametricPolicyId: n.paramPolicyId ?? null,
        cyberPolicyId: n.cyberPolicyId ?? null,
        parametricClaimId: n.paramClaimId ?? null,
        cyberClaimId: n.cyberClaimId ?? null,
      },
    }).catch(() => {});
  }
  console.log('  notifications:', notifsData.length);

  // =======================================================================
  // PHASE 33 — Fraud Detection Results (5+)
  // =======================================================================
  console.log('\n--- Phase 33: Fraud Detection Results ---');

  const fraudData: { userIdx: number; verdict: string; ruleScore: number; llmScore: number; finalScore: number; model: string }[] = [
    { userIdx: 0, verdict: 'LEGITIMATE', ruleScore: 5, llmScore: 8, finalScore: 6.5, model: 'llama3.2:1b' },
    { userIdx: 1, verdict: 'LEGITIMATE', ruleScore: 12, llmScore: 15, finalScore: 13.5, model: 'llama3.2:1b' },
    { userIdx: 3, verdict: 'REVIEW', ruleScore: 45, llmScore: 50, finalScore: 47.5, model: 'llama3.2:1b' },
    { userIdx: 4, verdict: 'REVIEW', ruleScore: 55, llmScore: 60, finalScore: 57.5, model: 'llama3.2:1b' },
    { userIdx: 8, verdict: 'FAKE', ruleScore: 90, llmScore: 85, finalScore: 87.5, model: 'llama3.2:1b' },
  ];

  for (const fd of fraudData) {
    await prisma.fraudDetectionResult.create({
      data: {
        userId: customerUserIds[fd.userIdx],
        ruleScore: fd.ruleScore,
        ruleFlags: JSON.stringify(fd.ruleScore > 40 ? ['SUSPICIOUS_IP', 'RAPID_SUBMISSION'] : ['NONE']),
        llmScore: fd.llmScore,
        llmReasoning: fd.verdict === 'FAKE' ? 'Multiple indicators of fraudulent activity detected' : 'Activity appears normal',
        finalScore: fd.finalScore,
        verdict: fd.verdict,
        modelUsed: fd.model,
        latencyMs: Math.floor(Math.random() * 2000) + 500,
        ipAtCheck: `196.203.${fd.userIdx}.1`,
        uaAtCheck: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        humanLabel: fd.verdict === 'FAKE' ? 'confirmed_fake' : fd.verdict === 'LEGITIMATE' ? 'confirmed_legit' : null,
      },
    }).catch(() => {});
  }
  console.log('  fraud_detection_results:', fraudData.length);

  // =======================================================================
  // PHASE 34 — IP Reputation (5+)
  // =======================================================================
  console.log('\n--- Phase 34: IP Reputation ---');

  const ipRepData: { ip: string; accountCount: number; fakeCount: number; riskScore: number; blocked: number; notes: string }[] = [
    { ip: '196.203.1.1', accountCount: 1, fakeCount: 0, riskScore: 5, blocked: 0, notes: 'Residential ISP — low risk' },
    { ip: '196.203.2.2', accountCount: 1, fakeCount: 0, riskScore: 10, blocked: 0, notes: 'Business ISP — normal activity' },
    { ip: '41.226.3.3', accountCount: 3, fakeCount: 1, riskScore: 35, blocked: 0, notes: 'Multiple accounts — one flagged' },
    { ip: '197.15.4.4', accountCount: 8, fakeCount: 5, riskScore: 80, blocked: 1, notes: 'Known proxy — high fake account rate' },
    { ip: '102.156.5.5', accountCount: 12, fakeCount: 10, riskScore: 95, blocked: 1, notes: 'VPN exit node — blocked' },
  ];

  for (const ir of ipRepData) {
    await prisma.ipReputation.upsert({
      where: { ip: ir.ip },
      update: {},
      create: {
        ip: ir.ip,
        firstSeen: daysAgo(60),
        lastSeen: daysAgo(1),
        accountCount: ir.accountCount,
        fakeCount: ir.fakeCount,
        riskScore: ir.riskScore,
        blocked: ir.blocked,
        notes: ir.notes,
      },
    });
  }
  console.log('  ip_reputation:', ipRepData.length);

  // =======================================================================
  // PHASE 35 — Device Fingerprints (5+)
  // =======================================================================
  console.log('\n--- Phase 35: Device Fingerprints ---');

  const deviceData: { fp: string; userCount: number; riskScore: number; blocked: number }[] = [
    { fp: 'fp-chrome-win-001', userCount: 1, riskScore: 5, blocked: 0 },
    { fp: 'fp-firefox-mac-002', userCount: 1, riskScore: 10, blocked: 0 },
    { fp: 'fp-safari-ios-003', userCount: 2, riskScore: 15, blocked: 0 },
    { fp: 'fp-unknown-bot-004', userCount: 8, riskScore: 85, blocked: 1 },
    { fp: 'fp-emulator-005', userCount: 5, riskScore: 70, blocked: 1 },
  ];

  for (const dd of deviceData) {
    await prisma.deviceFingerprint.upsert({
      where: { fingerprint: dd.fp },
      update: {},
      create: {
        fingerprint: dd.fp,
        userCount: dd.userCount,
        firstSeen: daysAgo(45),
        lastSeen: daysAgo(1),
        riskScore: dd.riskScore,
        blocked: dd.blocked,
      },
    });
  }
  console.log('  device_fingerprints:', deviceData.length);

  // =======================================================================
  // PHASE 36 — User Sessions (5+)
  // =======================================================================
  console.log('\n--- Phase 36: User Sessions ---');

  const sessionData: { userIdx: number; revoked: boolean; expired: boolean }[] = [
    { userIdx: 0, revoked: false, expired: false },
    { userIdx: 1, revoked: false, expired: false },
    { userIdx: 2, revoked: true, expired: false },
    { userIdx: 3, revoked: false, expired: true },
    { userIdx: 4, revoked: false, expired: true },
  ];

  for (let i = 0; i < sessionData.length; i++) {
    const sd = sessionData[i];
    await prisma.userSession.create({
      data: {
        userId: customerUserIds[sd.userIdx],
        sessionId: `sess-${Math.random().toString(36).slice(2, 18)}`,
        ipAddress: `196.203.${i + 1}.1`,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        createdAt: daysAgo(10 + i),
        lastActiveAt: daysAgo(5 + i),
        revokedAt: sd.revoked ? daysAgo(3) : null,
        expiresAt: sd.expired ? daysAgo(1) : daysAgo(-30),
        refreshTokenHash: sd.expired ? null : `rf-hash-${i}`,
        refreshTokenExpiresAt: sd.expired ? null : daysAgo(-60),
      },
    }).catch(() => {});
  }
  console.log('  user_sessions:', sessionData.length);

  // =======================================================================
  // PHASE 37 — Password Reset Tokens (3+)
  // =======================================================================
  console.log('\n--- Phase 37: Password Reset Tokens ---');

  await prisma.passwordResetToken.create({ data: { userId: customerUserIds[0], tokenHash: 'prt-hash-used-001', expiresAt: daysAgo(-1), usedAt: daysAgo(5), createdAt: daysAgo(7) } }).catch(() => {});
  await prisma.passwordResetToken.create({ data: { userId: customerUserIds[1], tokenHash: 'prt-hash-unused-002', expiresAt: daysAgo(-5), createdAt: daysAgo(2) } }).catch(() => {});
  await prisma.passwordResetToken.create({ data: { userId: customerUserIds[2], tokenHash: 'prt-hash-unused-003', expiresAt: daysAgo(-10), createdAt: daysAgo(1) } }).catch(() => {});
  console.log('  password_reset_tokens: 3');

  // =======================================================================
  // PHASE 38 — Email Verification Tokens (3+)
  // =======================================================================
  console.log('\n--- Phase 38: Email Verification Tokens ---');

  await prisma.emailVerificationToken.create({ data: { userId: customerUserIds[0], tokenHash: 'evt-hash-verified-001', expiresAt: daysAgo(-1), verifiedAt: daysAgo(30), createdAt: daysAgo(35) } }).catch(() => {});
  await prisma.emailVerificationToken.create({ data: { userId: customerUserIds[1], tokenHash: 'evt-hash-verified-002', expiresAt: daysAgo(-2), verifiedAt: daysAgo(25), createdAt: daysAgo(30) } }).catch(() => {});
  await prisma.emailVerificationToken.create({ data: { userId: customerUserIds[2], tokenHash: 'evt-hash-pending-003', expiresAt: daysAgo(-5), createdAt: daysAgo(1) } }).catch(() => {});
  console.log('  email_verification_tokens: 3');

  // =======================================================================
  // PHASE 39 — Idempotency Keys (5+)
  // =======================================================================
  console.log('\n--- Phase 39: Idempotency Keys ---');

  const idempKeysData: { key: string; endpoint: string; path: string; method: string; used: boolean; expired: boolean }[] = [
    { key: 'idem-policy-create-001', endpoint: 'POST /api/policies', path: '/api/policies', method: 'POST', used: true, expired: false },
    { key: 'idem-claim-create-002', endpoint: 'POST /api/claims', path: '/api/claims', method: 'POST', used: true, expired: false },
    { key: 'idem-payment-003', endpoint: 'POST /api/payments', path: '/api/payments', method: 'POST', used: true, expired: false },
    { key: 'idem-expired-004', endpoint: 'POST /api/policies', path: '/api/policies', method: 'POST', used: false, expired: true },
    { key: 'idem-expired-005', endpoint: 'POST /api/claims', path: '/api/claims', method: 'POST', used: false, expired: true },
  ];

  for (const ik of idempKeysData) {
    await prisma.idempotencyKey.upsert({
      where: { key: ik.key },
      update: {},
      create: {
        key: ik.key,
        endpoint: ik.endpoint,
        path: ik.path,
        method: ik.method,
        userId: admin.id,
        payloadHash: `ph-${ik.key}`,
        responseStatus: ik.used ? 200 : null,
        responseBody: ik.used ? JSON.stringify({ success: true }) : null,
        usedAt: ik.used ? daysAgo(5) : null,
        expiresAt: ik.expired ? daysAgo(1) : daysAgo(-30),
      },
    });
  }
  console.log('  idempotency_keys:', idempKeysData.length);

  // =======================================================================
  // PHASE 40 — Policy Cancellations (3+)
  // =======================================================================
  console.log('\n--- Phase 40: Policy Cancellations ---');

  const cancellationsData: { policyIdx: number; custIdx: number; reason: string; category: string; refundAmount: number; refundStatus: string }[] = [
    { policyIdx: 9, custIdx: 9, reason: 'Customer requested cancellation', category: 'CUSTOMER_REQUEST', refundAmount: 150000, refundStatus: 'PROCESSED' },
    { policyIdx: 10, custIdx: 0, reason: 'Non-payment of premium', category: 'NON_PAYMENT', refundAmount: 0, refundStatus: 'PENDING' },
    { policyIdx: 8, custIdx: 7, reason: 'Fraudulent application detected', category: 'FRAUD', refundAmount: 0, refundStatus: 'FAILED' },
  ];

  for (const cn of cancellationsData) {
    await prisma.policyCancellation.create({
      data: {
        parametricPolicyId: paramPolicyIds[cn.policyIdx],
        customerId: customerIds[cn.custIdx],
        cancellationReason: cn.reason,
        cancellationCategory: cn.category,
        refundAmount: cn.refundAmount,
        refundStatus: cn.refundStatus,
        refundProcessedAt: cn.refundStatus === 'PROCESSED' ? daysAgo(5) : null,
        effectiveDate: daysAgo(10),
        cancellationInitiatedBy: admin.id,
        refundProcessedBy: cn.refundStatus === 'PROCESSED' ? admin.id : null,
        remarks: cn.reason,
      },
    }).catch(() => {});
  }
  console.log('  policy_cancellations:', cancellationsData.length);

  // =======================================================================
  // PHASE 41 — Claim Appeals (3+)
  // =======================================================================
  console.log('\n--- Phase 41: Claim Appeals ---');

  const appealsData: { paramClaimIdx?: number; wfClaimIdx?: number; custIdx: number; reason: string; status: string; decision?: string; decisionAmount?: number }[] = [
    { paramClaimIdx: 8, custIdx: 0, reason: 'Disputed claim amount is incorrect', status: 'SUBMITTED' },
    { paramClaimIdx: 9, custIdx: 1, reason: 'Additional evidence available for review', status: 'UNDER_REVIEW', decision: undefined, decisionAmount: undefined },
    { wfClaimIdx: 6, custIdx: 1, reason: 'Payout amount should be higher', status: 'APPROVED', decision: 'PARTIALLY_APPROVED', decisionAmount: 50000 },
    { paramClaimIdx: 10, custIdx: 0, reason: 'Rejection was unjustified', status: 'REJECTED' },
  ];

  for (const ap of appealsData) {
    await prisma.claimAppeal.create({
      data: {
        paramClaimId: ap.paramClaimIdx !== undefined ? paramClaimIds[ap.paramClaimIdx] : null,
        workflowClaimId: ap.wfClaimIdx !== undefined ? wfClaimIds[ap.wfClaimIdx] : null,
        customerId: customerIds[ap.custIdx],
        appealReason: ap.reason,
        appealJustification: 'Supporting documentation has been provided separately',
        appealStatus: ap.status,
        reviewedBy: ['UNDER_REVIEW', 'APPROVED', 'REJECTED'].includes(ap.status) ? admin.id : null,
        reviewNotes: ap.status === 'APPROVED' ? 'Partial approval granted' : ap.status === 'REJECTED' ? 'Appeal denied — original decision stands' : null,
        reviewedAt: ['UNDER_REVIEW', 'APPROVED', 'REJECTED'].includes(ap.status) ? daysAgo(3) : null,
        appealDecision: ap.decision ?? null,
        appealDecisionAmount: ap.decisionAmount ?? null,
      },
    }).catch(() => {});
  }
  console.log('  claim_appeals:', appealsData.length);

  // =======================================================================
  // PHASE 42 — Claim Rejections (3+)
  // =======================================================================
  console.log('\n--- Phase 42: Claim Rejections ---');

  const rejectionsData: { paramClaimIdx?: number; wfClaimIdx?: number; custIdx: number; reason: string; category: string }[] = [
    { paramClaimIdx: 10, custIdx: 0, reason: 'Outage duration below policy threshold', category: 'NOT_COVERED' },
    { paramClaimIdx: 11, custIdx: 1, reason: 'Insufficient evidence of outage impact', category: 'INSUFFICIENT_EVIDENCE' },
    { wfClaimIdx: 0, custIdx: 1, reason: 'Claim exceeds policy limits', category: 'POLICY_LIMIT_EXCEEDED' },
  ];

  for (const rj of rejectionsData) {
    await prisma.claimRejection.create({
      data: {
        paramClaimId: rj.paramClaimIdx !== undefined ? paramClaimIds[rj.paramClaimIdx] : null,
        workflowClaimId: rj.wfClaimIdx !== undefined ? wfClaimIds[rj.wfClaimIdx] : null,
        customerId: customerIds[rj.custIdx],
        rejectionReason: rj.reason,
        rejectionCategory: rj.category,
        rejectedBy: admin.id,
        rejectionNotes: rj.reason,
        rejectedAt: daysAgo(5),
        appealDeadlineDate: daysAgo(-25),
      },
    }).catch(() => {});
  }
  console.log('  claim_rejections:', rejectionsData.length);

  // =======================================================================
  // PHASE 43 — Underwriting Notes (5+)
  // =======================================================================
  console.log('\n--- Phase 43: Underwriting Notes ---');

  const uwNotesData: { policyIdx?: number; wfAppIdx?: number; cyberAppIdx?: number; category: string; priority: string; text: string }[] = [
    { policyIdx: 4, category: 'RISK_ASSESSMENT', priority: 'NORMAL', text: 'Technology sector with high resilience profile — acceptable risk' },
    { policyIdx: 5, category: 'COVERAGE_CONCERN', priority: 'HIGH', text: 'Low resilience profile may increase claim frequency' },
    { wfAppIdx: 9, category: 'PREMIUM_ADJUSTMENT', priority: 'NORMAL', text: 'Premium adjusted based on updated turnover figures' },
    { wfAppIdx: 14, category: 'FOLLOW_UP_REQUIRED', priority: 'CRITICAL', text: 'Missing digital signature on provider contract — follow up required' },
    { cyberAppIdx: 6, category: 'RISK_ASSESSMENT', priority: 'HIGH', text: 'Poor security posture — MFA not enabled, no EDR deployed' },
    { cyberAppIdx: 8, category: 'OTHER', priority: 'LOW', text: 'Application looks clean, recommend approval' },
  ];

  for (const un of uwNotesData) {
    await prisma.underwritingNote.create({
      data: {
        parametricPolicyId: un.policyIdx !== undefined ? paramPolicyIds[un.policyIdx] : null,
        workflowAppId: un.wfAppIdx !== undefined ? wfAppIds[un.wfAppIdx] : null,
        cyberApplicationId: un.cyberAppIdx !== undefined ? cyberAppIds[un.cyberAppIdx] : null,
        createdBy: admin.id,
        noteText: un.text,
        noteCategory: un.category,
        priority: un.priority,
        isInternal: 1,
      },
    }).catch(() => {});
  }
  console.log('  underwriting_notes:', uwNotesData.length);

  // =======================================================================
  // PHASE 44 — Notification Logs (5+)
  // =======================================================================
  console.log('\n--- Phase 44: Notification Logs ---');

  const notifLogsData: { recipientIdx: number; type: string; channel: string; status: string }[] = [
    { recipientIdx: 0, type: 'POLICY_CREATED', channel: 'EMAIL', status: 'SENT' },
    { recipientIdx: 1, type: 'CLAIM_REJECTED', channel: 'EMAIL', status: 'SENT' },
    { recipientIdx: 2, type: 'APPEAL_SUBMITTED', channel: 'SMS', status: 'SENT' },
    { recipientIdx: 3, type: 'PASSWORD_RESET', channel: 'EMAIL', status: 'FAILED' },
    { recipientIdx: 4, type: 'PAYMENT_RECEIVED', channel: 'IN_APP', status: 'PENDING' },
    { recipientIdx: 5, type: 'POLICY_EXPIRING', channel: 'EMAIL', status: 'SENT' },
  ];

  for (const nl of notifLogsData) {
    await prisma.notificationLog.create({
      data: {
        recipientId: customerUserIds[nl.recipientIdx],
        notificationType: nl.type,
        channel: nl.channel,
        status: nl.status,
        sendAttempts: nl.status === 'FAILED' ? 3 : 1,
        lastAttemptAt: daysAgo(2),
        sentAt: nl.status === 'SENT' ? daysAgo(2) : null,
        failureReason: nl.status === 'FAILED' ? 'SMTP connection timeout' : null,
        nextRetryAt: nl.status === 'FAILED' ? daysAgo(-1) : null,
      },
    }).catch(() => {});
  }
  console.log('  notification_logs:', notifLogsData.length);

  // =======================================================================
  // PHASE 45 — Contact Submissions (3+)
  // =======================================================================
  console.log('\n--- Phase 45: Contact Submissions ---');

  const contactSubData: { name: string; email: string; phone: string; subject: string; message: string; messageType: string; status: string }[] = [
    { name: 'Hassan Boukadida', email: 'hassan@example.tn', phone: '+216-20-100-001', subject: 'Policy Inquiry', message: 'I would like to know more about your parametric cloud outage insurance', messageType: 'INQUIRY', status: 'RESPONDED' },
    { name: 'Ines Maalej', email: 'ines@example.tn', phone: '+216-20-100-002', subject: 'Claim Delay', message: 'My claim has been pending for over a week without update', messageType: 'COMPLAINT', status: 'IN_PROGRESS' },
    { name: 'Mourad Gharsallah', email: 'mourad@example.tn', phone: '+216-20-100-003', subject: 'Platform Feedback', message: 'Great platform! Would love to see more coverage options for small businesses', messageType: 'FEEDBACK', status: 'OPEN' },
  ];

  for (const cs of contactSubData) {
    await prisma.contactSubmission.create({
      data: {
        name: cs.name,
        email: cs.email,
        phoneNumber: cs.phone,
        subject: cs.subject,
        message: cs.message,
        messageType: cs.messageType,
        status: cs.status,
        respondedBy: cs.status === 'RESPONDED' ? admin.id : null,
        responseNote: cs.status === 'RESPONDED' ? 'Thank you for your interest — detailed information has been sent' : null,
        respondedAt: cs.status === 'RESPONDED' ? daysAgo(3) : null,
      },
    }).catch(() => {});
  }
  console.log('  contact_submissions:', contactSubData.length);

  // =======================================================================
  // PHASE 46 — IODA Claim Suggestions (3+)
  // =======================================================================
  console.log('\n--- Phase 46: IODA Claim Suggestions ---');

  const iodaSuggestionsData: { alertId: string; policyIdx: number; custIdx: number; impactLevel: string; draftStatus: string; suggestedAmount: number }[] = [
    { alertId: 'IODA-ALERT-001', policyIdx: 4, custIdx: 4, impactLevel: 'HIGH', draftStatus: 'DRAFT', suggestedAmount: 85000 },
    { alertId: 'IODA-ALERT-002', policyIdx: 5, custIdx: 5, impactLevel: 'MEDIUM', draftStatus: 'CLAIMED', suggestedAmount: 35000 },
    { alertId: 'IODA-ALERT-003', policyIdx: 6, custIdx: 6, impactLevel: 'LOW', draftStatus: 'IGNORED', suggestedAmount: 5000 },
    { alertId: 'IODA-ALERT-004', policyIdx: 4, custIdx: 4, impactLevel: 'CRITICAL', draftStatus: 'FALSE_POSITIVE', suggestedAmount: 0 },
  ];

  for (const ioda of iodaSuggestionsData) {
    await prisma.iODAClaimSuggestion.upsert({
      where: { iodalertId: ioda.alertId },
      update: {},
      create: {
        iodalertId: ioda.alertId,
        parametricPolicyId: paramPolicyIds[ioda.policyIdx],
        customerId: customerIds[ioda.custIdx],
        outageDescription: `IODA detected outage affecting provider ${providerList[0].organisationName}`,
        affectedProviders: JSON.stringify([providerList[0].iodaName]),
        detectionTimestamp: daysAgo(3),
        impactLevel: ioda.impactLevel,
        estAffectedUsers: Math.floor(Math.random() * 5000) + 100,
        estDowntimeMins: Math.floor(Math.random() * 480) + 30,
        suggestedClaimAmount: ioda.suggestedAmount,
        draftClaimStatus: ioda.draftStatus,
        claimedAt: ioda.draftStatus === 'CLAIMED' ? daysAgo(2) : null,
        claimedBy: ioda.draftStatus === 'CLAIMED' ? admin.id : null,
        ignoredAt: ioda.draftStatus === 'IGNORED' ? daysAgo(1) : null,
        ignoredBy: ioda.draftStatus === 'IGNORED' ? admin.id : null,
        flaggedAsFalsePositive: ioda.draftStatus === 'FALSE_POSITIVE' ? 1 : 0,
        falsePositiveBy: ioda.draftStatus === 'FALSE_POSITIVE' ? admin.id : null,
      },
    });
  }
  console.log('  ioda_claim_suggestions:', iodaSuggestionsData.length);

  // =======================================================================
  // PHASE 47 — Contact Messages (3+)
  // =======================================================================
  console.log('\n--- Phase 47: Contact Messages ---');

  const contactMsgsData: { name: string; email: string; phone: string; subject: string; message: string; category: string; priority: string; isRead: number; responded: boolean }[] = [
    { name: 'Sami Trabelsi', email: 'sami@example.tn', phone: '+216-20-200-001', subject: 'Coverage Question', message: 'Does your parametric insurance cover partial outages?', category: 'GENERAL', priority: 'MEDIUM', isRead: 1, responded: true },
    { name: 'Rim Chaabane', email: 'rim@example.tn', phone: '+216-20-200-002', subject: 'Billing Issue', message: 'I was charged twice for my last premium payment', category: 'BILLING', priority: 'HIGH', isRead: 0, responded: false },
    { name: 'Walid Bouaziz', email: 'walid@example.tn', phone: '+216-20-200-003', subject: 'Partnership Inquiry', message: 'We are a cloud provider interested in listing on your platform', category: 'PARTNERSHIP', priority: 'MEDIUM', isRead: 1, responded: false },
  ];

  for (const cm of contactMsgsData) {
    await prisma.contactMessage.create({
      data: {
        name: cm.name,
        email: cm.email,
        phone: cm.phone,
        subject: cm.subject,
        message: cm.message,
        category: cm.category,
        priority: cm.priority,
        isRead: cm.isRead,
        readAt: cm.isRead ? daysAgo(1) : null,
        respondedBy: cm.responded ? admin.id : null,
        responseText: cm.responded ? 'Thank you for contacting us — yes, partial outages are covered if they exceed the threshold' : null,
        respondedAt: cm.responded ? daysAgo(1) : null,
      },
    }).catch(() => {});
  }
  console.log('  contact_messages:', contactMsgsData.length);

  // =======================================================================
  // PHASE 48 — Customer Questions (3+)
  // =======================================================================
  console.log('\n--- Phase 48: Customer Questions ---');

  const custQuestionsData: { custIdx: number; category: string; subject: string; description: string; priority: string; status: string; assigned: boolean }[] = [
    { custIdx: 0, category: 'POLICY', subject: 'Policy renewal process', description: 'How do I renew my parametric policy? I cannot find the renewal button.', priority: 'LOW', status: 'OPEN', assigned: false },
    { custIdx: 1, category: 'CLAIM', subject: 'Claim documentation requirements', description: 'What documents are needed to support a parametric claim?', priority: 'MEDIUM', status: 'IN_PROGRESS', assigned: true },
    { custIdx: 2, category: 'BILLING', subject: 'Payment method change', description: 'I need to change my payment method from bank transfer to credit card', priority: 'HIGH', status: 'RESOLVED', assigned: true },
  ];

  for (const cq of custQuestionsData) {
    await prisma.customerQuestion.create({
      data: {
        customerId: customerIds[cq.custIdx],
        category: cq.category,
        subject: cq.subject,
        description: cq.description,
        priority: cq.priority,
        status: cq.status,
        assignedTo: cq.assigned ? admin.id : null,
        adminComment: cq.status === 'RESOLVED' ? 'Payment method updated successfully' : null,
        resolvedAt: cq.status === 'RESOLVED' ? daysAgo(2) : null,
      },
    }).catch(() => {});
  }
  console.log('  customer_questions:', custQuestionsData.length);

  // =======================================================================
  // PHASE 49 — Legacy Policy/PolicyRecord (3+)
  // =======================================================================
  console.log('\n--- Phase 49: Legacy Policy/PolicyRecord ---');

  const legacyPoliciesData: { name: string; sumAssurance: number; premium: number; tenure: number }[] = [
    { name: 'Basic Cloud Coverage', sumAssurance: 100000, premium: 1200, tenure: 12 },
    { name: 'Standard Cyber Shield', sumAssurance: 500000, premium: 5000, tenure: 12 },
    { name: 'Premium Business Protection', sumAssurance: 2000000, premium: 18000, tenure: 24 },
  ];

  const legacyPolicyIds: string[] = [];
  for (const lp of legacyPoliciesData) {
    const pol = await prisma.policy.create({
      data: {
        categoryId: String(parametricCategory.id),
        policyName: lp.name,
        sumAssurance: lp.sumAssurance,
        premium: lp.premium,
        tenure: lp.tenure,
      },
    }).catch(() => null);
    if (pol) {
      legacyPolicyIds.push(pol.id);
      await prisma.policyRecord.create({
        data: {
          customerId: String(customerIds[0]),
          policyId: pol.id,
          status: 'Active',
        },
      }).catch(() => {});
      await prisma.policyRecord.create({
        data: {
          customerId: String(customerIds[1]),
          policyId: pol.id,
          status: 'Pending',
        },
      }).catch(() => {});
    }
  }
  console.log('  legacy_policies:', legacyPoliciesData.length);


  // =======================================================================
  // VERIFICATION — Count all seeded tables
  // =======================================================================
  console.log('\n=== SEED VERIFICATION ===');

  const counts: Record<string, number> = {};

  const countQueries: [string, () => Promise<number>][] = [
    ['enum_user_role', () => prisma.enumUserRole.count()],
    ['enum_product_type', () => prisma.enumProductType.count()],
    ['enum_sla_tier', () => prisma.enumSlaTier.count()],
    ['enum_param_policy_status', () => prisma.enumParamPolicyStatus.count()],
    ['enum_param_claim_status', () => prisma.enumParamClaimStatus.count()],
    ['enum_cyber_app_status', () => prisma.enumCyberAppStatus.count()],
    ['enum_cyber_policy_status', () => prisma.enumCyberPolicyStatus.count()],
    ['enum_cyber_claim_status', () => prisma.enumCyberClaimStatus.count()],
    ['enum_security_posture', () => prisma.enumSecurityPosture.count()],
    ['enum_incident_type', () => prisma.enumIncidentType.count()],
    ['enum_workflow_app_status', () => prisma.enumWorkflowAppStatus.count()],
    ['enum_workflow_claim_status', () => prisma.enumWorkflowClaimStatus.count()],
    ['enum_task_actor', () => prisma.enumTaskActor.count()],
    ['enum_task_status', () => prisma.enumTaskStatus.count()],
    ['enum_question_type', () => prisma.enumQuestionType.count()],
    ['ref_sector', () => prisma.refSector.count()],
    ['ref_business_model', () => prisma.refBusinessModel.count()],
    ['ref_resilience_profile', () => prisma.refResilienceProfile.count()],
    ['ref_turnover_band', () => prisma.refTurnoverBand.count()],
    ['system_setting', () => prisma.systemSetting.count()],
    ['sequence_registry', () => prisma.sequenceRegistry.count()],
    ['audit_log', () => prisma.auditLog.count()],
    ['users', () => prisma.user.count()],
    ['customers', () => prisma.customer.count()],
    ['contact_message', () => prisma.contactMessage.count()],
    ['customer_question', () => prisma.customerQuestion.count()],
    ['categories', () => prisma.category.count()],
    ['products', () => prisma.product.count()],
    ['coverage_grants', () => prisma.coverageGrant.count()],
    ['product_exclusions', () => prisma.productExclusion.count()],
    ['underwriting_questions', () => prisma.underwritingQuestion.count()],
    ['cloud_providers', () => prisma.cloudProvider.count()],
    ['payout_function_configs', () => prisma.payoutFunctionConfig.count()],
    ['parametric_policies', () => prisma.parametricPolicy.count()],
    ['outage_events', () => prisma.outageEvent.count()],
    ['merged_incidents', () => prisma.mergedIncident.count()],
    ['incident_event_links', () => prisma.incidentEventLink.count()],
    ['trigger_events', () => prisma.triggerEvent.count()],
    ['parametric_claims', () => prisma.parametricClaim.count()],
    ['cyber_applications', () => prisma.cyberApplication.count()],
    ['cyber_policies', () => prisma.cyberPolicy.count()],
    ['cyber_claims', () => prisma.cyberClaim.count()],
    ['parametric_claim_reserves', () => prisma.parametricClaimReserve.count()],
    ['cyber_claim_reserves', () => prisma.cyberClaimReserve.count()],
    ['reinsurance_treaties', () => prisma.reinsuranceTreaty.count()],
    ['parametric_reinsurance_ceded', () => prisma.parametricReinsuranceCeded.count()],
    ['cyber_reinsurance_ceded', () => prisma.cyberReinsuranceCeded.count()],
    ['parametric_policy_endorsements', () => prisma.parametricPolicyEndorsement.count()],
    ['cyber_policy_endorsements', () => prisma.cyberPolicyEndorsement.count()],
    ['parametric_policy_renewals', () => prisma.parametricPolicyRenewal.count()],
    ['cyber_policy_renewals', () => prisma.cyberPolicyRenewal.count()],
    ['workflow_policy_applications', () => prisma.workflowPolicyApplication.count()],
    ['workflow_claims', () => prisma.workflowClaim.count()],
    ['workflow_policy_tasks', () => prisma.workflowPolicyTask.count()],
    ['workflow_claim_tasks', () => prisma.workflowClaimTask.count()],
    ['uploaded_files', () => prisma.uploadedFile.count()],
    ['notifications', () => prisma.notification.count()],
    ['fraud_detection_results', () => prisma.fraudDetectionResult.count()],
    ['ip_reputation', () => prisma.ipReputation.count()],
    ['device_fingerprints', () => prisma.deviceFingerprint.count()],
    ['user_sessions', () => prisma.userSession.count()],
    ['password_reset_tokens', () => prisma.passwordResetToken.count()],
    ['email_verification_tokens', () => prisma.emailVerificationToken.count()],
    ['idempotency_keys', () => prisma.idempotencyKey.count()],
    ['policy_cancellations', () => prisma.policyCancellation.count()],
    ['claim_appeals', () => prisma.claimAppeal.count()],
    ['claim_rejections', () => prisma.claimRejection.count()],
    ['underwriting_notes', () => prisma.underwritingNote.count()],
    ['notification_logs', () => prisma.notificationLog.count()],
    ['contact_submissions', () => prisma.contactSubmission.count()],
    ['ioda_claim_suggestions', () => prisma.iODAClaimSuggestion.count()],
    ['policies', () => prisma.policy.count()],
    ['policy_records', () => prisma.policyRecord.count()],
  ];

  for (const [table, query] of countQueries) {
    counts[table] = await query();
  }

  // Print formatted table
  const maxLen = Math.max(...Object.keys(counts).map(k => k.length));
  for (const [table, count] of Object.entries(counts)) {
    console.log(`  ${table.padEnd(maxLen + 2)} ${count}`);
  }

  console.log('\n=== SEED COMPLETE ===');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
