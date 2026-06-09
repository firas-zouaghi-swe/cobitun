import { db, safeTransaction } from '@/lib/db';
import { Roles, Role } from '@/lib/services/authorization';

// ==================== CUSTOM ERROR CLASS ====================

/**
 * Custom error thrown when a workflow transition is invalid or forbidden.
 * Carries an HTTP status code and a machine-readable error code alongside
 * the human-readable message.
 */
export class WorkflowTransitionError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly errorCode: string
  ) {
    super(message);
    this.name = 'WorkflowTransitionError';
  }
}

// ==================== STATE TRANSITION MAPS ====================

/**
 * Valid policy application state transitions (using statusCode strings from EnumWorkflowAppStatus).
 *
 * ProviderContractUploaded → AdminReviewing → PolicyContractGenerated → AwaitingSignatureAndPayment → ReadyForFinalApproval → UnderwritingCompleted
 * Also: AdminReviewing → Rejected
 */
export const POLICY_STATE_TRANSITIONS: Record<string, string[]> = {
  ProviderContractUploaded: ['AdminReviewing'],
  AdminReviewing: ['PolicyContractGenerated', 'Rejected'],
  PolicyContractGenerated: ['AwaitingSignatureAndPayment'],
  AwaitingSignatureAndPayment: ['ReadyForFinalApproval'],
  ReadyForFinalApproval: ['UnderwritingCompleted'],
  UnderwritingCompleted: [], // Terminal state
  Rejected: [], // Terminal state
};

/**
 * Valid workflow claim state transitions (using statusCode strings from EnumWorkflowClaimStatus).
 *
 * Open → Submitted → Completed
 */
export const CLAIM_STATE_TRANSITIONS: Record<string, string[]> = {
  Open: ['Submitted'],
  Submitted: ['Completed'],
  Completed: [], // Terminal state
};

// ==================== TERMINAL STATE CONSTANTS & HELPERS ====================

/**
 * Policy application statuses that are terminal (no further transitions allowed).
 */
export const TERMINAL_POLICY_STATES = ['UnderwritingCompleted', 'Rejected'] as const;

/**
 * Claim statuses that are terminal (no further transitions allowed).
 */
export const TERMINAL_CLAIM_STATES = ['Completed'] as const;

/**
 * Returns true if the given policy status code is a terminal state.
 */
export function isTerminalPolicyState(statusCode: string): boolean {
  return (TERMINAL_POLICY_STATES as readonly string[]).includes(statusCode);
}

/**
 * Returns true if the given claim status code is a terminal state.
 */
export function isTerminalClaimState(statusCode: string): boolean {
  return (TERMINAL_CLAIM_STATES as readonly string[]).includes(statusCode);
}

/**
 * Asserts that a policy application is NOT in a terminal state.
 * Throws WorkflowTransitionError if it is.
 *
 * @param statusCode - Current status code of the policy application
 * @param action - Human-readable description of the attempted action
 * @throws WorkflowTransitionError with message "Immutable record — {action} rejected"
 */
export function assertPolicyNotTerminal(statusCode: string, action: string): void | never {
  if (isTerminalPolicyState(statusCode)) {
    throw new WorkflowTransitionError(
      `Immutable record — ${action} rejected`,
      409,
      'TERMINAL_STATE'
    );
  }
}

/**
 * Asserts that a claim is NOT in a terminal state.
 * Throws WorkflowTransitionError if it is.
 *
 * @param statusCode - Current status code of the claim
 * @param action - Human-readable description of the attempted action
 * @throws WorkflowTransitionError with message "Immutable record — {action} rejected"
 */
export function assertClaimNotTerminal(statusCode: string, action: string): void | never {
  if (isTerminalClaimState(statusCode)) {
    throw new WorkflowTransitionError(
      `Immutable record — ${action} rejected`,
      409,
      'TERMINAL_STATE'
    );
  }
}

// ==================== ENUM LOOKUP HELPERS ====================

/**
 * Look up an enum task status ID by its statusCode.
 */
async function getTaskStatusIdByCode(statusCode: string): Promise<number> {
  const status = await db.enumTaskStatus.findFirst({
    where: { statusCode, isCurrent: 1 },
    select: { id: true },
  });
  if (!status) {
    throw new Error(`EnumTaskStatus not found for statusCode: ${statusCode}`);
  }
  return status.id;
}

