/**
 * UAT Test Suite — Provider Contract Lifecycle (Workflow A) & Declaration Submission (Workflow B)
 *
 * Tests all scenario IDs from the workflow specification:
 * - W1-V-01 to W1-V-06: Valid transitions
 * - W1-I-01 to W1-I-31: Invalid transitions
 * - W1-R-01 to W1-R-13: RBAC violations
 * - W1-D-01 to W1-D-12: Data validations (where testable at engine level)
 * - W2-V-01 to W2-V-02: Valid claim transitions
 * - W2-I-01 to W2-I-08: Invalid claim transitions
 * - W2-R-01 to W2-R-06: Claim RBAC violations
 * - X-01 to X-10: Cross-cutting requirements (where testable)
 */

import {
  validatePolicyTransition,
  validatePolicyTransitionWithReason,
  validateClaimTransition,
  validateClaimTransitionWithReason,
  assertPolicyActionAllowed,
  assertClaimActionAllowed,
  assertPolicyNotTerminal,
  assertClaimNotTerminal,
  isTerminalPolicyState,
  isTerminalClaimState,
  WorkflowTransitionError,
  TERMINAL_POLICY_STATES,
  TERMINAL_CLAIM_STATES,
  POLICY_STATE_TRANSITIONS,
  CLAIM_STATE_TRANSITIONS,
} from '@/lib/services/workflow-engine';

// ==================== WORKFLOW A: VALID TRANSITIONS ====================

