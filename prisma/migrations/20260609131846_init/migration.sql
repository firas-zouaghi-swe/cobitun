-- CreateTable
CREATE TABLE "system_settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "setting_key" TEXT NOT NULL,
    "setting_value" TEXT NOT NULL,
    "value_type" TEXT NOT NULL,
    "is_editable" INTEGER NOT NULL DEFAULT 1,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "valid_from" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_to" DATETIME,
    "is_current" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1
);

-- CreateTable
CREATE TABLE "sequence_registry" (
    "sequence_name" TEXT NOT NULL PRIMARY KEY,
    "current_value" INTEGER NOT NULL DEFAULT 0,
    "prefix" TEXT NOT NULL,
    "padding_width" INTEGER NOT NULL DEFAULT 6,
    "year_reset" INTEGER NOT NULL DEFAULT 1,
    "last_year" INTEGER,
    "description" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "entity_type" TEXT NOT NULL,
    "entity_id" INTEGER NOT NULL,
    "entity_version" INTEGER NOT NULL DEFAULT 1,
    "actor_id" INTEGER,
    "actor_type" TEXT NOT NULL DEFAULT 'USER',
    "action" TEXT NOT NULL,
    "action_category" TEXT NOT NULL,
    "old_values_json" TEXT,
    "new_values_json" TEXT,
    "metadata_json" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "request_path" TEXT,
    "correlation_id" TEXT,
    "session_id" TEXT,
    "previous_hash" TEXT,
    "row_hash" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "enum_user_role" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "role_code" TEXT NOT NULL,
    "role_name" TEXT NOT NULL,
    "role_name_ar" TEXT,
    "description" TEXT,
    "permissions_json" TEXT NOT NULL DEFAULT '[]',
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "valid_from" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_to" DATETIME,
    "is_current" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1
);

-- CreateTable
CREATE TABLE "enum_product_type" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type_code" TEXT NOT NULL,
    "type_name" TEXT NOT NULL,
    "type_name_ar" TEXT,
    "description" TEXT,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "valid_from" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_to" DATETIME,
    "is_current" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1
);

-- CreateTable
CREATE TABLE "enum_sla_tier" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tier_code" TEXT NOT NULL,
    "tier_name" TEXT NOT NULL,
    "tier_name_ar" TEXT,
    "mttr_hours" DECIMAL NOT NULL,
    "base_premium_factor" DECIMAL NOT NULL DEFAULT 1.0000,
    "threshold_hours" DECIMAL NOT NULL,
    "description" TEXT,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "valid_from" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_to" DATETIME,
    "is_current" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1
);

-- CreateTable
CREATE TABLE "enum_param_policy_status" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "status_code" TEXT NOT NULL,
    "status_name" TEXT NOT NULL,
    "status_name_ar" TEXT,
    "is_terminal" INTEGER NOT NULL DEFAULT 0,
    "allows_claims" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "valid_from" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_to" DATETIME,
    "is_current" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1
);

-- CreateTable
CREATE TABLE "enum_param_claim_status" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "status_code" TEXT NOT NULL,
    "status_name" TEXT NOT NULL,
    "status_name_ar" TEXT,
    "is_terminal" INTEGER NOT NULL DEFAULT 0,
    "allows_payment" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "valid_from" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_to" DATETIME,
    "is_current" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1
);

-- CreateTable
CREATE TABLE "enum_cyber_app_status" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "status_code" TEXT NOT NULL,
    "status_name" TEXT NOT NULL,
    "status_name_ar" TEXT,
    "is_terminal" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "valid_from" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_to" DATETIME,
    "is_current" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1
);

-- CreateTable
CREATE TABLE "fraud_detection_results" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "rule_score" REAL NOT NULL,
    "rule_flags" TEXT NOT NULL DEFAULT '[]',
    "llm_score" REAL NOT NULL,
    "llm_reasoning" TEXT,
    "final_score" REAL NOT NULL,
    "verdict" TEXT NOT NULL,
    "model_used" TEXT NOT NULL,
    "latency_ms" REAL NOT NULL,
    "ip_at_check" TEXT,
    "ua_at_check" TEXT,
    "human_label" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fraud_detection_results_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ip_reputation" (
    "ip" TEXT NOT NULL PRIMARY KEY,
    "first_seen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "account_count" INTEGER NOT NULL DEFAULT 0,
    "fake_count" INTEGER NOT NULL DEFAULT 0,
    "risk_score" REAL NOT NULL DEFAULT 0,
    "is_blocked" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "device_fingerprints" (
    "fingerprint" TEXT NOT NULL PRIMARY KEY,
    "user_count" INTEGER NOT NULL DEFAULT 0,
    "first_seen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "risk_score" REAL NOT NULL DEFAULT 0,
    "is_blocked" INTEGER NOT NULL DEFAULT 0,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "enum_cyber_policy_status" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "status_code" TEXT NOT NULL,
    "status_name" TEXT NOT NULL,
    "status_name_ar" TEXT,
    "is_terminal" INTEGER NOT NULL DEFAULT 0,
    "allows_claims" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "valid_from" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_to" DATETIME,
    "is_current" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1
);

-- CreateTable
CREATE TABLE "enum_cyber_claim_status" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "status_code" TEXT NOT NULL,
    "status_name" TEXT NOT NULL,
    "status_name_ar" TEXT,
    "is_terminal" INTEGER NOT NULL DEFAULT 0,
    "allows_payment" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "valid_from" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_to" DATETIME,
    "is_current" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1
);

-- CreateTable
CREATE TABLE "enum_security_posture" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "posture_code" TEXT NOT NULL,
    "posture_name" TEXT NOT NULL,
    "posture_name_ar" TEXT,
    "risk_multiplier" DECIMAL NOT NULL DEFAULT 1.0000,
    "description" TEXT,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "valid_from" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_to" DATETIME,
    "is_current" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1
);

-- CreateTable
CREATE TABLE "enum_incident_type" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type_code" TEXT NOT NULL,
    "type_name" TEXT NOT NULL,
    "type_name_ar" TEXT,
    "description" TEXT,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "valid_from" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_to" DATETIME,
    "is_current" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1
);

-- CreateTable
CREATE TABLE "enum_workflow_app_status" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "status_code" TEXT NOT NULL,
    "status_name" TEXT NOT NULL,
    "status_name_ar" TEXT,
    "is_terminal" INTEGER NOT NULL DEFAULT 0,
    "actor_required" TEXT NOT NULL,
    "next_states_json" TEXT NOT NULL DEFAULT '[]',
    "description" TEXT,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "valid_from" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_to" DATETIME,
    "is_current" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1
);

-- CreateTable
CREATE TABLE "enum_workflow_claim_status" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "status_code" TEXT NOT NULL,
    "status_name" TEXT NOT NULL,
    "status_name_ar" TEXT,
    "is_terminal" INTEGER NOT NULL DEFAULT 0,
    "actor_required" TEXT NOT NULL,
    "next_states_json" TEXT NOT NULL DEFAULT '[]',
    "description" TEXT,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "valid_from" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_to" DATETIME,
    "is_current" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1
);

-- CreateTable
CREATE TABLE "enum_task_actor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "actor_code" TEXT NOT NULL,
    "actor_name" TEXT NOT NULL,
    "actor_name_ar" TEXT,
    "description" TEXT,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "valid_from" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_to" DATETIME,
    "is_current" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1
);

-- CreateTable
CREATE TABLE "enum_task_status" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "status_code" TEXT NOT NULL,
    "status_name" TEXT NOT NULL,
    "status_name_ar" TEXT,
    "is_terminal" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "valid_from" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_to" DATETIME,
    "is_current" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1
);

-- CreateTable
CREATE TABLE "enum_question_type" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type_code" TEXT NOT NULL,
    "type_name" TEXT NOT NULL,
    "type_name_ar" TEXT,
    "description" TEXT,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "valid_from" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_to" DATETIME,
    "is_current" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1
);

-- CreateTable
CREATE TABLE "ref_sector" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sector_code" TEXT NOT NULL,
    "sector_name" TEXT NOT NULL,
    "sector_name_ar" TEXT,
    "risk_factor" DECIMAL NOT NULL,
    "description" TEXT,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "valid_from" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_to" DATETIME,
    "is_current" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1
);

-- CreateTable
CREATE TABLE "ref_business_model" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "model_code" TEXT NOT NULL,
    "model_name" TEXT NOT NULL,
    "model_name_ar" TEXT,
    "risk_factor" DECIMAL NOT NULL,
    "description" TEXT,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "valid_from" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_to" DATETIME,
    "is_current" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1
);

-- CreateTable
CREATE TABLE "ref_resilience_profile" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "profile_code" TEXT NOT NULL,
    "profile_name" TEXT NOT NULL,
    "profile_name_ar" TEXT,
    "risk_factor" DECIMAL NOT NULL,
    "description" TEXT,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "valid_from" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_to" DATETIME,
    "is_current" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1
);

-- CreateTable
CREATE TABLE "ref_turnover_band" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "band_code" TEXT NOT NULL,
    "band_name" TEXT NOT NULL,
    "band_name_ar" TEXT,
    "min_turnover" DECIMAL NOT NULL,
    "max_turnover" DECIMAL NOT NULL,
    "risk_factor" DECIMAL NOT NULL,
    "description" TEXT,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "valid_from" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_to" DATETIME,
    "is_current" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1
);