/**
 * Look up an enum task actor ID by its actorCode.
 */
async function getTaskActorIdByCode(actorCode: string): Promise<number> {
  const actor = await db.enumTaskActor.findFirst({
    where: { actorCode, isCurrent: 1 },
    select: { id: true },
  });
  if (!actor) {
    throw new Error(`EnumTaskActor not found for actorCode: ${actorCode}`);
  }
  return actor.id;
}

/**
 * Look up an enum workflow app status ID by its statusCode.
 */
async function getWorkflowAppStatusIdByCode(statusCode: string): Promise<number> {
  const status = await db.enumWorkflowAppStatus.findFirst({
    where: { statusCode, isCurrent: 1 },
    select: { id: true },
  });
  if (!status) {
    throw new Error(`EnumWorkflowAppStatus not found for statusCode: ${statusCode}`);
  }
  return status.id;
}

/**
 * Look up an enum workflow claim status ID by its statusCode.
 */
async function getWorkflowClaimStatusIdByCode(statusCode: string): Promise<number> {
  const status = await db.enumWorkflowClaimStatus.findFirst({
    where: { statusCode, isCurrent: 1 },
    select: { id: true },
  });
  if (!status) {
    throw new Error(`EnumWorkflowClaimStatus not found for statusCode: ${statusCode}`);
  }
  return status.id;
}

// ==================== TRANSITION VALIDATION ====================

/**
 * Validates whether a policy state transition is allowed.
 */
export function validatePolicyTransition(currentStatus: string, newStatus: string): boolean {
  const allowedTransitions = POLICY_STATE_TRANSITIONS[currentStatus];
  if (!allowedTransitions) {
    return false;
  }
  return allowedTransitions.includes(newStatus);
}

/**
 * Validates whether a claim state transition is allowed.
 */
export function validateClaimTransition(currentStatus: string, newStatus: string): boolean {
  const allowedTransitions = CLAIM_STATE_TRANSITIONS[currentStatus];
  if (!allowedTransitions) {
    return false;
  }
  return allowedTransitions.includes(newStatus);
}

/**
 * Validates a policy transition using DB enum records.
 * Fetches the current and target status, checks the nextStatesJson of the current status.
 */
export async function validatePolicyTransitionDb(currentStatusId: number, newStatusCode: string): Promise<boolean> {
  const currentStatus = await db.enumWorkflowAppStatus.findUnique({
    where: { id: currentStatusId },
  });
  if (!currentStatus) return false;

  const nextStates: string[] = JSON.parse(currentStatus.nextStatesJson || '[]');
  return nextStates.includes(newStatusCode);
}

/**
 * Validates a claim transition using DB enum records.
 * Fetches the current and target status, checks the nextStatesJson of the current status.
 */
export async function validateClaimTransitionDb(currentStatusId: number, newStatusCode: string): Promise<boolean> {
  const currentStatus = await db.enumWorkflowClaimStatus.findUnique({
    where: { id: currentStatusId },
  });
  if (!currentStatus) return false;

  const nextStates: string[] = JSON.parse(currentStatus.nextStatesJson || '[]');
  return nextStates.includes(newStatusCode);
}

// ==================== ENHANCED TRANSITION VALIDATION WITH SPEC MESSAGES ====================

/**
 * Ordered list of policy status codes from earliest to latest.
 * Used to determine "backward" transitions.
 */
const POLICY_STATUS_ORDER: Record<string, number> = {
  ProviderContractUploaded: 1,
  AdminReviewing: 2,
  PolicyContractGenerated: 3,
  AwaitingSignatureAndPayment: 4,
  ReadyForFinalApproval: 5,
  UnderwritingCompleted: 6,
  Rejected: 7,
};

/**
 * Ordered list of claim status codes from earliest to latest.
 * Used to determine "backward" transitions.
 */
const CLAIM_STATUS_ORDER: Record<string, number> = {
  Open: 1,
  Submitted: 2,
  Completed: 3,
};

/**
 * Spec-compliant error message map for invalid policy transitions.
 * Key format: "currentStatus→newStatus"
 */
