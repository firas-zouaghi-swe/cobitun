import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Minimum row counts expected per table
const MINIMUM_ROWS: Record<string, number> = {
  enum_user_role: 2,
  enum_product_type: 2,
  enum_sla_tier: 4,
  enum_param_policy_status: 7,
  enum_param_claim_status: 6,
  enum_cyber_app_status: 5,
  enum_cyber_policy_status: 5,
  enum_cyber_claim_status: 6,
  enum_security_posture: 5,
  enum_incident_type: 10,
  enum_workflow_app_status: 7,
  enum_workflow_claim_status: 3,
  enum_task_actor: 3,
  enum_task_status: 2,
  enum_question_type: 4,
  ref_sector: 16,
  ref_business_model: 5,
  ref_resilience_profile: 3,
  ref_turnover_band: 5,
  system_setting: 5,
  sequence_registry: 5,
  audit_log: 30,
  users: 10,
  customers: 10,
  contact_message: 3,
  customer_question: 3,
  categories: 2,
  products: 2,
  coverage_grants: 9,
  product_exclusions: 6,
  underwriting_questions: 10,
  cloud_providers: 15,
  payout_function_configs: 3,
  parametric_policies: 20,
  outage_events: 10,
  merged_incidents: 5,
  incident_event_links: 1,
  trigger_events: 3,
  parametric_claims: 15,
  cyber_applications: 15,
  cyber_policies: 10,
  cyber_claims: 10,
  parametric_claim_reserves: 3,
  cyber_claim_reserves: 3,
  reinsurance_treaties: 3,
  parametric_reinsurance_ceded: 2,
  cyber_reinsurance_ceded: 2,
  parametric_policy_endorsements: 2,
  cyber_policy_endorsements: 2,
  parametric_policy_renewals: 2,
  cyber_policy_renewals: 2,
  workflow_policy_applications: 14,
  workflow_claims: 9,
  workflow_policy_tasks: 5,
  workflow_claim_tasks: 3,
  uploaded_files: 5,
  notifications: 10,
  fraud_detection_results: 5,
  ip_reputation: 5,
  device_fingerprints: 5,
  user_sessions: 5,
  password_reset_tokens: 3,
  email_verification_tokens: 3,
  idempotency_keys: 5,
  policy_cancellations: 3,
  claim_appeals: 3,
  claim_rejections: 3,
  underwriting_notes: 5,
  notification_logs: 5,
  contact_submissions: 3,
  ioda_claim_suggestions: 3,
  policies: 3,
  policy_records: 3,
};

// Map of snake_case table names to Prisma model accessor names
const TABLE_TO_MODEL: Record<string, string> = {
  parametric_policies: 'parametricPolicy',
  parametric_claims: 'parametricClaim',
  cyber_applications: 'cyberApplication',
  cyber_policies: 'cyberPolicy',
  cyber_claims: 'cyberClaim',
  workflow_policy_applications: 'workflowPolicyApplication',
  workflow_claims: 'workflowClaim',
};

// Status enum values that must appear at least once in relevant tables
const STATUS_ENUM_CHECKS: { table: string; field: string; codes: string[]; model: string }[] = [
  {
    table: 'parametric_policies',
    field: 'statusId',
    codes: ['PENDING', 'APPROVED', 'ACTIVE', 'SUSPENDED', 'CANCELLED', 'EXPIRED', 'REJECTED'],
    model: 'enumParamPolicyStatus',
  },
  {
    table: 'parametric_claims',
    field: 'statusId',
    codes: ['DETECTED', 'VALIDATED', 'APPROVED', 'PAID', 'DISPUTED', 'REJECTED'],
    model: 'enumParamClaimStatus',
  },
  {
    table: 'cyber_applications',
    field: 'statusId',
    codes: ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'],
    model: 'enumCyberAppStatus',
  },
  {
    table: 'cyber_policies',
    field: 'statusId',
    codes: ['PENDING', 'ACTIVE', 'LAPSED', 'CANCELLED', 'EXPIRED'],
    model: 'enumCyberPolicyStatus',
  },
  {
    table: 'cyber_claims',
    field: 'statusId',
    codes: ['REPORTED', 'UNDER_INVESTIGATION', 'ADJUSTED', 'APPROVED', 'PAID', 'DENIED'],
    model: 'enumCyberClaimStatus',
  },
  {
    table: 'workflow_policy_applications',
    field: 'statusId',
    codes: ['ProviderContractUploaded', 'AdminReviewing', 'PolicyContractGenerated', 'AwaitingSignatureAndPayment', 'ReadyForFinalApproval', 'UnderwritingCompleted', 'Rejected'],
    model: 'enumWorkflowAppStatus',
  },
  {
    table: 'workflow_claims',
    field: 'statusId',
    codes: ['Open', 'Submitted', 'Completed'],
    model: 'enumWorkflowClaimStatus',
  },
];