-- CreateTable
CREATE TABLE "users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "password_salt" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role_id" INTEGER NOT NULL,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "email_verified" INTEGER NOT NULL DEFAULT 0,
    "email_verified_at" DATETIME,
    "last_login_at" DATETIME,
    "last_login_ip" TEXT,
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" DATETIME,
    "password_changed_at" DATETIME,
    "password_expires_at" DATETIME,
    "mfa_enabled" INTEGER NOT NULL DEFAULT 0,
    "mfa_secret" TEXT,
    "deleted_at" DATETIME,
    "deleted_by" INTEGER,
    "deletion_reason" TEXT,
    "is_deleted" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "enum_user_role" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "users_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "customers" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "company_name" TEXT NOT NULL,
    "registration_number" TEXT,
    "tax_id" TEXT,
    "sector_id" INTEGER,
    "business_model_id" INTEGER,
    "address" TEXT NOT NULL,
    "address_ar" TEXT,
    "city" TEXT,
    "postal_code" TEXT,
    "country" TEXT NOT NULL DEFAULT 'Tunisia',
    "mobile" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "profile_pic_url" TEXT,
    "annual_turnover_tnd" DECIMAL,
    "total_policies" INTEGER NOT NULL DEFAULT 0,
    "total_claims" INTEGER NOT NULL DEFAULT 0,
    "total_premium_paid" DECIMAL NOT NULL DEFAULT 0,
    "total_payouts_received" DECIMAL NOT NULL DEFAULT 0,
    "deleted_at" DATETIME,
    "deleted_by" INTEGER,
    "deletion_reason" TEXT,
    "is_deleted" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "customers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "customers_sector_id_fkey" FOREIGN KEY ("sector_id") REFERENCES "ref_sector" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "customers_business_model_id_fkey" FOREIGN KEY ("business_model_id") REFERENCES "ref_business_model" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "contact_messages" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "is_read" INTEGER NOT NULL DEFAULT 0,
    "read_at" DATETIME,
    "responded_by" INTEGER,
    "response_text" TEXT,
    "responded_at" DATETIME,
    "deleted_at" DATETIME,
    "deleted_by" INTEGER,
    "is_deleted" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "contact_messages_responded_by_fkey" FOREIGN KEY ("responded_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "customer_questions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "customer_id" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "assigned_to" INTEGER,
    "admin_comment" TEXT,
    "resolved_at" DATETIME,
    "deleted_at" DATETIME,
    "deleted_by" INTEGER,
    "is_deleted" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "customer_questions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "customer_questions_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "categories" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "category_name" TEXT NOT NULL,
    "category_name_ar" TEXT,
    "description" TEXT,
    "description_ar" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "deleted_at" DATETIME,
    "deleted_by" INTEGER,
    "is_deleted" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "categories_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "categories_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "products" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "category_id" INTEGER NOT NULL,
    "product_code" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "product_name_ar" TEXT,
    "product_type_id" INTEGER NOT NULL,
    "description" TEXT,
    "description_ar" TEXT,
    "master_policy_limit" DECIMAL,
    "master_deductible_sir" DECIMAL,
    "indemnity_period_days" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'TND',
    "base_rate_per_1000" DECIMAL,
    "minimum_premium_tnd" DECIMAL,
    "maximum_premium_tnd" DECIMAL,
    "coverage_period_months" INTEGER NOT NULL DEFAULT 12,
    "cooling_off_days" INTEGER NOT NULL DEFAULT 14,
    "regulatory_approval_number" TEXT,
    "regulatory_approval_date" DATETIME,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "deleted_at" DATETIME,
    "deleted_by" INTEGER,
    "is_deleted" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "products_product_type_id_fkey" FOREIGN KEY ("product_type_id") REFERENCES "enum_product_type" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "products_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "products_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "coverage_grants" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "product_id" INTEGER NOT NULL,
    "coverage_code" TEXT NOT NULL,
    "coverage_name" TEXT NOT NULL,
    "coverage_name_ar" TEXT,
    "sub_limit_default" DECIMAL,
    "sub_limit_max" DECIMAL,
    "waiting_period_hours" INTEGER NOT NULL DEFAULT 0,
    "waiting_period_days" INTEGER NOT NULL DEFAULT 0,
    "deductible_pct" DECIMAL NOT NULL DEFAULT 0,
    "co_insurance_pct" DECIMAL NOT NULL DEFAULT 0,
    "exclusions_json" TEXT NOT NULL DEFAULT '[]',
    "is_optional" INTEGER NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "deleted_at" DATETIME,
    "deleted_by" INTEGER,
    "is_deleted" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "coverage_grants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "product_exclusions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "product_id" INTEGER NOT NULL,
    "exclusion_code" TEXT NOT NULL,
    "exclusion_name" TEXT NOT NULL,
    "exclusion_name_ar" TEXT,
    "description" TEXT,
    "description_ar" TEXT,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "deleted_at" DATETIME,
    "deleted_by" INTEGER,
    "is_deleted" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "product_exclusions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "underwriting_questions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "product_id" INTEGER NOT NULL,
    "field_name" TEXT NOT NULL,
    "question_text" TEXT NOT NULL,
    "question_text_ar" TEXT,
    "question_type_id" INTEGER NOT NULL,
    "options_json" TEXT,
    "expected_answer" TEXT,
    "weight" DECIMAL NOT NULL DEFAULT 1.00,
    "is_scored" INTEGER NOT NULL DEFAULT 1,
    "is_required" INTEGER NOT NULL DEFAULT 1,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "deleted_at" DATETIME,
    "deleted_by" INTEGER,
    "is_deleted" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "underwriting_questions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "underwriting_questions_question_type_id_fkey" FOREIGN KEY ("question_type_id") REFERENCES "enum_question_type" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cloud_providers" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "asn" TEXT NOT NULL,
    "organisation_name" TEXT NOT NULL,
    "organisation_name_ar" TEXT,
    "ioda_name" TEXT,
    "sla_tier_id" INTEGER NOT NULL,
    "mttr_hours" DECIMAL NOT NULL,
    "risk_score" DECIMAL NOT NULL,
    "premium_factor" DECIMAL NOT NULL DEFAULT 1.0000,
    "is_verified" INTEGER NOT NULL DEFAULT 0,
    "verified_at" DATETIME,
    "verified_by" INTEGER,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "deleted_at" DATETIME,
    "deleted_by" INTEGER,
    "is_deleted" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "cloud_providers_sla_tier_id_fkey" FOREIGN KEY ("sla_tier_id") REFERENCES "enum_sla_tier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "cloud_providers_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "cloud_providers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "cloud_providers_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "payout_function_configs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "config_name" TEXT NOT NULL,
    "config_code" TEXT NOT NULL,
    "function_type" TEXT NOT NULL,
    "description" TEXT,
    "linear_multiplier" DECIMAL,
    "step_config_json" TEXT,
    "hybrid_base_rate" DECIMAL,
    "hybrid_step_config_json" TEXT,
    "exponential_base" DECIMAL,
    "exponential_exponent" DECIMAL,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "deleted_at" DATETIME,
    "deleted_by" INTEGER,
    "is_deleted" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "payout_function_configs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "payout_function_configs_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "parametric_policies" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "policy_number" TEXT NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "cloud_provider_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "sector_id" INTEGER NOT NULL,
    "business_model_id" INTEGER NOT NULL,
    "turnover_band_id" INTEGER NOT NULL,
    "resilience_profile_id" INTEGER NOT NULL,
    "annual_turnover_tnd" DECIMAL NOT NULL,
    "hourly_revenue" DECIMAL NOT NULL,
    "base_premium" DECIMAL NOT NULL,
    "commercial_premium" DECIMAL NOT NULL,
    "provider_adjusted_premium" DECIMAL NOT NULL,
    "final_premium" DECIMAL NOT NULL,
    "premium_rate_pct" DECIMAL NOT NULL,
    "max_insured_hours" DECIMAL NOT NULL,
    "hourly_payout_rate" DECIMAL NOT NULL,
    "max_payout_amount" DECIMAL NOT NULL,
    "payout_function_config_id" INTEGER,
    "sector_factor_at_creation" DECIMAL NOT NULL,
    "business_model_factor_at_creation" DECIMAL NOT NULL,
    "turnover_band_factor_at_creation" DECIMAL NOT NULL,
    "resilience_factor_at_creation" DECIMAL NOT NULL,
    "provider_factor_at_creation" DECIMAL NOT NULL,
    "loading_factor_at_creation" DECIMAL NOT NULL DEFAULT 1.3200,
    "underwriting_decision" TEXT NOT NULL,
    "underwriting_notes" TEXT,
    "underwritten_by" INTEGER,
    "underwritten_at" DATETIME,
    "status_id" INTEGER,
    "effective_date" DATETIME,
    "expiry_date" DATETIME,
    "cancellation_date" DATETIME,
    "cancellation_reason" TEXT,
    "cancellation_refund_amount" DECIMAL,
    "total_claims_count" INTEGER NOT NULL DEFAULT 0,
    "total_payout_amount" DECIMAL NOT NULL DEFAULT 0,
    "deleted_at" DATETIME,
    "deleted_by" INTEGER,
    "deletion_reason" TEXT,
    "is_deleted" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "parametric_policies_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "parametric_policies_cloud_provider_id_fkey" FOREIGN KEY ("cloud_provider_id") REFERENCES "cloud_providers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "parametric_policies_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "parametric_policies_sector_id_fkey" FOREIGN KEY ("sector_id") REFERENCES "ref_sector" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "parametric_policies_business_model_id_fkey" FOREIGN KEY ("business_model_id") REFERENCES "ref_business_model" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "parametric_policies_turnover_band_id_fkey" FOREIGN KEY ("turnover_band_id") REFERENCES "ref_turnover_band" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "parametric_policies_resilience_profile_id_fkey" FOREIGN KEY ("resilience_profile_id") REFERENCES "ref_resilience_profile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "parametric_policies_payout_function_config_id_fkey" FOREIGN KEY ("payout_function_config_id") REFERENCES "payout_function_configs" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "parametric_policies_underwritten_by_fkey" FOREIGN KEY ("underwritten_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "parametric_policies_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "enum_param_policy_status" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "parametric_policies_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "parametric_policies_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "parametric_policies_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "outage_events" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cloud_provider_id" INTEGER NOT NULL,
    "ioda_event_id" TEXT,
    "event_start" DATETIME NOT NULL,
    "event_end" DATETIME,
    "duration_seconds" INTEGER,
    "duration_hours" DECIMAL,
    "datasource" TEXT NOT NULL,
    "score" DECIMAL,
    "severity" TEXT,
    "ioda_raw_data" TEXT,
    "processed" INTEGER NOT NULL DEFAULT 0,
    "processed_at" DATETIME,
    "processing_batch_id" TEXT,
    "deleted_at" DATETIME,
    "deleted_by" INTEGER,
    "is_deleted" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "outage_events_cloud_provider_id_fkey" FOREIGN KEY ("cloud_provider_id") REFERENCES "cloud_providers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "merged_incidents" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cloud_provider_id" INTEGER NOT NULL,
    "incident_start" DATETIME NOT NULL,
    "incident_end" DATETIME NOT NULL,
    "duration_seconds" INTEGER NOT NULL,
    "duration_hours" DECIMAL NOT NULL,
    "n_raw_events" INTEGER NOT NULL DEFAULT 1,
    "max_score" DECIMAL,
    "avg_score" DECIMAL,
    "is_trigger_checked" INTEGER NOT NULL DEFAULT 0,
    "trigger_checked_at" DATETIME,
    "deleted_at" DATETIME,
    "deleted_by" INTEGER,
    "is_deleted" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "merged_incidents_cloud_provider_id_fkey" FOREIGN KEY ("cloud_provider_id") REFERENCES "cloud_providers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "incident_event_links" (
    "incident_id" INTEGER NOT NULL,
    "event_id" INTEGER NOT NULL,

    PRIMARY KEY ("incident_id", "event_id"),
    CONSTRAINT "incident_event_links_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "merged_incidents" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "incident_event_links_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "outage_events" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "trigger_events" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cloud_provider_id" INTEGER NOT NULL,
    "merged_incident_id" INTEGER,
    "sla_tier_id" INTEGER NOT NULL,
    "insured_hours" DECIMAL NOT NULL,
    "threshold_hours" DECIMAL NOT NULL,
    "affected_policies_count" INTEGER,
    "total_estimated_payout" DECIMAL,
    "claim_created" INTEGER NOT NULL DEFAULT 0,
    "claims_created_at" DATETIME,
    "admin_reviewed" INTEGER NOT NULL DEFAULT 0,
    "admin_reviewed_at" DATETIME,
    "admin_reviewed_by" INTEGER,
    "admin_notes" TEXT,
    "deleted_at" DATETIME,
    "deleted_by" INTEGER,
    "is_deleted" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "trigger_events_cloud_provider_id_fkey" FOREIGN KEY ("cloud_provider_id") REFERENCES "cloud_providers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "trigger_events_merged_incident_id_fkey" FOREIGN KEY ("merged_incident_id") REFERENCES "merged_incidents" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "trigger_events_sla_tier_id_fkey" FOREIGN KEY ("sla_tier_id") REFERENCES "enum_sla_tier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "trigger_events_admin_reviewed_by_fkey" FOREIGN KEY ("admin_reviewed_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "parametric_claims" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "claim_number" TEXT NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "policy_id" INTEGER NOT NULL,
    "trigger_event_id" INTEGER,
    "outage_duration_hours" DECIMAL NOT NULL,
    "hourly_payout_rate" DECIMAL NOT NULL,
    "payout_amount" DECIMAL NOT NULL,
    "payout_calculation_json" TEXT NOT NULL,
    "status_id" INTEGER,
    "auto_approved" INTEGER NOT NULL DEFAULT 0,
    "auto_approved_at" DATETIME,
    "auto_approval_threshold" DECIMAL,
    "admin_override" INTEGER NOT NULL DEFAULT 0,
    "admin_override_reason" TEXT,
    "admin_override_at" DATETIME,
    "reviewed_by" INTEGER,
    "reviewed_at" DATETIME,
    "review_notes" TEXT,
    "paid_by" INTEGER,
    "paid_at" DATETIME,
    "payout_transaction_id" TEXT,
    "payout_method" TEXT,
    "initial_reserve" DECIMAL,
    "current_reserve" DECIMAL,
    "reserve_adjusted_at" DATETIME,
    "reserve_adjusted_by" INTEGER,
    "reserve_adjustment_reason" TEXT,
    "deleted_at" DATETIME,
    "deleted_by" INTEGER,
    "deletion_reason" TEXT,
    "is_deleted" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "parametric_claims_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "parametric_claims_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "parametric_policies" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "parametric_claims_trigger_event_id_fkey" FOREIGN KEY ("trigger_event_id") REFERENCES "trigger_events" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "parametric_claims_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "enum_param_claim_status" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "parametric_claims_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "parametric_claims_paid_by_fkey" FOREIGN KEY ("paid_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "parametric_claims_reserve_adjusted_by_fkey" FOREIGN KEY ("reserve_adjusted_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "parametric_claims_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "parametric_claims_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "parametric_claims_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cyber_applications" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "application_number" TEXT NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "answers_json" TEXT NOT NULL,
    "answers_schema_version" INTEGER NOT NULL DEFAULT 1,
    "risk_score" DECIMAL NOT NULL,
    "security_posture_id" INTEGER NOT NULL,
    "calculated_premium" DECIMAL NOT NULL,
    "waiver_flags_json" TEXT NOT NULL DEFAULT '[]',
    "selected_coverages_json" TEXT NOT NULL DEFAULT '[]',
    "status_id" INTEGER,
    "submitted_at" DATETIME,
    "under_review_at" DATETIME,
    "under_review_by" INTEGER,
    "decision_at" DATETIME,
    "decision_by" INTEGER,
    "decision_notes" TEXT,
    "deleted_at" DATETIME,
    "deleted_by" INTEGER,
    "deletion_reason" TEXT,
    "is_deleted" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "cyber_applications_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "cyber_applications_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "cyber_applications_security_posture_id_fkey" FOREIGN KEY ("security_posture_id") REFERENCES "enum_security_posture" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "cyber_applications_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "enum_cyber_app_status" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "cyber_applications_under_review_by_fkey" FOREIGN KEY ("under_review_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "cyber_applications_decision_by_fkey" FOREIGN KEY ("decision_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "cyber_applications_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "cyber_applications_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "cyber_applications_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cyber_policies" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "policy_number" TEXT NOT NULL,
    "application_id" INTEGER NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "policy_limit" DECIMAL NOT NULL,
    "deductible_sir" DECIMAL NOT NULL DEFAULT 0,
    "premium" DECIMAL NOT NULL,
    "selected_coverages_json" TEXT NOT NULL,
    "endorsements_json" TEXT NOT NULL DEFAULT '[]',
    "exclusions_json" TEXT NOT NULL DEFAULT '[]',
    "status_id" INTEGER,
    "effective_date" DATETIME NOT NULL,
    "expiry_date" DATETIME NOT NULL,
    "cancellation_date" DATETIME,
    "cancellation_reason" TEXT,
    "cancellation_refund_amount" DECIMAL,
    "is_renewal" INTEGER NOT NULL DEFAULT 0,
    "parent_policy_id" INTEGER,
    "renewal_count" INTEGER NOT NULL DEFAULT 0,
    "total_claims_count" INTEGER NOT NULL DEFAULT 0,
    "total_claims_amount" DECIMAL NOT NULL DEFAULT 0,
    "deleted_at" DATETIME,
    "deleted_by" INTEGER,
    "deletion_reason" TEXT,
    "is_deleted" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "cyber_policies_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "cyber_applications" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "cyber_policies_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "cyber_policies_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "cyber_policies_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "enum_cyber_policy_status" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "cyber_policies_parent_policy_id_fkey" FOREIGN KEY ("parent_policy_id") REFERENCES "cyber_policies" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "cyber_policies_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "cyber_policies_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "cyber_policies_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cyber_claims" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "claim_number" TEXT NOT NULL,
    "policy_id" INTEGER NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "incident_date" DATETIME NOT NULL,
    "incident_discovered_date" DATETIME,
    "incident_type_id" INTEGER NOT NULL,
    "incident_description" TEXT NOT NULL,
    "estimated_loss" DECIMAL NOT NULL,
    "assigned_investigator" INTEGER,
    "investigation_started_at" DATETIME,
    "investigation_notes" TEXT,
    "adjusted_amount" DECIMAL,
    "adjusted_at" DATETIME,
    "adjusted_by" INTEGER,
    "adjustment_reason" TEXT,
    "approved_amount" DECIMAL,
    "approved_at" DATETIME,
    "approved_by" INTEGER,
    "approval_notes" TEXT,
    "paid_amount" DECIMAL,
    "paid_at" DATETIME,
    "paid_by" INTEGER,
    "payout_transaction_id" TEXT,
    "payout_method" TEXT,
    "status_id" INTEGER,
    "initial_reserve" DECIMAL,
    "current_reserve" DECIMAL,
    "reserve_adjusted_at" DATETIME,
    "reserve_adjusted_by" INTEGER,
    "reserve_adjustment_reason" TEXT,
    "deleted_at" DATETIME,
    "deleted_by" INTEGER,
    "deletion_reason" TEXT,
    "is_deleted" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "cyber_claims_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "cyber_policies" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "cyber_claims_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "cyber_claims_incident_type_id_fkey" FOREIGN KEY ("incident_type_id") REFERENCES "enum_incident_type" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "cyber_claims_assigned_investigator_fkey" FOREIGN KEY ("assigned_investigator") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "cyber_claims_adjusted_by_fkey" FOREIGN KEY ("adjusted_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "cyber_claims_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "cyber_claims_paid_by_fkey" FOREIGN KEY ("paid_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "cyber_claims_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "enum_cyber_claim_status" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "cyber_claims_reserve_adjusted_by_fkey" FOREIGN KEY ("reserve_adjusted_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "cyber_claims_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "cyber_claims_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "cyber_claims_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "parametric_claim_reserves" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "parametric_claim_id" INTEGER NOT NULL,
    "reserve_type" TEXT NOT NULL,
    "reserve_amount" DECIMAL NOT NULL,
    "reserve_currency" TEXT NOT NULL DEFAULT 'TND',
    "previous_amount" DECIMAL,
    "adjustment_amount" DECIMAL,
    "adjustment_reason" TEXT NOT NULL,
    "actuarial_method" TEXT,
    "confidence_level" DECIMAL,
    "deleted_at" DATETIME,
    "deleted_by" INTEGER,
    "is_deleted" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "parametric_claim_reserves_parametric_claim_id_fkey" FOREIGN KEY ("parametric_claim_id") REFERENCES "parametric_claims" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "parametric_claim_reserves_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "parametric_claim_reserves_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "parametric_claim_reserves_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cyber_claim_reserves" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cyber_claim_id" INTEGER NOT NULL,
    "reserve_type" TEXT NOT NULL,
    "reserve_amount" DECIMAL NOT NULL,
    "reserve_currency" TEXT NOT NULL DEFAULT 'TND',
    "previous_amount" DECIMAL,
    "adjustment_amount" DECIMAL,
    "adjustment_reason" TEXT NOT NULL,
    "actuarial_method" TEXT,
    "confidence_level" DECIMAL,
    "deleted_at" DATETIME,
    "deleted_by" INTEGER,
    "is_deleted" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "cyber_claim_reserves_cyber_claim_id_fkey" FOREIGN KEY ("cyber_claim_id") REFERENCES "cyber_claims" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "cyber_claim_reserves_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "cyber_claim_reserves_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "cyber_claim_reserves_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "reinsurance_treaties" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "treaty_number" TEXT NOT NULL,
    "treaty_name" TEXT NOT NULL,
    "reinsurer_name" TEXT NOT NULL,
    "reinsurer_contact" TEXT,
    "reinsurer_email" TEXT,
    "reinsurer_phone" TEXT,
    "treaty_type" TEXT NOT NULL,
    "treaty_start_date" DATETIME NOT NULL,
    "treaty_end_date" DATETIME NOT NULL,
    "cession_pct" DECIMAL,
    "retention_amount" DECIMAL,
    "limit_amount" DECIMAL,
    "attachment_point" DECIMAL,
    "reinsurance_premium_pct" DECIMAL,
    "profit_commission_pct" DECIMAL,
    "no_claim_bonus_pct" DECIMAL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "deleted_at" DATETIME,
    "deleted_by" INTEGER,
    "deletion_reason" TEXT,
    "is_deleted" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "reinsurance_treaties_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "reinsurance_treaties_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "reinsurance_treaties_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "parametric_reinsurance_ceded" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "treaty_id" INTEGER NOT NULL,
    "parametric_policy_id" INTEGER NOT NULL,
    "gross_premium" DECIMAL NOT NULL,
    "ceded_premium" DECIMAL NOT NULL,
    "net_premium" DECIMAL,
    "gross_claim_reserve" DECIMAL,
    "ceded_claim_reserve" DECIMAL,
    "gross_claim_paid" DECIMAL,
    "ceded_claim_paid" DECIMAL,
    "net_claim_paid" DECIMAL,
    "recovery_amount" DECIMAL,
    "recovery_date" DATETIME,
    "deleted_at" DATETIME,
    "deleted_by" INTEGER,
    "is_deleted" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "parametric_reinsurance_ceded_treaty_id_fkey" FOREIGN KEY ("treaty_id") REFERENCES "reinsurance_treaties" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "parametric_reinsurance_ceded_parametric_policy_id_fkey" FOREIGN KEY ("parametric_policy_id") REFERENCES "parametric_policies" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "parametric_reinsurance_ceded_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "parametric_reinsurance_ceded_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "parametric_reinsurance_ceded_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cyber_reinsurance_ceded" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "treaty_id" INTEGER NOT NULL,
    "cyber_policy_id" INTEGER NOT NULL,
    "gross_premium" DECIMAL NOT NULL,
    "ceded_premium" DECIMAL NOT NULL,
    "net_premium" DECIMAL,
    "gross_claim_reserve" DECIMAL,
    "ceded_claim_reserve" DECIMAL,
    "gross_claim_paid" DECIMAL,
    "ceded_claim_paid" DECIMAL,
    "net_claim_paid" DECIMAL,
    "recovery_amount" DECIMAL,
    "recovery_date" DATETIME,
    "deleted_at" DATETIME,
    "deleted_by" INTEGER,
    "is_deleted" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "cyber_reinsurance_ceded_treaty_id_fkey" FOREIGN KEY ("treaty_id") REFERENCES "reinsurance_treaties" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "cyber_reinsurance_ceded_cyber_policy_id_fkey" FOREIGN KEY ("cyber_policy_id") REFERENCES "cyber_policies" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "cyber_reinsurance_ceded_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "cyber_reinsurance_ceded_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "cyber_reinsurance_ceded_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "parametric_policy_endorsements" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "parametric_policy_id" INTEGER NOT NULL,
    "endorsement_number" TEXT NOT NULL,
    "endorsement_type" TEXT NOT NULL,
    "previous_values_json" TEXT NOT NULL,
    "new_values_json" TEXT NOT NULL,
    "change_description" TEXT NOT NULL,
    "premium_adjustment" DECIMAL NOT NULL DEFAULT 0,
    "premium_adjustment_type" TEXT,
    "effective_date" DATETIME NOT NULL,
    "processed_date" DATETIME,
    "requested_by" INTEGER,
    "approved_by" INTEGER,
    "approved_at" DATETIME,
    "approval_notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "deleted_at" DATETIME,
    "deleted_by" INTEGER,
    "is_deleted" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "parametric_policy_endorsements_parametric_policy_id_fkey" FOREIGN KEY ("parametric_policy_id") REFERENCES "parametric_policies" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "parametric_policy_endorsements_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "parametric_policy_endorsements_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "parametric_policy_endorsements_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cyber_policy_endorsements" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cyber_policy_id" INTEGER NOT NULL,
    "endorsement_number" TEXT NOT NULL,
    "endorsement_type" TEXT NOT NULL,
    "previous_values_json" TEXT NOT NULL,
    "new_values_json" TEXT NOT NULL,
    "change_description" TEXT NOT NULL,
    "premium_adjustment" DECIMAL NOT NULL DEFAULT 0,
    "premium_adjustment_type" TEXT,
    "effective_date" DATETIME NOT NULL,
    "processed_date" DATETIME,
    "requested_by" INTEGER,
    "approved_by" INTEGER,
    "approved_at" DATETIME,
    "approval_notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "deleted_at" DATETIME,
    "deleted_by" INTEGER,
    "is_deleted" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "cyber_policy_endorsements_cyber_policy_id_fkey" FOREIGN KEY ("cyber_policy_id") REFERENCES "cyber_policies" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "cyber_policy_endorsements_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "cyber_policy_endorsements_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "cyber_policy_endorsements_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "parametric_policy_renewals" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "parent_policy_id" INTEGER NOT NULL,
    "new_policy_id" INTEGER,
    "renewal_number" TEXT NOT NULL,
    "renewal_term_months" INTEGER NOT NULL DEFAULT 12,
    "previous_premium" DECIMAL NOT NULL,
    "new_premium" DECIMAL,
    "premium_adjustment_reason" TEXT,
    "claims_count_period" INTEGER NOT NULL DEFAULT 0,
    "claims_amount_period" DECIMAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "quoted_at" DATETIME,
    "quoted_by" INTEGER,
    "accepted_at" DATETIME,
    "declined_at" DATETIME,
    "declined_reason" TEXT,
    "deleted_at" DATETIME,
    "deleted_by" INTEGER,
    "is_deleted" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "parametric_policy_renewals_parent_policy_id_fkey" FOREIGN KEY ("parent_policy_id") REFERENCES "parametric_policies" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "parametric_policy_renewals_new_policy_id_fkey" FOREIGN KEY ("new_policy_id") REFERENCES "parametric_policies" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "parametric_policy_renewals_quoted_by_fkey" FOREIGN KEY ("quoted_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "parametric_policy_renewals_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cyber_policy_renewals" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "parent_policy_id" INTEGER NOT NULL,
    "new_policy_id" INTEGER,
    "renewal_number" TEXT NOT NULL,
    "renewal_term_months" INTEGER NOT NULL DEFAULT 12,
    "previous_premium" DECIMAL NOT NULL,
    "new_premium" DECIMAL,
    "premium_adjustment_reason" TEXT,
    "claims_count_period" INTEGER NOT NULL DEFAULT 0,
    "claims_amount_period" DECIMAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "quoted_at" DATETIME,
    "quoted_by" INTEGER,
    "accepted_at" DATETIME,
    "declined_at" DATETIME,
    "declined_reason" TEXT,
    "deleted_at" DATETIME,
    "deleted_by" INTEGER,
    "is_deleted" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "cyber_policy_renewals_parent_policy_id_fkey" FOREIGN KEY ("parent_policy_id") REFERENCES "cyber_policies" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "cyber_policy_renewals_new_policy_id_fkey" FOREIGN KEY ("new_policy_id") REFERENCES "cyber_policies" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "cyber_policy_renewals_quoted_by_fkey" FOREIGN KEY ("quoted_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "cyber_policy_renewals_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "workflow_policy_applications" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "application_number" TEXT NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "product_id" INTEGER,
    "provider_contract_pdf_url" TEXT,
    "insurance_policy_contract_pdf_url" TEXT,
    "signed_policy_contract_pdf_url" TEXT,
    "premium_amount" DECIMAL,
    "payment_transaction_id" TEXT,
    "payment_method" TEXT,
    "payment_status" TEXT,
    "premium_paid_at" DATETIME,
    "customer_signed_at" DATETIME,
    "customer_signature_ip" TEXT,
    "admin_final_signature_at" DATETIME,
    "admin_finalized_by" INTEGER,
    "admin_final_signature_ip" TEXT,
    "parametric_policy_id" INTEGER,
    "status_id" INTEGER,
    "rejected_by" INTEGER,
    "rejected_at" DATETIME,
    "rejection_reason" TEXT,
    "deleted_at" DATETIME,
    "deleted_by" INTEGER,
    "is_deleted" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "workflow_policy_applications_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "workflow_policy_applications_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "workflow_policy_applications_parametric_policy_id_fkey" FOREIGN KEY ("parametric_policy_id") REFERENCES "parametric_policies" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "workflow_policy_applications_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "enum_workflow_app_status" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "workflow_policy_applications_admin_finalized_by_fkey" FOREIGN KEY ("admin_finalized_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "workflow_policy_applications_rejected_by_fkey" FOREIGN KEY ("rejected_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "workflow_policy_applications_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "workflow_claims" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "claim_number" TEXT NOT NULL,
    "policy_application_id" INTEGER NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "declaration_of_loss_pdf_url" TEXT,
    "loss_amount" DECIMAL,
    "loss_start_date" DATETIME,
    "loss_end_date" DATETIME,
    "loss_description" TEXT,
    "payout_amount" DECIMAL,
    "payout_transaction_id" TEXT,
    "payout_method" TEXT,
    "status_id" INTEGER,
    "paid_by" INTEGER,
    "paid_at" DATETIME,
    "deleted_at" DATETIME,
    "deleted_by" INTEGER,
    "is_deleted" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "workflow_claims_policy_application_id_fkey" FOREIGN KEY ("policy_application_id") REFERENCES "workflow_policy_applications" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "workflow_claims_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "workflow_claims_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "enum_workflow_claim_status" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "workflow_claims_paid_by_fkey" FOREIGN KEY ("paid_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "workflow_claims_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "workflow_policy_tasks" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "policy_application_id" INTEGER NOT NULL,
    "actor_id" INTEGER NOT NULL,
    "action_required" TEXT NOT NULL,
    "action_details_json" TEXT NOT NULL DEFAULT '{}',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "due_date" DATETIME,
    "status_id" INTEGER,
    "completed_by" INTEGER,
    "completed_at" DATETIME,
    "completion_notes" TEXT,
    "deleted_at" DATETIME,
    "deleted_by" INTEGER,
    "is_deleted" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "workflow_policy_tasks_policy_application_id_fkey" FOREIGN KEY ("policy_application_id") REFERENCES "workflow_policy_applications" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "workflow_policy_tasks_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "enum_task_actor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "workflow_policy_tasks_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "enum_task_status" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "workflow_policy_tasks_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "workflow_policy_tasks_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "workflow_claim_tasks" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "workflow_claim_id" INTEGER NOT NULL,
    "actor_id" INTEGER NOT NULL,
    "action_required" TEXT NOT NULL,
    "action_details_json" TEXT NOT NULL DEFAULT '{}',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "due_date" DATETIME,
    "status_id" INTEGER,
    "completed_by" INTEGER,
    "completed_at" DATETIME,
    "completion_notes" TEXT,
    "deleted_at" DATETIME,
    "deleted_by" INTEGER,
    "is_deleted" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "workflow_claim_tasks_workflow_claim_id_fkey" FOREIGN KEY ("workflow_claim_id") REFERENCES "workflow_claims" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "workflow_claim_tasks_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "enum_task_actor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "workflow_claim_tasks_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "enum_task_status" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "workflow_claim_tasks_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "workflow_claim_tasks_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "uploaded_files" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "file_name" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size_bytes" INTEGER NOT NULL,
    "file_hash_sha256" TEXT NOT NULL,
    "file_category" TEXT NOT NULL,
    "virus_scan_status" TEXT NOT NULL DEFAULT 'PENDING',
    "virus_scan_result" TEXT,
    "virus_scanned_at" DATETIME,
    "uploaded_by" INTEGER NOT NULL,
    "parametric_policy_id" INTEGER,
    "cyber_policy_id" INTEGER,
    "parametric_claim_id" INTEGER,
    "cyber_claim_id" INTEGER,
    "workflow_policy_app_id" INTEGER,
    "workflow_claim_id" INTEGER,
    "is_public" INTEGER NOT NULL DEFAULT 0,
    "deleted_at" DATETIME,
    "deleted_by" INTEGER,
    "is_deleted" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "uploaded_files_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "uploaded_files_parametric_policy_id_fkey" FOREIGN KEY ("parametric_policy_id") REFERENCES "parametric_policies" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "uploaded_files_cyber_policy_id_fkey" FOREIGN KEY ("cyber_policy_id") REFERENCES "cyber_policies" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "uploaded_files_parametric_claim_id_fkey" FOREIGN KEY ("parametric_claim_id") REFERENCES "parametric_claims" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "uploaded_files_cyber_claim_id_fkey" FOREIGN KEY ("cyber_claim_id") REFERENCES "cyber_claims" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "uploaded_files_workflow_policy_app_id_fkey" FOREIGN KEY ("workflow_policy_app_id") REFERENCES "workflow_policy_applications" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "uploaded_files_workflow_claim_id_fkey" FOREIGN KEY ("workflow_claim_id") REFERENCES "workflow_claims" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "recipient_id" INTEGER NOT NULL,
    "notification_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "title_ar" TEXT,
    "message" TEXT NOT NULL,
    "message_ar" TEXT,
    "is_read" INTEGER NOT NULL DEFAULT 0,
    "read_at" DATETIME,
    "delivery_method" TEXT NOT NULL DEFAULT 'IN_APP',
    "email_sent" INTEGER NOT NULL DEFAULT 0,
    "email_sent_at" DATETIME,
    "sms_sent" INTEGER NOT NULL DEFAULT 0,
    "sms_sent_at" DATETIME,
    "parametric_policy_id" INTEGER,
    "cyber_policy_id" INTEGER,
    "parametric_claim_id" INTEGER,
    "cyber_claim_id" INTEGER,
    "deleted_at" DATETIME,
    "deleted_by" INTEGER,
    "is_deleted" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "notifications_parametric_policy_id_fkey" FOREIGN KEY ("parametric_policy_id") REFERENCES "parametric_policies" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "notifications_cyber_policy_id_fkey" FOREIGN KEY ("cyber_policy_id") REFERENCES "cyber_policies" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "notifications_parametric_claim_id_fkey" FOREIGN KEY ("parametric_claim_id") REFERENCES "parametric_claims" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "notifications_cyber_claim_id_fkey" FOREIGN KEY ("cyber_claim_id") REFERENCES "cyber_claims" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "notifications_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "session_id" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_active_at" DATETIME,
    "revoked_at" DATETIME,
    "expires_at" DATETIME,
    "refresh_token_hash" TEXT,
    "refresh_token_expires_at" DATETIME,
    CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" DATETIME NOT NULL,
    "used_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "email_verification_tokens" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" DATETIME NOT NULL,
    "verified_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "email_verification_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "endpoint" TEXT,
    "path" TEXT,
    "method" TEXT,
    "user_id" INTEGER,
    "payload_hash" TEXT,
    "response" TEXT,
    "response_status" INTEGER,
    "response_body" TEXT,
    "used_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "policy_cancellations" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "parametric_policy_id" INTEGER NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "cancellation_reason" TEXT NOT NULL,
    "cancellation_category" TEXT NOT NULL,
    "refund_amount" DECIMAL NOT NULL,
    "refund_status" TEXT NOT NULL DEFAULT 'PENDING',
    "refund_processed_at" DATETIME,
    "effective_date" DATETIME NOT NULL,
    "cancellation_initiated_by" INTEGER NOT NULL,
    "refund_processed_by" INTEGER,
    "remarks" TEXT,
    "deleted_at" DATETIME,
    "deleted_by" INTEGER,
    "is_deleted" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "policy_cancellations_parametric_policy_id_fkey" FOREIGN KEY ("parametric_policy_id") REFERENCES "parametric_policies" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "policy_cancellations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "policy_cancellations_cancellation_initiated_by_fkey" FOREIGN KEY ("cancellation_initiated_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "policy_cancellations_refund_processed_by_fkey" FOREIGN KEY ("refund_processed_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "policy_cancellations_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "claim_appeals" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "param_claim_id" INTEGER,
    "workflow_claim_id" INTEGER,
    "customer_id" INTEGER NOT NULL,
    "appeal_reason" TEXT NOT NULL,
    "appeal_justification" TEXT,
    "supporting_document_url" TEXT,
    "appeal_status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "reviewed_by" INTEGER,
    "review_notes" TEXT,
    "reviewed_at" DATETIME,
    "appeal_decision" TEXT,
    "appeal_decision_amount" DECIMAL,
    "appeal_withdrawn_at" DATETIME,
    "appeal_withdrawn_by" INTEGER,
    "deleted_at" DATETIME,
    "deleted_by" INTEGER,
    "is_deleted" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "claim_appeals_param_claim_id_fkey" FOREIGN KEY ("param_claim_id") REFERENCES "parametric_claims" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "claim_appeals_workflow_claim_id_fkey" FOREIGN KEY ("workflow_claim_id") REFERENCES "workflow_claims" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "claim_appeals_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "claim_appeals_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "claim_appeals_appeal_withdrawn_by_fkey" FOREIGN KEY ("appeal_withdrawn_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "claim_appeals_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "claim_rejections" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "param_claim_id" INTEGER,
    "workflow_claim_id" INTEGER,
    "customer_id" INTEGER NOT NULL,
    "rejection_reason" TEXT NOT NULL,
    "rejection_category" TEXT NOT NULL,
    "rejected_by" INTEGER NOT NULL,
    "rejection_notes" TEXT,
    "rejected_at" DATETIME NOT NULL,
    "appeal_deadline_date" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    "deleted_by" INTEGER,
    "is_deleted" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "claim_rejections_param_claim_id_fkey" FOREIGN KEY ("param_claim_id") REFERENCES "parametric_claims" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "claim_rejections_workflow_claim_id_fkey" FOREIGN KEY ("workflow_claim_id") REFERENCES "workflow_claims" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "claim_rejections_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "claim_rejections_rejected_by_fkey" FOREIGN KEY ("rejected_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "claim_rejections_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "underwriting_notes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "parametric_policy_id" INTEGER,
    "workflow_app_id" INTEGER,
    "cyber_application_id" INTEGER,
    "created_by" INTEGER NOT NULL,
    "noteText" TEXT NOT NULL,
    "note_category" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "is_internal" INTEGER NOT NULL DEFAULT 1,
    "deleted_at" DATETIME,
    "deleted_by" INTEGER,
    "is_deleted" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "underwriting_notes_parametric_policy_id_fkey" FOREIGN KEY ("parametric_policy_id") REFERENCES "parametric_policies" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "underwriting_notes_workflow_app_id_fkey" FOREIGN KEY ("workflow_app_id") REFERENCES "workflow_policy_applications" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "underwriting_notes_cyber_application_id_fkey" FOREIGN KEY ("cyber_application_id") REFERENCES "cyber_applications" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "underwriting_notes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "underwriting_notes_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "recipient_id" INTEGER NOT NULL,
    "notification_type" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "send_attempts" INTEGER NOT NULL DEFAULT 0,
    "last_attempt_at" DATETIME,
    "sent_at" DATETIME,
    "failure_reason" TEXT,
    "next_retry_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notification_logs_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "contact_submissions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone_number" TEXT,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "message_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "responded_by" INTEGER,
    "response_note" TEXT,
    "responded_at" DATETIME,
    "closed_at" DATETIME,
    "deleted_at" DATETIME,
    "deleted_by" INTEGER,
    "is_deleted" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "contact_submissions_responded_by_fkey" FOREIGN KEY ("responded_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "contact_submissions_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ioda_claim_suggestions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ioda_alert_id" TEXT,
    "parametric_policy_id" INTEGER NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "outage_description" TEXT NOT NULL,
    "affected_providers" TEXT NOT NULL,
    "detection_timestamp" DATETIME NOT NULL,
    "impact_level" TEXT NOT NULL,
    "est_affected_users" INTEGER,
    "est_downtime_mins" INTEGER,
    "suggested_claim_amount" DECIMAL,
    "draft_claim_status" TEXT NOT NULL DEFAULT 'DRAFT',
    "claimed_at" DATETIME,
    "claimed_by" INTEGER,
    "ignored_at" DATETIME,
    "ignored_by" INTEGER,
    "flagged_as_false_positive" INTEGER NOT NULL DEFAULT 0,
    "false_positive_by" INTEGER,
    "deleted_at" DATETIME,
    "deleted_by" INTEGER,
    "is_deleted" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ioda_claim_suggestions_parametric_policy_id_fkey" FOREIGN KEY ("parametric_policy_id") REFERENCES "parametric_policies" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ioda_claim_suggestions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ioda_claim_suggestions_claimed_by_fkey" FOREIGN KEY ("claimed_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ioda_claim_suggestions_ignored_by_fkey" FOREIGN KEY ("ignored_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ioda_claim_suggestions_false_positive_by_fkey" FOREIGN KEY ("false_positive_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ioda_claim_suggestions_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "policies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category_id" TEXT NOT NULL,
    "policy_name" TEXT NOT NULL,
    "sum_assurance" INTEGER NOT NULL,
    "premium" INTEGER NOT NULL,
    "tenure" INTEGER NOT NULL,
    "is_deleted" INTEGER NOT NULL DEFAULT 0,
    "deleted_at" DATETIME,
    "deleted_by" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "policy_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customer_id" TEXT NOT NULL,
    "policy_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "policy_records_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "policies" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_setting_key_valid_from_key" ON "system_settings"("setting_key", "valid_from");

-- CreateIndex
CREATE INDEX "idx_audit_time" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "idx_audit_entity" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "idx_audit_actor" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "idx_audit_actor_time" ON "audit_logs"("actor_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_audit_action" ON "audit_logs"("action_category");

-- CreateIndex
CREATE INDEX "idx_audit_correlation" ON "audit_logs"("correlation_id");

-- CreateIndex
CREATE UNIQUE INDEX "enum_user_role_role_code_key" ON "enum_user_role"("role_code");

-- CreateIndex
CREATE UNIQUE INDEX "enum_product_type_type_code_key" ON "enum_product_type"("type_code");

-- CreateIndex
CREATE UNIQUE INDEX "enum_sla_tier_tier_code_key" ON "enum_sla_tier"("tier_code");

-- CreateIndex
CREATE UNIQUE INDEX "enum_param_policy_status_status_code_key" ON "enum_param_policy_status"("status_code");

-- CreateIndex
CREATE UNIQUE INDEX "enum_param_claim_status_status_code_key" ON "enum_param_claim_status"("status_code");

-- CreateIndex
CREATE UNIQUE INDEX "enum_cyber_app_status_status_code_key" ON "enum_cyber_app_status"("status_code");

-- CreateIndex
CREATE INDEX "idx_fraud_user" ON "fraud_detection_results"("user_id");

-- CreateIndex
CREATE INDEX "idx_fraud_verdict" ON "fraud_detection_results"("verdict");

-- CreateIndex
CREATE INDEX "idx_fraud_time" ON "fraud_detection_results"("created_at");

-- CreateIndex
CREATE INDEX "idx_ip_reputation_score" ON "ip_reputation"("risk_score");

-- CreateIndex
CREATE INDEX "idx_device_risk_score" ON "device_fingerprints"("risk_score");

-- CreateIndex
CREATE UNIQUE INDEX "enum_cyber_policy_status_status_code_key" ON "enum_cyber_policy_status"("status_code");

-- CreateIndex
CREATE UNIQUE INDEX "enum_cyber_claim_status_status_code_key" ON "enum_cyber_claim_status"("status_code");

-- CreateIndex
CREATE UNIQUE INDEX "enum_security_posture_posture_code_key" ON "enum_security_posture"("posture_code");

-- CreateIndex
CREATE UNIQUE INDEX "enum_incident_type_type_code_key" ON "enum_incident_type"("type_code");

-- CreateIndex
CREATE UNIQUE INDEX "enum_workflow_app_status_status_code_key" ON "enum_workflow_app_status"("status_code");

-- CreateIndex
CREATE UNIQUE INDEX "enum_workflow_claim_status_status_code_key" ON "enum_workflow_claim_status"("status_code");

-- CreateIndex
CREATE UNIQUE INDEX "enum_task_actor_actor_code_key" ON "enum_task_actor"("actor_code");

-- CreateIndex
CREATE UNIQUE INDEX "enum_task_status_status_code_key" ON "enum_task_status"("status_code");

-- CreateIndex
CREATE UNIQUE INDEX "enum_question_type_type_code_key" ON "enum_question_type"("type_code");

-- CreateIndex
CREATE UNIQUE INDEX "ref_sector_sector_code_key" ON "ref_sector"("sector_code");

-- CreateIndex
CREATE UNIQUE INDEX "ref_business_model_model_code_key" ON "ref_business_model"("model_code");

-- CreateIndex
CREATE UNIQUE INDEX "ref_resilience_profile_profile_code_key" ON "ref_resilience_profile"("profile_code");

-- CreateIndex
CREATE UNIQUE INDEX "ref_turnover_band_band_code_key" ON "ref_turnover_band"("band_code");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_users_email" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_users_role" ON "users"("role_id");

-- CreateIndex
CREATE INDEX "idx_users_deleted_by" ON "users"("deleted_by");

-- CreateIndex
CREATE UNIQUE INDEX "customers_user_id_key" ON "customers"("user_id");

-- CreateIndex
CREATE INDEX "idx_customers_user" ON "customers"("user_id");

-- CreateIndex
CREATE INDEX "idx_customers_company" ON "customers"("company_name");

-- CreateIndex
CREATE INDEX "idx_customers_sector" ON "customers"("sector_id");

-- CreateIndex
CREATE INDEX "idx_customers_deleted_by" ON "customers"("deleted_by");

-- CreateIndex
CREATE UNIQUE INDEX "categories_code_key" ON "categories"("code");

-- CreateIndex
CREATE UNIQUE INDEX "products_product_code_key" ON "products"("product_code");

-- CreateIndex
CREATE UNIQUE INDEX "coverage_grants_product_id_coverage_code_key" ON "coverage_grants"("product_id", "coverage_code");

-- CreateIndex
CREATE UNIQUE INDEX "product_exclusions_product_id_exclusion_code_key" ON "product_exclusions"("product_id", "exclusion_code");

-- CreateIndex
CREATE UNIQUE INDEX "underwriting_questions_product_id_field_name_key" ON "underwriting_questions"("product_id", "field_name");

-- CreateIndex
CREATE UNIQUE INDEX "cloud_providers_asn_key" ON "cloud_providers"("asn");

-- CreateIndex
CREATE UNIQUE INDEX "payout_function_configs_config_code_key" ON "payout_function_configs"("config_code");

-- CreateIndex
CREATE UNIQUE INDEX "parametric_policies_policy_number_key" ON "parametric_policies"("policy_number");

-- CreateIndex
CREATE INDEX "idx_param_policies_customer" ON "parametric_policies"("customer_id");

-- CreateIndex
CREATE INDEX "idx_param_policies_provider" ON "parametric_policies"("cloud_provider_id");

-- CreateIndex
CREATE INDEX "idx_param_policies_product" ON "parametric_policies"("product_id");

-- CreateIndex
CREATE INDEX "idx_param_policies_status" ON "parametric_policies"("status_id");

-- CreateIndex
CREATE INDEX "idx_param_policies_dates" ON "parametric_policies"("effective_date", "expiry_date");

-- CreateIndex
CREATE INDEX "idx_param_policies_payout_config" ON "parametric_policies"("payout_function_config_id");

-- CreateIndex
CREATE INDEX "idx_param_policies_deleted_by" ON "parametric_policies"("deleted_by");

-- CreateIndex
CREATE INDEX "idx_outage_provider" ON "outage_events"("cloud_provider_id");

-- CreateIndex
CREATE INDEX "idx_outage_processed" ON "outage_events"("processed");

-- CreateIndex
CREATE INDEX "idx_outage_dates" ON "outage_events"("event_start", "event_end");

-- CreateIndex
CREATE INDEX "idx_outage_batch" ON "outage_events"("processing_batch_id");

-- CreateIndex
CREATE INDEX "idx_outage_deleted_by" ON "outage_events"("deleted_by");

-- CreateIndex
CREATE INDEX "idx_merged_provider" ON "merged_incidents"("cloud_provider_id");

-- CreateIndex
CREATE INDEX "idx_merged_trigger" ON "merged_incidents"("is_trigger_checked");

-- CreateIndex
CREATE INDEX "idx_merged_deleted_by" ON "merged_incidents"("deleted_by");

-- CreateIndex
CREATE UNIQUE INDEX "trigger_events_merged_incident_id_key" ON "trigger_events"("merged_incident_id");

-- CreateIndex
CREATE INDEX "idx_trigger_provider" ON "trigger_events"("cloud_provider_id");

-- CreateIndex
CREATE INDEX "idx_trigger_claim" ON "trigger_events"("claim_created");

-- CreateIndex
CREATE INDEX "idx_trigger_incident" ON "trigger_events"("merged_incident_id");

-- CreateIndex
CREATE INDEX "idx_trigger_deleted_by" ON "trigger_events"("deleted_by");

-- CreateIndex
CREATE UNIQUE INDEX "parametric_claims_claim_number_key" ON "parametric_claims"("claim_number");

-- CreateIndex
CREATE INDEX "idx_param_claims_policy" ON "parametric_claims"("policy_id");

-- CreateIndex
CREATE INDEX "idx_param_claims_customer" ON "parametric_claims"("customer_id");

-- CreateIndex
CREATE INDEX "idx_param_claims_status" ON "parametric_claims"("status_id");

-- CreateIndex
CREATE INDEX "idx_param_claims_trigger" ON "parametric_claims"("trigger_event_id");

-- CreateIndex
CREATE INDEX "idx_param_claims_reviewed_by" ON "parametric_claims"("reviewed_by");

-- CreateIndex
CREATE INDEX "idx_param_claims_paid_by" ON "parametric_claims"("paid_by");

-- CreateIndex
CREATE INDEX "idx_param_claims_deleted_by" ON "parametric_claims"("deleted_by");

-- CreateIndex
CREATE UNIQUE INDEX "cyber_applications_application_number_key" ON "cyber_applications"("application_number");

-- CreateIndex
CREATE UNIQUE INDEX "cyber_policies_policy_number_key" ON "cyber_policies"("policy_number");

-- CreateIndex
CREATE UNIQUE INDEX "cyber_policies_application_id_key" ON "cyber_policies"("application_id");

-- CreateIndex
CREATE INDEX "idx_cyber_policies_customer" ON "cyber_policies"("customer_id");

-- CreateIndex
CREATE INDEX "idx_cyber_policies_status" ON "cyber_policies"("status_id");

-- CreateIndex
CREATE INDEX "idx_cyber_policies_app" ON "cyber_policies"("application_id");

-- CreateIndex
CREATE INDEX "idx_cyber_policies_product" ON "cyber_policies"("product_id");

-- CreateIndex
CREATE INDEX "idx_cyber_policies_parent" ON "cyber_policies"("parent_policy_id");

-- CreateIndex
CREATE INDEX "idx_cyber_policies_deleted_by" ON "cyber_policies"("deleted_by");

-- CreateIndex
CREATE UNIQUE INDEX "cyber_claims_claim_number_key" ON "cyber_claims"("claim_number");

-- CreateIndex
CREATE INDEX "idx_cyber_claims_policy" ON "cyber_claims"("policy_id");

-- CreateIndex
CREATE INDEX "idx_cyber_claims_status" ON "cyber_claims"("status_id");

-- CreateIndex
CREATE INDEX "idx_cyber_claims_incident" ON "cyber_claims"("incident_date");

-- CreateIndex
CREATE INDEX "idx_cyber_claims_investigator" ON "cyber_claims"("assigned_investigator");

-- CreateIndex
CREATE INDEX "idx_cyber_claims_approved_by" ON "cyber_claims"("approved_by");

-- CreateIndex
CREATE INDEX "idx_cyber_claims_paid_by" ON "cyber_claims"("paid_by");

-- CreateIndex
CREATE INDEX "idx_cyber_claims_deleted_by" ON "cyber_claims"("deleted_by");

-- CreateIndex
CREATE INDEX "idx_param_reserve_claim" ON "parametric_claim_reserves"("parametric_claim_id");

-- CreateIndex
CREATE INDEX "idx_param_reserve_type" ON "parametric_claim_reserves"("reserve_type");

-- CreateIndex
CREATE INDEX "idx_param_reserve_deleted_by" ON "parametric_claim_reserves"("deleted_by");

-- CreateIndex
CREATE INDEX "idx_cyber_reserve_claim" ON "cyber_claim_reserves"("cyber_claim_id");

-- CreateIndex
CREATE INDEX "idx_cyber_reserve_type" ON "cyber_claim_reserves"("reserve_type");

-- CreateIndex
CREATE INDEX "idx_cyber_reserve_deleted_by" ON "cyber_claim_reserves"("deleted_by");

-- CreateIndex
CREATE UNIQUE INDEX "reinsurance_treaties_treaty_number_key" ON "reinsurance_treaties"("treaty_number");

-- CreateIndex
CREATE INDEX "idx_treaty_status" ON "reinsurance_treaties"("status");

-- CreateIndex
CREATE INDEX "idx_treaty_deleted_by" ON "reinsurance_treaties"("deleted_by");

-- CreateIndex
CREATE INDEX "idx_param_ceded_treaty" ON "parametric_reinsurance_ceded"("treaty_id");

-- CreateIndex
CREATE INDEX "idx_param_ceded_policy" ON "parametric_reinsurance_ceded"("parametric_policy_id");

-- CreateIndex
CREATE INDEX "idx_param_ceded_deleted_by" ON "parametric_reinsurance_ceded"("deleted_by");

-- CreateIndex
CREATE UNIQUE INDEX "parametric_reinsurance_ceded_treaty_id_parametric_policy_id_key" ON "parametric_reinsurance_ceded"("treaty_id", "parametric_policy_id");

-- CreateIndex
CREATE INDEX "idx_cyber_ceded_treaty" ON "cyber_reinsurance_ceded"("treaty_id");

-- CreateIndex
CREATE INDEX "idx_cyber_ceded_policy" ON "cyber_reinsurance_ceded"("cyber_policy_id");

-- CreateIndex
CREATE INDEX "idx_cyber_ceded_deleted_by" ON "cyber_reinsurance_ceded"("deleted_by");

-- CreateIndex
CREATE UNIQUE INDEX "cyber_reinsurance_ceded_treaty_id_cyber_policy_id_key" ON "cyber_reinsurance_ceded"("treaty_id", "cyber_policy_id");

-- CreateIndex
CREATE UNIQUE INDEX "parametric_policy_endorsements_endorsement_number_key" ON "parametric_policy_endorsements"("endorsement_number");

-- CreateIndex
CREATE INDEX "idx_param_endorsement_policy" ON "parametric_policy_endorsements"("parametric_policy_id");

-- CreateIndex
CREATE INDEX "idx_param_endorsement_status" ON "parametric_policy_endorsements"("status");

-- CreateIndex
CREATE INDEX "idx_param_endorsement_approved_by" ON "parametric_policy_endorsements"("approved_by");

-- CreateIndex
CREATE INDEX "idx_param_endorsement_deleted_by" ON "parametric_policy_endorsements"("deleted_by");

-- CreateIndex
CREATE UNIQUE INDEX "cyber_policy_endorsements_endorsement_number_key" ON "cyber_policy_endorsements"("endorsement_number");

-- CreateIndex
CREATE INDEX "idx_cyber_endorsement_policy" ON "cyber_policy_endorsements"("cyber_policy_id");

-- CreateIndex
CREATE INDEX "idx_cyber_endorsement_status" ON "cyber_policy_endorsements"("status");

-- CreateIndex
CREATE INDEX "idx_cyber_endorsement_approved_by" ON "cyber_policy_endorsements"("approved_by");

-- CreateIndex
CREATE INDEX "idx_cyber_endorsement_deleted_by" ON "cyber_policy_endorsements"("deleted_by");

-- CreateIndex
CREATE UNIQUE INDEX "parametric_policy_renewals_renewal_number_key" ON "parametric_policy_renewals"("renewal_number");

-- CreateIndex
CREATE INDEX "idx_param_renewal_parent" ON "parametric_policy_renewals"("parent_policy_id");

-- CreateIndex
CREATE INDEX "idx_param_renewal_status" ON "parametric_policy_renewals"("status");

-- CreateIndex
CREATE INDEX "idx_param_renewal_quoted_by" ON "parametric_policy_renewals"("quoted_by");

-- CreateIndex
CREATE INDEX "idx_param_renewal_deleted_by" ON "parametric_policy_renewals"("deleted_by");

-- CreateIndex
CREATE UNIQUE INDEX "cyber_policy_renewals_renewal_number_key" ON "cyber_policy_renewals"("renewal_number");

-- CreateIndex
CREATE INDEX "idx_cyber_renewal_parent" ON "cyber_policy_renewals"("parent_policy_id");

-- CreateIndex
CREATE INDEX "idx_cyber_renewal_status" ON "cyber_policy_renewals"("status");

-- CreateIndex
CREATE INDEX "idx_cyber_renewal_quoted_by" ON "cyber_policy_renewals"("quoted_by");

-- CreateIndex
CREATE INDEX "idx_cyber_renewal_deleted_by" ON "cyber_policy_renewals"("deleted_by");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_policy_applications_application_number_key" ON "workflow_policy_applications"("application_number");

-- CreateIndex
CREATE INDEX "idx_workflow_app_customer" ON "workflow_policy_applications"("customer_id");

-- CreateIndex
CREATE INDEX "idx_workflow_app_status" ON "workflow_policy_applications"("status_id");

-- CreateIndex
CREATE INDEX "idx_workflow_app_parametric_policy" ON "workflow_policy_applications"("parametric_policy_id");

-- CreateIndex
CREATE INDEX "idx_workflow_app_finalized_by" ON "workflow_policy_applications"("admin_finalized_by");

-- CreateIndex
CREATE INDEX "idx_workflow_app_rejected_by" ON "workflow_policy_applications"("rejected_by");

-- CreateIndex
CREATE INDEX "idx_workflow_app_deleted_by" ON "workflow_policy_applications"("deleted_by");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_claims_claim_number_key" ON "workflow_claims"("claim_number");

-- CreateIndex
CREATE INDEX "idx_workflow_claim_policy" ON "workflow_claims"("policy_application_id");

-- CreateIndex
CREATE INDEX "idx_workflow_claim_status" ON "workflow_claims"("status_id");

-- CreateIndex
CREATE INDEX "idx_workflow_claim_paid_by" ON "workflow_claims"("paid_by");

-- CreateIndex
CREATE INDEX "idx_workflow_claim_deleted_by" ON "workflow_claims"("deleted_by");

-- CreateIndex
CREATE INDEX "idx_policy_tasks_app" ON "workflow_policy_tasks"("policy_application_id");

-- CreateIndex
CREATE INDEX "idx_policy_tasks_actor" ON "workflow_policy_tasks"("actor_id", "status_id");

-- CreateIndex
CREATE INDEX "idx_policy_tasks_due" ON "workflow_policy_tasks"("due_date");

-- CreateIndex
CREATE INDEX "idx_policy_tasks_completed_by" ON "workflow_policy_tasks"("completed_by");

-- CreateIndex
CREATE INDEX "idx_policy_tasks_deleted_by" ON "workflow_policy_tasks"("deleted_by");

-- CreateIndex
CREATE INDEX "idx_claim_tasks_claim" ON "workflow_claim_tasks"("workflow_claim_id");

-- CreateIndex
CREATE INDEX "idx_claim_tasks_actor" ON "workflow_claim_tasks"("actor_id", "status_id");

-- CreateIndex
CREATE INDEX "idx_claim_tasks_due" ON "workflow_claim_tasks"("due_date");

-- CreateIndex
CREATE INDEX "idx_claim_tasks_completed_by" ON "workflow_claim_tasks"("completed_by");

-- CreateIndex
CREATE INDEX "idx_claim_tasks_deleted_by" ON "workflow_claim_tasks"("deleted_by");

-- CreateIndex
CREATE INDEX "idx_files_param_policy" ON "uploaded_files"("parametric_policy_id");

-- CreateIndex
CREATE INDEX "idx_files_cyber_policy" ON "uploaded_files"("cyber_policy_id");

-- CreateIndex
CREATE INDEX "idx_files_param_claim" ON "uploaded_files"("parametric_claim_id");

-- CreateIndex
CREATE INDEX "idx_files_cyber_claim" ON "uploaded_files"("cyber_claim_id");

-- CreateIndex
CREATE INDEX "idx_files_workflow_app" ON "uploaded_files"("workflow_policy_app_id");

-- CreateIndex
CREATE INDEX "idx_files_workflow_claim" ON "uploaded_files"("workflow_claim_id");

-- CreateIndex
CREATE INDEX "idx_files_category" ON "uploaded_files"("file_category");

-- CreateIndex
CREATE INDEX "idx_files_uploaded_by" ON "uploaded_files"("uploaded_by");

-- CreateIndex
CREATE INDEX "idx_files_deleted_by" ON "uploaded_files"("deleted_by");

-- CreateIndex
CREATE INDEX "idx_notif_recipient" ON "notifications"("recipient_id", "is_read");

-- CreateIndex
CREATE INDEX "idx_notif_type" ON "notifications"("notification_type");

-- CreateIndex
CREATE INDEX "idx_notif_param_policy" ON "notifications"("parametric_policy_id");

-- CreateIndex
CREATE INDEX "idx_notif_cyber_policy" ON "notifications"("cyber_policy_id");

-- CreateIndex
CREATE INDEX "idx_notif_param_claim" ON "notifications"("parametric_claim_id");

-- CreateIndex
CREATE INDEX "idx_notif_cyber_claim" ON "notifications"("cyber_claim_id");

-- CreateIndex
CREATE INDEX "idx_notif_deleted_by" ON "notifications"("deleted_by");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_session_id_key" ON "user_sessions"("session_id");

-- CreateIndex
CREATE INDEX "idx_user_session_user" ON "user_sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "idx_pwd_reset_expiry" ON "password_reset_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "idx_pwd_reset_user" ON "password_reset_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_verification_tokens_token_hash_key" ON "email_verification_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "idx_email_verify_expiry" ON "email_verification_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "idx_email_verify_user" ON "email_verification_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_key_key" ON "idempotency_keys"("key");

-- CreateIndex
CREATE INDEX "idx_idempotency_expiry" ON "idempotency_keys"("expires_at");

-- CreateIndex
CREATE INDEX "idx_idempotency_key" ON "idempotency_keys"("key");

-- CreateIndex
CREATE INDEX "idx_idempotency_user" ON "idempotency_keys"("user_id");

-- CreateIndex
CREATE INDEX "idx_cancellation_policy" ON "policy_cancellations"("parametric_policy_id");

-- CreateIndex
CREATE INDEX "idx_cancellation_customer" ON "policy_cancellations"("customer_id");

-- CreateIndex
CREATE INDEX "idx_cancellation_refund_status" ON "policy_cancellations"("refund_status");

-- CreateIndex
CREATE INDEX "idx_cancellation_date" ON "policy_cancellations"("created_at");

-- CreateIndex
CREATE INDEX "idx_appeal_param_claim" ON "claim_appeals"("param_claim_id");

-- CreateIndex
CREATE INDEX "idx_appeal_workflow_claim" ON "claim_appeals"("workflow_claim_id");

-- CreateIndex
CREATE INDEX "idx_appeal_customer" ON "claim_appeals"("customer_id");

-- CreateIndex
CREATE INDEX "idx_appeal_status" ON "claim_appeals"("appeal_status");

-- CreateIndex
CREATE INDEX "idx_appeal_date" ON "claim_appeals"("created_at");

-- CreateIndex
CREATE INDEX "idx_rejection_param_claim" ON "claim_rejections"("param_claim_id");

-- CreateIndex
CREATE INDEX "idx_rejection_workflow_claim" ON "claim_rejections"("workflow_claim_id");

-- CreateIndex
CREATE INDEX "idx_rejection_customer" ON "claim_rejections"("customer_id");

-- CreateIndex
CREATE INDEX "idx_rejection_category" ON "claim_rejections"("rejection_category");

-- CreateIndex
CREATE INDEX "idx_rejection_date" ON "claim_rejections"("rejected_at");

-- CreateIndex
CREATE INDEX "idx_note_param_policy" ON "underwriting_notes"("parametric_policy_id");

-- CreateIndex
CREATE INDEX "idx_note_workflow_app" ON "underwriting_notes"("workflow_app_id");

-- CreateIndex
CREATE INDEX "idx_note_cyber_app" ON "underwriting_notes"("cyber_application_id");

-- CreateIndex
CREATE INDEX "idx_note_creator" ON "underwriting_notes"("created_by");

-- CreateIndex
CREATE INDEX "idx_note_category" ON "underwriting_notes"("note_category");

-- CreateIndex
CREATE INDEX "idx_notif_log_recipient_status" ON "notification_logs"("recipient_id", "status");

-- CreateIndex
CREATE INDEX "idx_notif_log_type" ON "notification_logs"("notification_type");

-- CreateIndex
CREATE INDEX "idx_notif_log_status" ON "notification_logs"("status");

-- CreateIndex
CREATE INDEX "idx_notif_log_retry" ON "notification_logs"("next_retry_at");

-- CreateIndex
CREATE INDEX "idx_contact_status" ON "contact_submissions"("status");

-- CreateIndex
CREATE INDEX "idx_contact_type" ON "contact_submissions"("message_type");

-- CreateIndex
CREATE INDEX "idx_contact_date" ON "contact_submissions"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "ioda_claim_suggestions_ioda_alert_id_key" ON "ioda_claim_suggestions"("ioda_alert_id");

-- CreateIndex
CREATE INDEX "idx_ioda_suggestion_policy" ON "ioda_claim_suggestions"("parametric_policy_id");

-- CreateIndex
CREATE INDEX "idx_ioda_suggestion_customer" ON "ioda_claim_suggestions"("customer_id");

-- CreateIndex
CREATE INDEX "idx_ioda_suggestion_status" ON "ioda_claim_suggestions"("draft_claim_status");

-- CreateIndex
CREATE INDEX "idx_ioda_suggestion_timestamp" ON "ioda_claim_suggestions"("detection_timestamp");