const POLICY_TRANSITION_ERRORS: Record<string, { message: string; errorCode: string }> = {
  // S1 (ProviderContractUploaded) invalid transitions
  'ProviderContractUploaded→PolicyContractGenerated': {
    message: 'Admin review required before policy generation',
    errorCode: 'INVALID_TRANSITION',
  },
  'ProviderContractUploaded→AwaitingSignatureAndPayment': {
    message: 'Admin review and approval required',
    errorCode: 'INVALID_TRANSITION',
  },
  'ProviderContractUploaded→ReadyForFinalApproval': {
    message: 'Invalid state transition',
    errorCode: 'INVALID_TRANSITION',
  },
  'ProviderContractUploaded→UnderwritingCompleted': {
    message: 'Invalid state transition',
    errorCode: 'INVALID_TRANSITION',
  },
  'ProviderContractUploaded→Rejected': {
    message: 'Rejection requires admin review step',
    errorCode: 'INVALID_TRANSITION',
  },

  // S2 (AdminReviewing) invalid transitions
  'AdminReviewing→AwaitingSignatureAndPayment': {
    message: 'Policy contract must be generated first',
    errorCode: 'INVALID_TRANSITION',
  },
  'AdminReviewing→ReadyForFinalApproval': {
    message: 'Policy contract and signature required',
    errorCode: 'INVALID_TRANSITION',
  },
  'AdminReviewing→UnderwritingCompleted': {
    message: 'Complete workflow required before underwriting',
    errorCode: 'INVALID_TRANSITION',
  },

  // S3 (PolicyContractGenerated) invalid transitions
  'PolicyContractGenerated→ReadyForFinalApproval': {
    message: 'Customer signature and payment required',
    errorCode: 'INVALID_TRANSITION',
  },
  'PolicyContractGenerated→UnderwritingCompleted': {
    message: 'Payment and final approval required',
    errorCode: 'INVALID_TRANSITION',
  },

  // S4 (AwaitingSignatureAndPayment) invalid transitions
  'AwaitingSignatureAndPayment→UnderwritingCompleted': {
    message: 'Final admin approval required',
    errorCode: 'INVALID_TRANSITION',
  },
};

/**
 * Validates a policy state transition and returns a spec-compliant error reason if invalid.
 *
 * Returns `{ valid: true, error: null, httpStatus: 200 }` for valid transitions.
 * Returns `{ valid: false, error: "<spec message>", httpStatus: 409 }` for invalid transitions.
 */
export function validatePolicyTransitionWithReason(
  currentStatus: string,
  newStatus: string
): { valid: boolean; error: string | null; httpStatus: number } {
  // If the transition is valid, return success
  if (validatePolicyTransition(currentStatus, newStatus)) {
    return { valid: true, error: null, httpStatus: 200 };
  }

  // Check terminal states first
  if (currentStatus === 'UnderwritingCompleted') {
    return {
      valid: false,
      error: 'Terminal state — modifications forbidden',
      httpStatus: 409,
    };
  }

  if (currentStatus === 'Rejected') {
    // S7→S2/S1: Terminal state; S7→any other is also terminal
    return {
      valid: false,
      error: 'Terminal state — modifications forbidden',
      httpStatus: 409,
    };
  }

  // Check for backward transitions
  const currentOrder = POLICY_STATUS_ORDER[currentStatus];
  const newOrder = POLICY_STATUS_ORDER[newStatus];

  if (currentOrder !== undefined && newOrder !== undefined && newOrder < currentOrder) {
    return {
      valid: false,
      error: 'Backward transition forbidden',
      httpStatus: 409,
    };
  }

  // Check spec-compliant error map for specific invalid forward transitions
  const key = `${currentStatus}→${newStatus}`;
  const specError = POLICY_TRANSITION_ERRORS[key];
  if (specError) {
    return {
      valid: false,
      error: specError.message,
      httpStatus: 409,
    };
  }

  // Fallback for any other invalid transition (e.g., unknown status codes)
  return {
    valid: false,
    error: 'Invalid state transition',
    httpStatus: 409,
  };
}

/**
 * Validates a claim state transition and returns a spec-compliant error reason if invalid.
 *
 * Returns `{ valid: true, error: null, httpStatus: 200 }` for valid transitions.
 * Returns `{ valid: false, error: "<spec message>", httpStatus: 409 }` for invalid transitions.
 */