async function main() {
  console.log('=== COBITUN Seed Verification ===\n');

  let totalPass = 0;
  let totalFail = 0;
  const failures: string[] = [];

  // -------------------------------------------------------------------
  // 1. Row count checks
  // -------------------------------------------------------------------
  console.log('--- Row Count Checks ---');

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
    const count = await query();
    const minimum = MINIMUM_ROWS[table] ?? 0;
    const pass = count >= minimum;
    const symbol = pass ? '✓' : '✗';
    console.log(`  ${symbol} ${table.padEnd(40)} ${String(count).padStart(5)} (min: ${minimum})`);
    if (pass) {
      totalPass++;
    } else {
      totalFail++;
      failures.push(`${table}: ${count} rows (min: ${minimum})`);
    }
  }

  // -------------------------------------------------------------------
  // 2. Status enum value coverage checks
  // -------------------------------------------------------------------
  console.log('\n--- Status Enum Coverage Checks ---');

  for (const check of STATUS_ENUM_CHECKS) {
    // Get the enum table records to build a code -> id map
    const enumRecords = await (prisma as any)[check.model].findMany({ select: { id: true, statusCode: true } });
    const codeToId: Record<string, number> = {};
    for (const r of enumRecords) {
      codeToId[r.statusCode] = r.id;
    }

    // Get distinct statusIds used in the data table
    const modelName = TABLE_TO_MODEL[check.table];
    if (!modelName) {
      console.log(`  ✗ No model mapping for table ${check.table}`);
      continue;
    }
    const distinctStatuses = await (prisma as any)[modelName].findMany({
      select: { [check.field]: true },
      distinct: [check.field],
    });
    const usedIds = new Set(distinctStatuses.map((r: any) => r[check.field]));

    for (const code of check.codes) {
      const expectedId = codeToId[code];
      if (!expectedId) {
        console.log(`  ✗ ${check.table} — enum code "${code}" not found in ${check.model}`);
        totalFail++;
        failures.push(`${check.table}: enum code "${code}" not found in ${check.model}`);
        continue;
      }
      const found = usedIds.has(expectedId);
      const symbol = found ? '✓' : '✗';
      console.log(`  ${symbol} ${check.table.padEnd(40)} status "${code}" ${found ? 'present' : 'MISSING'}`);
      if (found) {
        totalPass++;
      } else {
        totalFail++;
        failures.push(`${check.table}: status "${code}" not present`);
      }
    }
  }

  // -------------------------------------------------------------------
  // 3. Foreign key check (SQLite PRAGMA)
  // -------------------------------------------------------------------
  console.log('\n--- Foreign Key Check ---');

  const fkViolations: any[] = await prisma.$queryRaw`PRAGMA foreign_key_check`;
  if (fkViolations.length === 0) {
    console.log('  ✓ No foreign key violations found');
    totalPass++;
  } else {
    console.log(`  ✗ ${fkViolations.length} foreign key violation(s) found:`);
    for (const v of fkViolations) {
      console.log(`    Table: ${v.table}, RowID: ${v.rowid}, Parent: ${v.parent}, FKIndex: ${v.fkid}`);
    }
    totalFail++;
    failures.push(`Foreign key violations: ${fkViolations.length}`);
  }

  // -------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------
  console.log('\n=== VERIFICATION SUMMARY ===');
  console.log(`  Passed: ${totalPass}`);
  console.log(`  Failed: ${totalFail}`);
  if (failures.length > 0) {
    console.log('\n  Failures:');
    for (const f of failures) {
      console.log(`    - ${f}`);
    }
  }

  console.log(`\n  Result: ${totalFail === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
  process.exit(totalFail === 0 ? 0 : 1);
}

main()
  .catch((e) => {
    console.error('Verification error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
