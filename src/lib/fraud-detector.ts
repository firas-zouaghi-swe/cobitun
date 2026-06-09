import { PrismaClient, Prisma } from '@prisma/client';
import type { db } from '@/lib/db';
import ollama from 'ollama'; // npm install ollama
import crypto from 'crypto';

// The FraudDetector accepts either the base PrismaClient or the extended client (db).
// Using a structural type that covers both ensures compatibility without unsafe casting.
type PrismaClientLike = any;

// ─── CONFIG ───
const MODEL_FAST = 'llama3.2:3b';
const MODEL_DEEP = 'qwen2.5:7b';
const CONFIDENCE_THRESHOLD = 60;

// Disposable email domains
const DISPOSABLE_DOMAINS = new Set([
  'tempmail.com', '10minutemail.com', 'guerrillamail.com',
  'mailinator.com', 'yopmail.com', 'throwaway.com',
  'sharklasers.com', 'getairmail.com', 'temp-mail.org', 'fakeinbox.com'
]);

interface FraudCheckInput {
  user: any;
  customer?: { companyName?: string | null; mobile?: string | null; website?: string | null } | null;
  ip: string;
  userAgent: string;
  deviceFingerprint?: string;
}

interface FraudResult {
  userId: number;
  ruleScore: number;
  ruleFlags: string[];
  llmScore: number;
  llmReasoning: string;
  finalScore: number;
  verdict: 'LEGITIMATE' | 'REVIEW' | 'FAKE';
  latencyMs: number;
  modelUsed: string;
}

export class FraudDetector {
  private prisma: PrismaClientLike;
  private model: string;
  private llmCache = new Map<string, any>();

  constructor(prisma: PrismaClientLike, model = MODEL_FAST) {
    this.prisma = prisma;
    this.model = model;
  }

  // ─── RULE ENGINE ───

  private shannonEntropy(s: string): number {
    if (!s || s.length < 4) return 0;
    const freq = new Map<string, number>();
    for (const c of s) freq.set(c, (freq.get(c) || 0) + 1);
    let entropy = 0;
    for (const count of freq.values()) {
      const p = count / s.length;
      entropy -= p * Math.log2(p);
    }
    return entropy;
  }