export function validateClaimTransitionWithReason(
  currentStatus: string,
  newStatus: string
): { valid: boolean; error: string | null; httpStatus: number } {
  // If the transition is valid, return success
  if (validateClaimTransition(currentStatus, newStatus)) {
    return { valid: true, error: null, httpStatus: 200 };
  }

  // Check terminal state
  if (currentStatus === 'Completed') {
    return {
      valid: false,
      error: 'Terminal state — modifications forbidden',
      httpStatus: 409,
    };
  }

  // D1→D3: Submission required before completion
  if (currentStatus === 'Open' && newStatus === 'Completed') {
    return {
      valid: false,
      error: 'Submission required before completion',
      httpStatus: 409,
    };
  }

  // Check for backward transitions
  const currentOrder = CLAIM_STATUS_ORDER[currentStatus];
  const newOrder = CLAIM_STATUS_ORDER[newStatus];

  if (currentOrder !== undefined && newOrder !== undefined && newOrder < currentOrder) {
    return {
      valid: false,
      error: 'Backward transition forbidden',
      httpStatus: 409,
    };
  }

  // Fallback
  return {
    valid: false,
    error: 'Invalid state transition',
    httpStatus: 409,
  };
}

// ==================== RBAC ASSERTIONS ====================

/**
 * Asserts that the given actor is allowed to perform the specified policy action
 * given the current status and role-based constraints.
 *
 * Throws WorkflowTransitionError with spec-compliant messages if the action is forbidden.
 *
 * Policy RBAC rules (Workflow A — Provider Contract Lifecycle):
 *
 * W1-R-01: Customer/Provider trying S1→S2: "Insufficient privileges" (403)
 * W1-R-02: Unauthorized Admin S1→S2: "Contract not assigned to you" (403)
 * W1-R-03: Customer APPROVE: "Admin action required" (403)
 * W1-R-04: Customer REJECT: "Admin action required" (403)
 * W1-R-05: Admin without approval privilege: "Role not authorized for approval" (403)
 * W1-R-06: Admin trying to sign: "Customer signature required" (403)
 * W1-R-07: Different customer signing: "Not the contract holder" (403)
 * W1-R-08: Admin trying to pay: "Customer payment required" (403)
 * W1-R-09: Different customer paying: "Not the contract holder" (403)
 * W1-R-10: Customer final signing: "Admin final approval required" (403)
 * W1-R-11: Admin without underwriting privilege: "Role not authorized for final approval" (403)
 */
