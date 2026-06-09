# AI Fake Account Detection and Fraud System

## Overview

The AI Fake Account Detection and Fraud System is a comprehensive solution designed to detect fake accounts, fraudulent behavior, and suspicious activities on the platform. It combines rule-based detection with machine learning analysis to identify potential threats.

## Features

### 1. Rule-Based Detection
The system uses 14 different rules to assess the risk of each account:
1. Multiple accounts from same IP
2. Multiple accounts from same device
3. Account created with VPN/proxy
4. Account created with Tor exit node
5. Recent registration from high-risk country
6. Account with mismatched name/email
7. Account with generic/suspicious name
8. Account with numeric username suffix
9. Failed login history
10. Account locked status
11. Disposable email check
12. Bot username pattern
13. Email name mismatch
14. No website for business account

### 2. Machine Learning Analysis
The system uses Ollama (LLM) to analyze user behavior and account patterns, providing additional risk assessment.

### 3. Hybrid Scoring
Combines rule-based and LLM scores for a comprehensive risk assessment.

### 4. Admin Dashboard
Provides a comprehensive interface for:
- Viewing flagged accounts with risk scores
- Taking actions (delete, confirm fake/legitimate)
- Managing IP and device reputation
- Running batch scans

### 5. IP and Device Reputation
Tracks and updates the reputation of IP addresses and device fingerprints based on fraud detection results.

## API Endpoints

### Fraud Detection API
- `GET /api/admin/fraud-detection` - List flagged accounts with pagination and filtering
- `POST /api/admin/fraud-detection` - Scan all users or a specific user
- `POST /api/admin/fraud-detection/action` - Take admin actions on flagged accounts

### Dashboard API
- `GET /api/admin/dashboard` - Includes fraud detection statistics

## Database Schema

### FraudDetectionResult
Stores the results of fraud detection for each user scan.

### IpReputation
Tracks the reputation of IP addresses based on fraud detection history.

### DeviceFingerprint
Tracks the reputation of device fingerprints based on fraud detection history.

## Usage

### Admin Actions
Admins can take the following actions on flagged accounts:
- **DELETE** - Delete the user account
- **LOCK** - Lock the user account for 90 days
- **WHITELIST** - Confirm as legitimate
- **CONFIRM_FAKE** - Confirm as fake
- **CONFIRM_LEGIT** - Confirm as legitimate

### Batch Scanning
Admins can run batch scans on all users or scan specific users individually.

### Human Feedback
The system accepts human feedback to improve detection accuracy over time.

## Testing

To seed the database with test data for fraud detection, run:
```bash
bun run prisma db:push
bun prisma/seed-fraud.ts
```

## Implementation Details

The fraud detection system is implemented in the following files:
- `/src/lib/fraud-detector.ts` - Core fraud detection logic
- `/src/app/api/admin/fraud-detection/route.ts` - Main API endpoint
- `/src/app/api/admin/fraud-detection/action/route.ts` - Admin actions endpoint
- `/src/components/pages/AdminFraudDetectionPage.tsx` - Admin dashboard UI
- `/prisma/seed-fraud.ts` - Test data seeding