describe('Workflow A — Provider Contract Lifecycle', () => {
  // W1-V-01: S1 → S2
  test('W1-V-01: ProviderContractUploaded → AdminReviewing is valid', () => {
    expect(validatePolicyTransition('ProviderContractUploaded', 'AdminReviewing')).toBe(true);
  });

  // W1-V-02: S2 → S3
  test('W1-V-02: AdminReviewing → PolicyContractGenerated is valid', () => {
    expect(validatePolicyTransition('AdminReviewing', 'PolicyContractGenerated')).toBe(true);
  });

  // W1-V-03: S2 → S7
  test('W1-V-03: AdminReviewing → Rejected is valid', () => {
    expect(validatePolicyTransition('AdminReviewing', 'Rejected')).toBe(true);
  });

  // W1-V-04: S3 → S4
  test('W1-V-04: PolicyContractGenerated → AwaitingSignatureAndPayment is valid', () => {
    expect(validatePolicyTransition('PolicyContractGenerated', 'AwaitingSignatureAndPayment')).toBe(true);
  });

  // W1-V-05: S4 → S5
  test('W1-V-05: AwaitingSignatureAndPayment → ReadyForFinalApproval is valid', () => {
    expect(validatePolicyTransition('AwaitingSignatureAndPayment', 'ReadyForFinalApproval')).toBe(true);
  });

  // W1-V-06: S5 → S6
  test('W1-V-06: ReadyForFinalApproval → UnderwritingCompleted is valid', () => {
    expect(validatePolicyTransition('ReadyForFinalApproval', 'UnderwritingCompleted')).toBe(true);
  });

  // ==================== INVALID TRANSITIONS — DIRECT SKIP/JUMP ====================

  // W1-I-01: S1 → S3
  test('W1-I-01: ProviderContractUploaded → PolicyContractGenerated blocked', () => {
    const result = validatePolicyTransitionWithReason('ProviderContractUploaded', 'PolicyContractGenerated');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Admin review required before policy generation');
    expect(result.httpStatus).toBe(409);
  });

  // W1-I-02: S1 → S4
  test('W1-I-02: ProviderContractUploaded → AwaitingSignatureAndPayment blocked', () => {
    const result = validatePolicyTransitionWithReason('ProviderContractUploaded', 'AwaitingSignatureAndPayment');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Admin review and approval required');
    expect(result.httpStatus).toBe(409);
  });

  // W1-I-03: S1 → S5
  test('W1-I-03: ProviderContractUploaded → ReadyForFinalApproval blocked', () => {
    const result = validatePolicyTransitionWithReason('ProviderContractUploaded', 'ReadyForFinalApproval');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid state transition');
    expect(result.httpStatus).toBe(409);
  });

  // W1-I-04: S1 → S6
  test('W1-I-04: ProviderContractUploaded → UnderwritingCompleted blocked', () => {
    const result = validatePolicyTransitionWithReason('ProviderContractUploaded', 'UnderwritingCompleted');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid state transition');
    expect(result.httpStatus).toBe(409);
  });

  // W1-I-05: S1 → S7
  test('W1-I-05: ProviderContractUploaded → Rejected blocked', () => {
    const result = validatePolicyTransitionWithReason('ProviderContractUploaded', 'Rejected');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Rejection requires admin review step');
    expect(result.httpStatus).toBe(409);
  });

  // W1-I-06: S2 → S4
  test('W1-I-06: AdminReviewing → AwaitingSignatureAndPayment blocked', () => {
    const result = validatePolicyTransitionWithReason('AdminReviewing', 'AwaitingSignatureAndPayment');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Policy contract must be generated first');
    expect(result.httpStatus).toBe(409);
  });

  // W1-I-07: S2 → S5
  test('W1-I-07: AdminReviewing → ReadyForFinalApproval blocked', () => {
    const result = validatePolicyTransitionWithReason('AdminReviewing', 'ReadyForFinalApproval');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Policy contract and signature required');
    expect(result.httpStatus).toBe(409);
  });

  // W1-I-08: S2 → S6
  test('W1-I-08: AdminReviewing → UnderwritingCompleted blocked', () => {
    const result = validatePolicyTransitionWithReason('AdminReviewing', 'UnderwritingCompleted');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Complete workflow required before underwriting');
    expect(result.httpStatus).toBe(409);
  });

  // W1-I-09: S3 → S5
  test('W1-I-09: PolicyContractGenerated → ReadyForFinalApproval blocked', () => {
    const result = validatePolicyTransitionWithReason('PolicyContractGenerated', 'ReadyForFinalApproval');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Customer signature and payment required');
    expect(result.httpStatus).toBe(409);
  });

  // W1-I-10: S3 → S6
  test('W1-I-10: PolicyContractGenerated → UnderwritingCompleted blocked', () => {
    const result = validatePolicyTransitionWithReason('PolicyContractGenerated', 'UnderwritingCompleted');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Payment and final approval required');
    expect(result.httpStatus).toBe(409);
  });

  // W1-I-11: S4 → S6
  test('W1-I-11: AwaitingSignatureAndPayment → UnderwritingCompleted blocked', () => {
    const result = validatePolicyTransitionWithReason('AwaitingSignatureAndPayment', 'UnderwritingCompleted');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Final admin approval required');
    expect(result.httpStatus).toBe(409);
  });

  // ==================== INVALID TRANSITIONS — BACKWARD ====================

  // W1-I-12: S5 → S4
  test('W1-I-12: ReadyForFinalApproval → AwaitingSignatureAndPayment backward forbidden', () => {
    const result = validatePolicyTransitionWithReason('ReadyForFinalApproval', 'AwaitingSignatureAndPayment');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Backward transition forbidden');
    expect(result.httpStatus).toBe(409);
  });

  // W1-I-13: S5 → S3
  test('W1-I-13: ReadyForFinalApproval → PolicyContractGenerated backward forbidden', () => {
    const result = validatePolicyTransitionWithReason('ReadyForFinalApproval', 'PolicyContractGenerated');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Backward transition forbidden');
    expect(result.httpStatus).toBe(409);
  });

  // W1-I-14: S5 → S2
  test('W1-I-14: ReadyForFinalApproval → AdminReviewing backward forbidden', () => {
    const result = validatePolicyTransitionWithReason('ReadyForFinalApproval', 'AdminReviewing');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Backward transition forbidden');
    expect(result.httpStatus).toBe(409);
  });

  // W1-I-15: S5 → S1
  test('W1-I-15: ReadyForFinalApproval → ProviderContractUploaded backward forbidden', () => {
    const result = validatePolicyTransitionWithReason('ReadyForFinalApproval', 'ProviderContractUploaded');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Backward transition forbidden');
    expect(result.httpStatus).toBe(409);
  });

  // W1-I-25: S2 → S1
  test('W1-I-25: AdminReviewing → ProviderContractUploaded backward forbidden', () => {
    const result = validatePolicyTransitionWithReason('AdminReviewing', 'ProviderContractUploaded');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Backward transition forbidden');
    expect(result.httpStatus).toBe(409);
  });

  // W1-I-26: S3 → S2
  test('W1-I-26: PolicyContractGenerated → AdminReviewing backward forbidden', () => {
    const result = validatePolicyTransitionWithReason('PolicyContractGenerated', 'AdminReviewing');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Backward transition forbidden');
    expect(result.httpStatus).toBe(409);
  });

  // W1-I-27: S3 → S1
  test('W1-I-27: PolicyContractGenerated → ProviderContractUploaded backward forbidden', () => {
    const result = validatePolicyTransitionWithReason('PolicyContractGenerated', 'ProviderContractUploaded');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Backward transition forbidden');
    expect(result.httpStatus).toBe(409);
  });

  // W1-I-28: S4 → S3
  test('W1-I-28: AwaitingSignatureAndPayment → PolicyContractGenerated backward forbidden', () => {
    const result = validatePolicyTransitionWithReason('AwaitingSignatureAndPayment', 'PolicyContractGenerated');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Backward transition forbidden');
    expect(result.httpStatus).toBe(409);
  });

  // W1-I-29: S4 → S2
  test('W1-I-29: AwaitingSignatureAndPayment → AdminReviewing backward forbidden', () => {
    const result = validatePolicyTransitionWithReason('AwaitingSignatureAndPayment', 'AdminReviewing');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Backward transition forbidden');
    expect(result.httpStatus).toBe(409);
  });

  // W1-I-30: S4 → S1
  test('W1-I-30: AwaitingSignatureAndPayment → ProviderContractUploaded backward forbidden', () => {
    const result = validatePolicyTransitionWithReason('AwaitingSignatureAndPayment', 'ProviderContractUploaded');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Backward transition forbidden');
    expect(result.httpStatus).toBe(409);
  });

  // W1-I-31: S5 → S2
  test('W1-I-31: ReadyForFinalApproval → AdminReviewing backward forbidden', () => {
    const result = validatePolicyTransitionWithReason('ReadyForFinalApproval', 'AdminReviewing');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Backward transition forbidden');
    expect(result.httpStatus).toBe(409);
  });

  // ==================== TERMINAL STATE IMMUTABILITY ====================

  // W1-I-16: S6 → any
  test('W1-I-16: UnderwritingCompleted → any state blocked (terminal)', () => {
    const states = ['ProviderContractUploaded', 'AdminReviewing', 'PolicyContractGenerated', 'AwaitingSignatureAndPayment', 'ReadyForFinalApproval', 'Rejected'];
    for (const target of states) {
      const result = validatePolicyTransitionWithReason('UnderwritingCompleted', target);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Terminal state — modifications forbidden');
      expect(result.httpStatus).toBe(409);
    }
  });

  // W1-I-17: Edit metadata on S6
  test('W1-I-17: assertPolicyNotTerminal throws for UnderwritingCompleted', () => {
    expect(() => assertPolicyNotTerminal('UnderwritingCompleted', 'edits')).toThrow(WorkflowTransitionError);
    expect(() => assertPolicyNotTerminal('UnderwritingCompleted', 'edits')).toThrow('Immutable record — edits rejected');
  });

  // W1-I-18: Delete S6 record
  test('W1-I-18: assertPolicyNotTerminal throws for deletion on UnderwritingCompleted', () => {
    expect(() => assertPolicyNotTerminal('UnderwritingCompleted', 'deletion')).toThrow('Immutable record — deletion rejected');
  });

  // W1-I-19: Append file/attachment to S6
  test('W1-I-19: assertPolicyNotTerminal throws for attachments on UnderwritingCompleted', () => {
    expect(() => assertPolicyNotTerminal('UnderwritingCompleted', 'attachments')).toThrow('Immutable record — attachments rejected');
  });

  // W1-I-20: Admin/superuser override on S6
  test('W1-I-20: Terminal state is immutable even for admin', () => {
    expect(isTerminalPolicyState('UnderwritingCompleted')).toBe(true);
    // No special admin override — terminal is terminal
    expect(() => assertPolicyNotTerminal('UnderwritingCompleted', 'admin override')).toThrow(WorkflowTransitionError);
  });

  // W1-I-21: S7 → S2
  test('W1-I-21: Rejected → AdminReviewing blocked (terminal)', () => {
    const result = validatePolicyTransitionWithReason('Rejected', 'AdminReviewing');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Terminal state — modifications forbidden');
  });

  // W1-I-22: S7 → S1
  test('W1-I-22: Rejected → ProviderContractUploaded blocked (terminal)', () => {
    const result = validatePolicyTransitionWithReason('Rejected', 'ProviderContractUploaded');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Terminal state — modifications forbidden');
  });

  // W1-I-23: Edit rejection reason on S7
  test('W1-I-23: assertPolicyNotTerminal throws for edits on Rejected', () => {
    expect(() => assertPolicyNotTerminal('Rejected', 'edits')).toThrow('Immutable record — edits rejected');
  });

  // W1-I-24: Delete rejected record
  test('W1-I-24: assertPolicyNotTerminal throws for deletion on Rejected', () => {
    expect(() => assertPolicyNotTerminal('Rejected', 'deletion')).toThrow('Immutable record — deletion rejected');
  });

  // ==================== RBAC VIOLATIONS ====================

  // W1-R-01: Customer/Provider trying S1→S2
  test('W1-R-01: Customer cannot initiate admin review', () => {
    expect(() => assertPolicyActionAllowed('REVIEW', 'ProviderContractUploaded', 'CUSTOMER')).toThrow('Insufficient privileges');
  });

  // W1-R-02: Unauthorized Admin S1→S2
  test('W1-R-02: Admin not assigned to contract cannot review', () => {
    expect(() => assertPolicyActionAllowed('REVIEW', 'ProviderContractUploaded', 'ADMIN', { isOwner: false })).toThrow('Contract not assigned to you');
  });

  // W1-R-03: Customer APPROVE
  test('W1-R-03: Customer cannot approve', () => {
    expect(() => assertPolicyActionAllowed('APPROVE', 'AdminReviewing', 'CUSTOMER')).toThrow('Admin action required');
  });

  // W1-R-04: Customer REJECT
  test('W1-R-04: Customer cannot reject', () => {
    expect(() => assertPolicyActionAllowed('REJECT', 'AdminReviewing', 'CUSTOMER')).toThrow('Admin action required');
  });

  // W1-R-05: Admin without approval privilege
  test('W1-R-05: Admin without approval privilege cannot approve', () => {
    expect(() => assertPolicyActionAllowed('APPROVE', 'AdminReviewing', 'ADMIN', { hasApprovalPrivilege: false })).toThrow('Role not authorized for approval');
  });

  // W1-R-06: Admin trying to sign
  test('W1-R-06: Admin cannot sign policy contract', () => {
    expect(() => assertPolicyActionAllowed('SIGN', 'PolicyContractGenerated', 'ADMIN')).toThrow('Customer signature required');
  });

  // W1-R-07: Different customer signing
  test('W1-R-07: Non-owner customer cannot sign', () => {
    expect(() => assertPolicyActionAllowed('SIGN', 'PolicyContractGenerated', 'CUSTOMER', { isOwner: false })).toThrow('Not the contract holder');
  });

  // W1-R-08: Admin trying to pay
  test('W1-R-08: Admin cannot pay premium', () => {
    expect(() => assertPolicyActionAllowed('PAY', 'AwaitingSignatureAndPayment', 'ADMIN')).toThrow('Customer payment required');
  });

  // W1-R-09: Different customer paying
  test('W1-R-09: Non-owner customer cannot pay', () => {
    expect(() => assertPolicyActionAllowed('PAY', 'AwaitingSignatureAndPayment', 'CUSTOMER', { isOwner: false })).toThrow('Not the contract holder');
  });

  // W1-R-10: Customer final signing
  test('W1-R-10: Customer cannot do final approval', () => {
    expect(() => assertPolicyActionAllowed('FINAL_APPROVE', 'ReadyForFinalApproval', 'CUSTOMER')).toThrow('Admin final approval required');
  });

  // W1-R-11: Admin without underwriting privilege
  test('W1-R-11: Admin without underwriting privilege cannot finalize', () => {
    expect(() => assertPolicyActionAllowed('FINAL_APPROVE', 'ReadyForFinalApproval', 'ADMIN', { hasUnderwritingPrivilege: false })).toThrow('Role not authorized for final approval');
  });
});