  async evaluateRules(input: FraudCheckInput): Promise<{ score: number; flags: string[] }> {
    const { user, customer, ip, userAgent, deviceFingerprint } = input;
    let score = 0;
    const flags: string[] = [];

    // 1. Username entropy (machine-generated)
    if (user.username.length >= 8) {
      const ent = this.shannonEntropy(user.username);
      if (ent > 3.5) {
        score += 20;
        flags.push('high_entropy_username');
      }
    }

    // 2. Disposable email
    const domain = user.email.split('@')[1]?.toLowerCase() || '';
    if (DISPOSABLE_DOMAINS.has(domain)) {
      score += 30;
      flags.push('disposable_email');
    }

    // 3. Empty profile / missing customer data
    if (!customer || !customer.companyName || customer.companyName.length < 3) {
      score += 15;
      flags.push('incomplete_profile');
    }
    if (!customer?.mobile) {
      score += 10;
      flags.push('no_mobile');
    }

    // 4. IP reputation from DB
    const ipRep = await this.prisma.ipReputation.findUnique({ where: { ip } });
    if (ipRep) {
      if (ipRep.riskScore > 50) {
        score += 25;
        flags.push(`bad_ip_reputation(${ipRep.riskScore.toFixed(0)})`);
      } else if (ipRep.riskScore > 0) {
        score += 10;
        flags.push(`known_ip(${ipRep.riskScore.toFixed(0)})`);
      }
      if (ipRep.blocked) {
        score += 50;
        flags.push('ip_blocked');
      }
    }

    // 5. Registration velocity (same IP, last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentRegs = await this.prisma.user.count({
      where: {
        lastLoginIp: ip,
        createdAt: { gte: oneHourAgo },
        isDeleted: 0,
      },
    });
    if (recentRegs > 3) {
      score += 20;
      flags.push(`registration_burst(${recentRegs})`);
    }

    // 6. Shared device fingerprint
    if (deviceFingerprint) {
      const devFp = await this.prisma.deviceFingerprint.findUnique({
        where: { fingerprint: deviceFingerprint },
      });
      if (devFp && devFp.userCount > 5) {
        score += 20;
        flags.push(`shared_device(${devFp.userCount})`);
      }
      if (devFp?.blocked) {
        score += 50;
        flags.push('device_blocked');
      }
    }

    // 7. Suspicious user agent
    if (!userAgent || userAgent.length < 20 || userAgent.toLowerCase().includes('bot')) {
      score += 15;
      flags.push('suspicious_ua');
    }

    // 8. Numeric suffix pattern (user123456)
    if (/^[a-zA-Z]+[_\.]?\d{4,}$/.test(user.username)) {
      score += 15;
      flags.push('numeric_suffix');
    }

    // 9. Failed login history
    if ((user as any).failedLoginCount > 3) {
      score += 10;
      flags.push(`failed_logins(${(user as any).failedLoginCount})`);
    }

    // 10. Account locked
    if ((user as any).lockedUntil && (user as any).lockedUntil > new Date()) {
      score += 15;
      flags.push('account_locked');
    }
    
    // 11. Disposable email check
    if (DISPOSABLE_DOMAINS.has(domain)) {
      score += 30;
      flags.push('disposable_email');
    }
    
    // 12. Bot username pattern (random strings, numbers only, etc.)
    if (/^[a-zA-Z0-9]{8,}$/.test(user.username) && !/[a-zA-Z]{3,}/.test(user.username)) {
      score += 20;
      flags.push('bot_username_pattern');
    }
    
    // 13. Email name mismatch
    const emailName = user.email.split('@')[0];
    if (emailName && user.firstName && !emailName.toLowerCase().includes(user.firstName.toLowerCase())) {
      score += 10;
      flags.push('email_name_mismatch');
    }
    
    // 14. No website for business account
    if (customer?.companyName && !customer?.website) {
      score += 10;
      flags.push('no_business_website');
    }

    return { score: Math.min(score, 100), flags };
  }

  // ─── LLM ANALYSIS ───

  async llmAnalyze(input: FraudCheckInput): Promise<{ score: number; reasoning: string; indicators: string[] }> {
    const cacheKey = crypto
      .createHash('md5')
      .update(`${input.user.username}:${input.user.email}:${input.user.firstName}`)
      .digest('hex');

    if (this.llmCache.has(cacheKey)) {
      return this.llmCache.get(cacheKey);
    }

    const prompt = `You are a fraud detection analyst for an insurance platform.
Analyze this account registration and rate fake/sybil risk.

Username: ${input.user.username}
Email: ${input.user.email}
Name: ${input.user.firstName} ${input.user.lastName}
Company: ${input.customer?.companyName || 'N/A'}
IP: ${input.ip}
User-Agent: ${input.userAgent || 'N/A'}

Output STRICT JSON:
{"risk_score":0-100,"is_fake":boolean,"confidence":0-100,"indicators":["..."],"reasoning":"..."}

Guidelines:
- 0-25: Normal business customer
- 26-50: Slightly odd but plausible
- 51-75: Likely fake/bot/sybil
- 76-100: Confirmed fraudulent pattern
`;

    try {
      const resp = await ollama.generate({
        model: this.model,
        prompt,
        options: { temperature: 0.1, num_predict: 250 },
      });

      const text = resp.response as string;
      const match = text.match(/\{[\s\S]*\}/);
      let result: any;

      if (match) {
        result = JSON.parse(match[0]);
      } else {
        // Fallback parsing
        const t = text.toLowerCase();
        const score = t.includes('fake') || t.includes('bot') ? 75 : 25;
        result = { risk_score: score, is_fake: score > 60, confidence: 50, indicators: ['parsed_fallback'], reasoning: text.slice(0, 150) };
      }

      const output = {
        score: result.risk_score ?? 50,
        reasoning: result.reasoning ?? 'No reasoning',
        indicators: result.indicators ?? [],
      };

      this.llmCache.set(cacheKey, output);
      return output;
    } catch (err) {
      return { score: 50, reasoning: `LLM error: ${(err as Error).message}`, indicators: ['llm_error'] };
    }
  }

  // ─── MAIN DETECT ───

  async detect(input: FraudCheckInput, mode: 'rules' | 'llm' | 'hybrid' = 'hybrid'): Promise<FraudResult> {
    const start = Date.now();

    // 1. Rules
    const { score: ruleScore, flags } = await this.evaluateRules(input);

    // 2. LLM (skip if clean + hybrid)
    let llmScore = 0;
    let llmReasoning = 'Skipped';
    let llmIndicators: string[] = [];

    if (mode === 'llm' || (mode === 'hybrid' && (ruleScore >= 25 || flags.length > 0))) {
      const llm = await this.llmAnalyze(input);
      llmScore = llm.score;
      llmReasoning = llm.reasoning;
      llmIndicators = llm.indicators;
    } else if (mode === 'hybrid') {
      llmScore = 10;
    }

    // 3. Combine
    let finalScore: number;
    if (mode === 'rules') finalScore = ruleScore;
    else if (mode === 'llm') finalScore = llmScore;
    else finalScore = ruleScore * 0.45 + llmScore * 0.55;

    finalScore = Math.round(finalScore * 10) / 10;

    // 4. Verdict
    let verdict: FraudResult['verdict'];
    if (finalScore < 30) verdict = 'LEGITIMATE';
    else if (finalScore < CONFIDENCE_THRESHOLD) verdict = 'REVIEW';
    else verdict = 'FAKE';

    const latencyMs = Date.now() - start;

    // 5. Persist result
      await this.prisma.fraudDetectionResult.create({
      data: {
        userId: input.user.id,
        ruleScore,
        ruleFlags: JSON.stringify(flags),
        llmScore,
        llmReasoning: llmReasoning.slice(0, 500),
        finalScore,
        verdict,
        modelUsed: this.model,
        latencyMs,
        ipAtCheck: input.ip,
        uaAtCheck: (input.userAgent || '').slice(0, 255),
      },
    });

    // 6. Update IP reputation
    const existingIpReputation = await this.prisma.ipReputation.findUnique({ where: { ip: input.ip } });
    await this.prisma.ipReputation.upsert({
      where: { ip: input.ip },
      create: {
        ip: input.ip,
        accountCount: 1,
        fakeCount: verdict === 'FAKE' ? 1 : 0,
        riskScore: finalScore,
      },
      update: {
        lastSeen: new Date(),
        accountCount: { increment: 1 },
        fakeCount: { increment: verdict === 'FAKE' ? 1 : 0 },
        riskScore: {
          set: Math.min(100, ((existingIpReputation?.riskScore ?? 0) * 0.7) + finalScore * 0.3),
        },
      },
    });

    // 7. Update device fingerprint
    if (input.deviceFingerprint) {
      const existingDeviceFingerprint = await this.prisma.deviceFingerprint.findUnique({ where: { fingerprint: input.deviceFingerprint } });
      await this.prisma.deviceFingerprint.upsert({
        where: { fingerprint: input.deviceFingerprint },
        create: {
          fingerprint: input.deviceFingerprint,
          userCount: 1,
          riskScore: finalScore,
        },
        update: {
          lastSeen: new Date(),
          userCount: { increment: 1 },
          riskScore: {
            set: Math.min(100, ((existingDeviceFingerprint?.riskScore ?? 0) * 0.7) + finalScore * 0.3),
          },
        },
      });
    }

    return {
      userId: input.user.id,
      ruleScore,
      ruleFlags: flags,
      llmScore,
      llmReasoning,
      finalScore,
      verdict,
      latencyMs,
      modelUsed: this.model,
    };
  }

  // ─── BATCH SCAN ───

  async scanAllUnscanned(batchSize = 50): Promise<{ scanned: number; fakes: number; reviews: number }> {
    const unscanned = await this.prisma.user.findMany({
      where: {
        isDeleted: 0,
        fraudResults: { none: {} },
      },
      take: batchSize,
      include: { customer: true },
    });

    let fakes = 0;
    let reviews = 0;

    for (const user of unscanned) {
      const result = await this.detect({
        user,
        customer: user.customer,
        ip: user.lastLoginIp || '0.0.0.0',
        userAgent: 'batch_scan',
      });
      if (result.verdict === 'FAKE') fakes++;
      if (result.verdict === 'REVIEW') reviews++;
    }

    return { scanned: unscanned.length, fakes, reviews };
  }

  // ─── HUMAN FEEDBACK ───

  async feedback(userId: number, correctVerdict: 'LEGITIMATE' | 'FAKE', notes?: string): Promise<void> {
    await this.prisma.fraudDetectionResult.updateMany({
      where: { userId },
      data: { humanLabel: correctVerdict === 'FAKE' ? 'confirmed_fake' : 'confirmed_legit' },
    });

    // Recalculate IP reputation if corrected
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user?.lastLoginIp) {
      const allResults = await this.prisma.fraudDetectionResult.findMany({
        where: { ipAtCheck: user.lastLoginIp, humanLabel: { not: null } },
      });
      const fakeCount = allResults.filter(r => r.humanLabel === 'confirmed_fake').length;
      const total = allResults.length;
      const score = total > 0 ? (fakeCount / total) * 100 : 0;

      await this.prisma.ipReputation.update({
        where: { ip: user.lastLoginIp },
        data: { riskScore: score, fakeCount, accountCount: total },
      });
    }
  }

  // ─── ADMIN QUERIES ───

  async getRiskyUsers(minScore = 50, limit = 100) {
    return this.prisma.fraudDetectionResult.findMany({
      where: { finalScore: { gte: minScore } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { user: { select: { username: true, email: true, firstName: true, lastName: true, createdAt: true } } },
    });
  }

  async getStats() {
    const [total, fakes, reviews, avgScore] = await Promise.all([
      this.prisma.fraudDetectionResult.count(),
      this.prisma.fraudDetectionResult.count({ where: { verdict: 'FAKE' } }),
      this.prisma.fraudDetectionResult.count({ where: { verdict: 'REVIEW' } }),
      this.prisma.fraudDetectionResult.aggregate({ _avg: { finalScore: true } }),
    ]);

    const badIps = await this.prisma.ipReputation.count({ where: { riskScore: { gt: 50 } } });

    return {
      totalChecked: total,
      fakeDetected: fakes,
      needsReview: reviews,
      avgRiskScore: Math.round((avgScore._avg.finalScore || 0) * 100) / 100,
      suspiciousIps: badIps,
    };
  }
}