export function assertPolicyActionAllowed(
  action: string,
  currentStatus: string,
  actorRole: string,
  options?: {
    isOwner?: boolean;
    hasApprovalPrivilege?: boolean;
    hasUnderwritingPrivilege?: boolean;
  }
): void | never {
  const isOwner = options?.isOwner ?? true;
  const hasApprovalPrivilege = options?.hasApprovalPrivilege ?? false;
  const hasUnderwritingPrivilege = options?.hasUnderwritingPrivilege ?? false;

  const upperAction = action.toUpperCase();

  // W1-R-01: Customer/Provider trying to initiate admin review (S1→S2)
  if (
    currentStatus === 'ProviderContractUploaded' &&
    upperAction === 'REVIEW' &&
    actorRole !== Roles.ADMIN
  ) {
    throw new WorkflowTransitionError('Insufficient privileges', 403, 'W1-R-01');
  }

  // W1-R-02: Admin trying to review but contract not assigned to them
  if (
    currentStatus === 'ProviderContractUploaded' &&
    upperAction === 'REVIEW' &&
    actorRole === Roles.ADMIN &&
    !isOwner
  ) {
    throw new WorkflowTransitionError('Contract not assigned to you', 403, 'W1-R-02');
  }

  // W1-R-03: Customer trying to approve (S2→S3)
  if (
    currentStatus === 'AdminReviewing' &&
    upperAction === 'APPROVE' &&
    actorRole === Roles.CUSTOMER
  ) {
    throw new WorkflowTransitionError('Admin action required', 403, 'W1-R-03');
  }

  // W1-R-04: Customer trying to reject (S2→S7)
  if (
    currentStatus === 'AdminReviewing' &&
    upperAction === 'REJECT' &&
    actorRole === Roles.CUSTOMER
  ) {
    throw new WorkflowTransitionError('Admin action required', 403, 'W1-R-04');
  }

  // W1-R-05: Admin without approval privilege trying to approve
  if (
    currentStatus === 'AdminReviewing' &&
    upperAction === 'APPROVE' &&
    actorRole === Roles.ADMIN &&
    !hasApprovalPrivilege
  ) {
    throw new WorkflowTransitionError('Role not authorized for approval', 403, 'W1-R-05');
  }

  // W1-R-06: Admin trying to sign (S3→S4, signing step)
  if (
    currentStatus === 'PolicyContractGenerated' &&
    upperAction === 'SIGN' &&
    actorRole === Roles.ADMIN
  ) {
    throw new WorkflowTransitionError('Customer signature required', 403, 'W1-R-06');
  }

  // W1-R-07: Different customer trying to sign
  if (
    currentStatus === 'PolicyContractGenerated' &&
    upperAction === 'SIGN' &&
    actorRole === Roles.CUSTOMER &&
    !isOwner
  ) {
    throw new WorkflowTransitionError('Not the contract holder', 403, 'W1-R-07');
  }

  // W1-R-08: Admin trying to pay (S3→S4 or S4 step, payment step)
  if (
    (currentStatus === 'PolicyContractGenerated' || currentStatus === 'AwaitingSignatureAndPayment') &&
    upperAction === 'PAY' &&
    actorRole === Roles.ADMIN
  ) {
    throw new WorkflowTransitionError('Customer payment required', 403, 'W1-R-08');
  }

  // W1-R-09: Different customer trying to pay
  if (
    (currentStatus === 'PolicyContractGenerated' || currentStatus === 'AwaitingSignatureAndPayment') &&
    upperAction === 'PAY' &&
    actorRole === Roles.CUSTOMER &&
    !isOwner
  ) {
    throw new WorkflowTransitionError('Not the contract holder', 403, 'W1-R-09');
  }

  // W1-R-10: Customer trying to do final approval/signing (S5→S6)
  if (
    currentStatus === 'ReadyForFinalApproval' &&
    (upperAction === 'FINAL_APPROVE' || upperAction === 'APPROVE') &&
    actorRole === Roles.CUSTOMER
  ) {
    throw new WorkflowTransitionError('Admin final approval required', 403, 'W1-R-10');
  }

  // W1-R-11: Admin without underwriting privilege trying final approval (S5→S6)
  if (
    currentStatus === 'ReadyForFinalApproval' &&
    (upperAction === 'FINAL_APPROVE' || upperAction === 'APPROVE') &&
    actorRole === Roles.ADMIN &&
    !hasUnderwritingPrivilege
  ) {
    throw new WorkflowTransitionError('Role not authorized for final approval', 403, 'W1-R-11');
  }
}

/**
 * Asserts that the given actor is allowed to perform the specified claim action
 * given the current status and role-based constraints.
 *
 * Throws WorkflowTransitionError with spec-compliant messages if the action is forbidden.
 *
 * Claim RBAC rules (Workflow B — Declaration of Loss):
 *
 * W2-R-01: Admin submitting: "Customer submission required" (403)
 * W2-R-02: Different customer: "Not the declaration owner" (403)
 * W2-R-03: Customer completing: "Admin completion required" (403)
 * W2-R-04: Admin without review privilege: "Insufficient role privileges" (403)
 * W2-R-05: Customer editing submitted: "Submitted declarations are locked" (403)
 */