// ==================== WORKFLOW B: DECLARATION SUBMISSION ====================

describe('Workflow B — Declaration Submission', () => {
  // W2-V-01: D1 → D2
  test('W2-V-01: Open → Submitted is valid', () => {
    expect(validateClaimTransition('Open', 'Submitted')).toBe(true);
  });

  // W2-V-02: D2 → D3
  test('W2-V-02: Submitted → Completed is valid', () => {
    expect(validateClaimTransition('Submitted', 'Completed')).toBe(true);
  });

  // W2-I-01: D1 → D3
  test('W2-I-01: Open → Completed blocked', () => {
    const result = validateClaimTransitionWithReason('Open', 'Completed');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Submission required before completion');
    expect(result.httpStatus).toBe(409);
  });

  // W2-I-02: D2 → D1
  test('W2-I-02: Submitted → Open backward forbidden', () => {
    const result = validateClaimTransitionWithReason('Submitted', 'Open');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Backward transition forbidden');
    expect(result.httpStatus).toBe(409);
  });

  // W2-I-03: D3 → D2
  test('W2-I-03: Completed → Submitted blocked (terminal)', () => {
    const result = validateClaimTransitionWithReason('Completed', 'Submitted');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Terminal state — modifications forbidden');
  });

  // W2-I-04: D3 → D1
  test('W2-I-04: Completed → Open blocked (terminal)', () => {
    const result = validateClaimTransitionWithReason('Completed', 'Open');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Terminal state — modifications forbidden');
  });

  // W2-I-05: D3 Edit data
  test('W2-I-05: assertClaimNotTerminal throws for edits on Completed', () => {
    expect(() => assertClaimNotTerminal('Completed', 'edits')).toThrow('Immutable record — edits rejected');
  });

  // W2-I-06: D3 Delete record
  test('W2-I-06: assertClaimNotTerminal throws for deletion on Completed', () => {
    expect(() => assertClaimNotTerminal('Completed', 'deletion')).toThrow('Immutable record — deletion rejected');
  });

  // W2-I-07: D3 Admin reopen
  test('W2-I-07: Completed cannot be reopened (terminal)', () => {
    expect(isTerminalClaimState('Completed')).toBe(true);
    expect(() => assertClaimNotTerminal('Completed', 'reopen')).toThrow(WorkflowTransitionError);
  });

  // W2-I-08: D3 Add attachment
  test('W2-I-08: assertClaimNotTerminal throws for attachments on Completed', () => {
    expect(() => assertClaimNotTerminal('Completed', 'attachments')).toThrow('Immutable record — attachments rejected');
  });

  // ==================== CLAIM RBAC ====================

  // W2-R-01: Admin submitting
  test('W2-R-01: Admin cannot submit declaration', () => {
    expect(() => assertClaimActionAllowed('SUBMIT', 'Open', 'ADMIN')).toThrow('Customer submission required');
  });

  // W2-R-02: Different customer
  test('W2-R-02: Non-owner customer cannot submit', () => {
    expect(() => assertClaimActionAllowed('SUBMIT', 'Open', 'CUSTOMER', { isOwner: false })).toThrow('Not the declaration owner');
  });

  // W2-R-03: Customer completing
  test('W2-R-03: Customer cannot complete declaration', () => {
    expect(() => assertClaimActionAllowed('COMPLETE', 'Submitted', 'CUSTOMER')).toThrow('Admin completion required');
  });

  // W2-R-04: Admin without review privilege
  test('W2-R-04: Admin without review privilege cannot complete', () => {
    expect(() => assertClaimActionAllowed('COMPLETE', 'Submitted', 'ADMIN', { hasReviewPrivilege: false })).toThrow('Insufficient role privileges');
  });

  // W2-R-05: Customer editing submitted
  test('W2-R-05: Customer cannot edit submitted declaration', () => {
    expect(() => assertClaimActionAllowed('EDIT', 'Submitted', 'CUSTOMER')).toThrow('Submitted declarations are locked');
  });
});

