// @ts-nocheck
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TUNISIAN_PROVIDERS = [
  { asn: 2609, organisationName: 'Tunisia BackBone AS', slaTier: 'Gold' as const, mttrHours: 8.0 },
  { asn: 37693, organisationName: 'OOREDOO TUNISIE SA', slaTier: 'Gold' as const, mttrHours: 8.0 },
  { asn: 37492, organisationName: 'Orange Tunisie', slaTier: 'Gold' as const, mttrHours: 8.0 },
  { asn: 327934, organisationName: 'Tunisie Telecom', slaTier: 'Gold' as const, mttrHours: 8.0 },
  { asn: 37671, organisationName: '3S INF (Globalnet)', slaTier: 'Silver' as const, mttrHours: 12.0 },
  { asn: 37504, organisationName: 'EO Data Center', slaTier: 'Silver' as const, mttrHours: 12.0 },
  { asn: 37717, organisationName: 'Centre de Calcul El Khawarizmi', slaTier: 'Silver' as const, mttrHours: 12.0 },
  { asn: 37703, organisationName: 'ATLAX', slaTier: 'Bronze' as const, mttrHours: 16.0 },
  { asn: 328880, organisationName: 'STE INTERNET SMART SOLUTIONS', slaTier: 'Bronze' as const, mttrHours: 16.0 },
  { asn: 31245, organisationName: 'ATI - Agence Tunisienne Internet', slaTier: 'Bronze' as const, mttrHours: 16.0 },
  { asn: 49584, organisationName: 'DATAXION', slaTier: 'Platinum' as const, mttrHours: 4.0 },
  { asn: 328414, organisationName: 'STE NEXT STEP IT', slaTier: 'Bronze' as const, mttrHours: 16.0 },
  { asn: 328853, organisationName: 'OXAHOST', slaTier: 'Bronze' as const, mttrHours: 16.0 },
  { asn: 328394, organisationName: 'Réseaux Formation et Conseils', slaTier: 'Bronze' as const, mttrHours: 16.0 },
  { asn: 329186, organisationName: 'Focus Technology Solutions', slaTier: 'Bronze' as const, mttrHours: 16.0 },
];

async function main() {
  console.log('🌍 Seeding Tunisian Cloud Providers...\n');

  for (const provider of TUNISIAN_PROVIDERS) {
    try {
      const result = await prisma.cloudProvider.upsert({
        where: { asn: provider.asn },
        update: {
          organisationName: provider.organisationName,
          slaTier: provider.slaTier,
          mttrHours: provider.mttrHours,
          isActive: true,
        },
        create: {
          asn: provider.asn,
          organisationName: provider.organisationName,
          slaTier: provider.slaTier,
          mttrHours: provider.mttrHours,
          isActive: true,
          ancsCertified: ['Gold', 'Platinum'].includes(provider.slaTier),
          governmental: provider.asn === 327934 || provider.asn === 31245,
        },
      });
      console.log(`  ✅ ASN ${provider.asn} - ${provider.organisationName} [${provider.slaTier}]`);
    } catch (error) {
      console.error(`  ❌ Failed to seed ASN ${provider.asn}:`, error);
    }
  }

  const count = await prisma.cloudProvider.count();
  console.log(`\n✨ Done! ${count} cloud providers in database.`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