export function assertClaimActionAllowed(
  action: string,
  currentStatus: string,
  actorRole: string,
  options?: { isOwner?: boolean; hasReviewPrivilege?: boolean }
): void | never {
  const isOwner = options?.isOwner ?? true;
  const hasReviewPrivilege = options?.hasReviewPrivilege ?? false;

  const upperAction = action.toUpperCase();

  // W2-R-01: Admin trying to submit a claim (D1→D2)
  if (
    currentStatus === 'Open' &&
    upperAction === 'SUBMIT' &&
    actorRole === Roles.ADMIN
  ) {
    throw new WorkflowTransitionError('Customer submission required', 403, 'W2-R-01');
  }

  // W2-R-02: Different customer trying to submit
  if (
    currentStatus === 'Open' &&
    upperAction === 'SUBMIT' &&
    actorRole === Roles.CUSTOMER &&
    !isOwner
  ) {
    throw new WorkflowTransitionError('Not the declaration owner', 403, 'W2-R-02');
  }

  // W2-R-03: Customer trying to complete (D2→D3)
  if (
    currentStatus === 'Submitted' &&
    upperAction === 'COMPLETE' &&
    actorRole === Roles.CUSTOMER
  ) {
    throw new WorkflowTransitionError('Admin completion required', 403, 'W2-R-03');
  }

  // W2-R-04: Admin without review privilege trying to complete
  if (
    currentStatus === 'Submitted' &&
    upperAction === 'COMPLETE' &&
    actorRole === Roles.ADMIN &&
    !hasReviewPrivilege
  ) {
    throw new WorkflowTransitionError('Insufficient role privileges', 403, 'W2-R-04');
  }

  // W2-R-05: Customer trying to edit a submitted declaration
  if (
    currentStatus === 'Submitted' &&
    upperAction === 'EDIT' &&
    actorRole === Roles.CUSTOMER
  ) {
    throw new WorkflowTransitionError('Submitted declarations are locked', 403, 'W2-R-05');
  }
}

// ==================== CONCURRENCY GUARD ====================

/**
 * Wraps a state transition in a safeTransaction with optimistic concurrency control.
 *
 * Inside the transaction, re-fetches the entity and verifies it is still in the
 * expected state. If the state has changed concurrently, throws WorkflowTransitionError
 * with 409. Otherwise, executes the transition function.
 *
 * @param entityType - Whether the entity is a PolicyApplication or WorkflowClaim
 * @param entityId - The database ID of the entity
 * @param expectedCurrentStatusCode - The statusCode we expect the entity to currently have
 * @param transitionFn - The function that performs the actual transition (receives the tx client)
 * @param options - Optional timeout for the transaction
 */
export async function transitionWithConcurrencyGuard<T>(
  entityType: 'PolicyApplication' | 'WorkflowClaim',
  entityId: number,
  expectedCurrentStatusCode: string,
  transitionFn: () => Promise<T>,
  options?: { timeout?: number }
): Promise<T> {
  return safeTransaction(async (tx) => {
    // Re-fetch the entity inside the transaction to get the current status
    let currentStatusCode: string | null = null;

    if (entityType === 'PolicyApplication') {
      const entity = await tx.workflowPolicyApplication.findUnique({
        where: { id: entityId },
        include: { status: { select: { statusCode: true } } },
      });
      if (!entity) {
        throw new WorkflowTransitionError(
          `PolicyApplication not found: ${entityId}`,
          404,
          'NOT_FOUND'
        );
      }
      currentStatusCode = entity.status?.statusCode ?? null;
    } else {
      const entity = await tx.workflowClaim.findUnique({
        where: { id: entityId },
        include: { status: { select: { statusCode: true } } },
      });
      if (!entity) {
        throw new WorkflowTransitionError(
          `WorkflowClaim not found: ${entityId}`,
          404,
          'NOT_FOUND'
        );
      }
      currentStatusCode = entity.status?.statusCode ?? null;
    }

    // Verify the entity is still in the expected state
    if (currentStatusCode !== expectedCurrentStatusCode) {
      throw new WorkflowTransitionError(
        `Concurrent modification detected: expected status "${expectedCurrentStatusCode}" but found "${currentStatusCode}"`,
        409,
        'CONCURRENT_MODIFICATION'
      );
    }

    // Execute the transition function
    return transitionFn();
  }, { timeout: options?.timeout });
}

// ==================== TASK MANAGEMENT ====================

interface CreateTaskParams {
  entityType: 'Policy' | 'Claim';
  policyApplicationId?: number;
  workflowClaimId?: number;
  actorCode: Role;
  actionRequired: string;
  actionDetailsJson?: Record<string, unknown>;
  priority?: string;
  dueDate?: Date;
}

/**
 * Creates a new workflow task.
 * Dispatches to WorkflowPolicyTask or WorkflowClaimTask based on entityType.
 */