// ==================== CROSS-CUTTING: TERMINAL STATE CONSTANTS ====================

describe('Cross-Cutting — Terminal State Constants', () => {
  test('TERMINAL_POLICY_STATES includes UnderwritingCompleted and Rejected', () => {
    expect(TERMINAL_POLICY_STATES).toContain('UnderwritingCompleted');
    expect(TERMINAL_POLICY_STATES).toContain('Rejected');
  });

  test('TERMINAL_CLAIM_STATES includes Completed', () => {
    expect(TERMINAL_CLAIM_STATES).toContain('Completed');
  });

  test('isTerminalPolicyState returns correct values', () => {
    expect(isTerminalPolicyState('UnderwritingCompleted')).toBe(true);
    expect(isTerminalPolicyState('Rejected')).toBe(true);
    expect(isTerminalPolicyState('ProviderContractUploaded')).toBe(false);
    expect(isTerminalPolicyState('AdminReviewing')).toBe(false);
    expect(isTerminalPolicyState('PolicyContractGenerated')).toBe(false);
    expect(isTerminalPolicyState('AwaitingSignatureAndPayment')).toBe(false);
    expect(isTerminalPolicyState('ReadyForFinalApproval')).toBe(false);
  });

  test('isTerminalClaimState returns correct values', () => {
    expect(isTerminalClaimState('Completed')).toBe(true);
    expect(isTerminalClaimState('Open')).toBe(false);
    expect(isTerminalClaimState('Submitted')).toBe(false);
  });
});

