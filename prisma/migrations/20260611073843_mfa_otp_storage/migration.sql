-- CreateTable
CREATE TABLE "mfa_otps" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "code_hash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'login',
    "verify_attempts" INTEGER NOT NULL DEFAULT 0,
    "used_at" DATETIME,
    "expires_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mfa_otps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "idx_mfa_otp_user" ON "mfa_otps"("user_id");

-- CreateIndex
CREATE INDEX "idx_mfa_otp_expires" ON "mfa_otps"("expires_at");