export async function createTask(params: CreateTaskParams) {
  const { entityType, policyApplicationId, workflowClaimId, actorCode, actionRequired, actionDetailsJson, priority, dueDate } = params;

  const actorId = await getTaskActorIdByCode(actorCode);
  const pendingStatusId = await getTaskStatusIdByCode('PENDING');

  const commonData = {
    actorId,
    actionRequired,
    actionDetailsJson: actionDetailsJson ? JSON.stringify(actionDetailsJson) : '{}',
    priority: priority ?? 'MEDIUM',
    dueDate: dueDate ?? null,
    statusId: pendingStatusId,
  };

  if (entityType === 'Policy') {
    if (!policyApplicationId) {
      throw new Error('policyApplicationId is required for Policy tasks');
    }
    return db.workflowPolicyTask.create({
      data: {
        policyApplicationId,
        ...commonData,
      },
    });
  } else {
    if (!workflowClaimId) {
      throw new Error('workflowClaimId is required for Claim tasks');
    }
    return db.workflowClaimTask.create({
      data: {
        workflowClaimId,
        ...commonData,
      },
    });
  }
}

/**
 * Marks a workflow task as completed.
 * Determines the correct table based on entityType.
 */
export async function completeTask(
  taskId: number,
  entityType: 'Policy' | 'Claim',
  completedBy: number,
  completionNotes?: string
) {
  const completedStatusId = await getTaskStatusIdByCode('COMPLETED');

  if (entityType === 'Policy') {
    return db.workflowPolicyTask.update({
      where: { id: taskId },
      data: {
        statusId: completedStatusId,
        completedBy,
        completedAt: new Date(),
        completionNotes: completionNotes ?? null,
      },
    });
  } else {
    return db.workflowClaimTask.update({
      where: { id: taskId },
      data: {
        statusId: completedStatusId,
        completedBy,
        completedAt: new Date(),
        completionNotes: completionNotes ?? null,
      },
    });
  }
}

/**
 * Normalized task representation that combines policy and claim tasks.
 */
export interface NormalizedWorkflowTask {
  id: number;
  entityType: 'Policy' | 'Claim';
  policyApplicationId: number | null;
  workflowClaimId: number | null;
  actorId: number;
  actionRequired: string;
  priority: string;
  dueDate: Date | null;
  statusId: number | null;
  completedBy: number | null;
  completedAt: Date | null;
  completionNotes: string | null;
  createdAt: Date;
}

/**
 * Retrieves all pending tasks for a given actor.
 * Queries both WorkflowPolicyTask and WorkflowClaimTask tables and combines results.
 *
 * If actor is 'CUSTOMER' and customerId is provided, filters tasks
 * related to the customer's policy applications and claims.
 */