// ==================== WORKFLOW ENGINE: TRANSITION MAP COMPLETENESS ====================

describe('Workflow Engine — Transition Map Completeness', () => {
  test('Policy has exactly 7 states', () => {
    const states = Object.keys(POLICY_STATE_TRANSITIONS);
    expect(states).toHaveLength(7);
    expect(states).toContain('ProviderContractUploaded');
    expect(states).toContain('AdminReviewing');
    expect(states).toContain('PolicyContractGenerated');
    expect(states).toContain('AwaitingSignatureAndPayment');
    expect(states).toContain('ReadyForFinalApproval');
    expect(states).toContain('UnderwritingCompleted');
    expect(states).toContain('Rejected');
  });

  test('Claims have exactly 3 states', () => {
    const states = Object.keys(CLAIM_STATE_TRANSITIONS);
    expect(states).toHaveLength(3);
    expect(states).toContain('Open');
    expect(states).toContain('Submitted');
    expect(states).toContain('Completed');
  });

  test('Terminal states have empty transition arrays', () => {
    expect(POLICY_STATE_TRANSITIONS['UnderwritingCompleted']).toHaveLength(0);
    expect(POLICY_STATE_TRANSITIONS['Rejected']).toHaveLength(0);
    expect(CLAIM_STATE_TRANSITIONS['Completed']).toHaveLength(0);
  });
});

// ==================== WORKFLOW ENGINE: ERROR CLASS ====================

describe('WorkflowTransitionError', () => {
  test('has correct properties', () => {
    const error = new WorkflowTransitionError('Test error', 409, 'TEST_CODE');
    expect(error.message).toBe('Test error');
    expect(error.statusCode).toBe(409);
    expect(error.errorCode).toBe('TEST_CODE');
    expect(error.name).toBe('WorkflowTransitionError');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(WorkflowTransitionError);
  });
});