export async function getPendingTasksForActor(
  actorCode: Role,
  customerId?: number
): Promise<NormalizedWorkflowTask[]> {
  const actorId = await getTaskActorIdByCode(actorCode);
  const pendingStatusId = await getTaskStatusIdByCode('PENDING');

  // Build policy task query
  let policyTaskWhere: Record<string, unknown> = {
    actorId,
    statusId: pendingStatusId,
    isDeleted: 0,
  };

  let claimTaskWhere: Record<string, unknown> = {
    actorId,
    statusId: pendingStatusId,
    isDeleted: 0,
  };

  // If customer, filter by customer's policy applications and claims
  if (actorCode === Roles.CUSTOMER && customerId) {
    const customerPolicyIds = await db.workflowPolicyApplication.findMany({
      where: { customerId },
      select: { id: true },
    });
    const policyIds = customerPolicyIds.map((p) => p.id);

    const customerClaimIds = await db.workflowClaim.findMany({
      where: { customerId },
      select: { id: true },
    });
    const claimIds = customerClaimIds.map((c) => c.id);

    policyTaskWhere = {
      ...policyTaskWhere,
      policyApplicationId: { in: policyIds },
    };

    claimTaskWhere = {
      ...claimTaskWhere,
      workflowClaimId: { in: claimIds },
    };
  }

  // Query both tables
  const [policyTasks, claimTasks] = await Promise.all([
    db.workflowPolicyTask.findMany({
      where: policyTaskWhere,
      orderBy: { createdAt: 'desc' },
    }),
    db.workflowClaimTask.findMany({
      where: claimTaskWhere,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  // Normalize and combine
  const normalizedPolicyTasks: NormalizedWorkflowTask[] = policyTasks.map((t) => ({
    id: t.id,
    entityType: 'Policy' as const,
    policyApplicationId: t.policyApplicationId,
    workflowClaimId: null,
    actorId: t.actorId,
    actionRequired: t.actionRequired,
    priority: t.priority,
    dueDate: t.dueDate,
    statusId: t.statusId,
    completedBy: t.completedBy,
    completedAt: t.completedAt,
    completionNotes: t.completionNotes,
    createdAt: t.createdAt,
  }));

  const normalizedClaimTasks: NormalizedWorkflowTask[] = claimTasks.map((t) => ({
    id: t.id,
    entityType: 'Claim' as const,
    policyApplicationId: null,
    workflowClaimId: t.workflowClaimId,
    actorId: t.actorId,
    actionRequired: t.actionRequired,
    priority: t.priority,
    dueDate: t.dueDate,
    statusId: t.statusId,
    completedBy: t.completedBy,
    completedAt: t.completedAt,
    completionNotes: t.completionNotes,
    createdAt: t.createdAt,
  }));

  // Combine and sort by createdAt descending
  return [...normalizedPolicyTasks, ...normalizedClaimTasks].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );
}

// ==================== WORKFLOW POLICY APPLICATION HELPERS ====================

/**
 * Update the status of a WorkflowPolicyApplication.
 * Validates the transition before applying.
 */
export async function updatePolicyApplicationStatus(
  applicationId: number,
  newStatusCode: string,
  options?: {
    adminFinalizedBy?: number;
    rejectedBy?: number;
    rejectionReason?: string;
  }
) {
  const application = await db.workflowPolicyApplication.findUnique({
    where: { id: applicationId },
  });

  if (!application) {
    throw new Error(`WorkflowPolicyApplication not found: ${applicationId}`);
  }

  // Validate transition
  if (application.statusId) {
    const isValid = await validatePolicyTransitionDb(application.statusId, newStatusCode);
    if (!isValid) {
      throw new Error(`Invalid policy application transition to: ${newStatusCode}`);
    }
  }

  const newStatusId = await getWorkflowAppStatusIdByCode(newStatusCode);

  const updateData: Record<string, unknown> = {
    statusId: newStatusId,
  };

  if (options?.adminFinalizedBy) {
    updateData.adminFinalizedBy = options.adminFinalizedBy;
    updateData.adminFinalSignatureAt = new Date();
  }

  if (options?.rejectedBy) {
    updateData.rejectedBy = options.rejectedBy;
    updateData.rejectedAt = new Date();
    updateData.rejectionReason = options.rejectionReason ?? null;
  }

  return db.workflowPolicyApplication.update({
    where: { id: applicationId },
    data: updateData,
  });
}

// ==================== WORKFLOW CLAIM HELPERS ====================

/**
 * Update the status of a WorkflowClaim.
 * Validates the transition before applying.
 */
export async function updateWorkflowClaimStatus(
  claimId: number,
  newStatusCode: string,
  options?: {
    paidBy?: number;
    payoutAmount?: number;
    payoutTransactionId?: string;
    payoutMethod?: string;
  }
) {
  const claim = await db.workflowClaim.findUnique({
    where: { id: claimId },
  });

  if (!claim) {
    throw new Error(`WorkflowClaim not found: ${claimId}`);
  }

  // Validate transition
  if (claim.statusId) {
    const isValid = await validateClaimTransitionDb(claim.statusId, newStatusCode);
    if (!isValid) {
      throw new Error(`Invalid workflow claim transition to: ${newStatusCode}`);
    }
  }

  const newStatusId = await getWorkflowClaimStatusIdByCode(newStatusCode);

  const updateData: Record<string, unknown> = {
    statusId: newStatusId,
  };

  if (options?.paidBy) {
    updateData.paidBy = options.paidBy;
    updateData.paidAt = new Date();
    updateData.payoutAmount = options.payoutAmount ?? null;
    updateData.payoutTransactionId = options.payoutTransactionId ?? null;
    updateData.payoutMethod = options.payoutMethod ?? null;
  }

  return db.workflowClaim.update({
    where: { id: claimId },
    data: updateData,
  });
}
