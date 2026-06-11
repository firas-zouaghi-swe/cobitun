import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { queryEntities } from '@/lib/ioda-client';

interface IodaEntityWithIpCount {
  asn?: number;
  ipCount: number;
}

const providerLogoMap: Record<number, string> = {
  49584: '/logos/dataxion.png',
  2609: '/logos/tunisia_backbone.png',
  37492: '/logos/orange_tunisie.png',
  37693: '/logos/ooredoo.png',
  327934: '/logos/tunisie_telecom.png',
  37504: '/logos/eo_datacenter.png',
  37671: '/logos/3s_globalnet.png',
  37717: '/logos/cck.png',
  31245: '/logos/ati.png',
  37703: '/logos/atlax.png',
  328394: '/logos/rfc.png',
  328414: '/logos/nextstep.png',
  328853: '/logos/oxahost.png',
  328880: '/logos/internet_smart_solutions.png',
  329186: '/logos/focus_technology.png',
};

function getProviderTags(provider: { organisationName: string; isVerified: number }) {
  const tags: string[] = [];
  if (provider.isVerified === 1) tags.push('ANCS');
  const name = provider.organisationName.toLowerCase();
  if (name.includes('telecom') || name.includes('agency') || name.includes('backbone') || name.includes('internet')) {
    tags.push('Gov');
  }
  return tags;
}

export async function GET() {
  try {
    const providerCount = await db.cloudProvider.count({ where: { isActive: 1, isDeleted: 0 } });
    const unprocessedOutages = await db.outageEvent.count({ where: { processed: 0, isDeleted: 0 } });
    const totalClaims = await db.workflowClaim.count({
      where: { isDeleted: 0, declarationOfLossPdfUrl: { not: null } },
    });

    const paidStatus = await db.enumParamClaimStatus.findFirst({
      where: { statusCode: 'PAID', isCurrent: 1 },
      select: { id: true },
    });

    const totalPayoutsAgg = paidStatus
      ? await db.parametricClaim.aggregate({
          where: { statusId: paidStatus.id, isDeleted: 0 },
          _sum: { payoutAmount: true },
        })
      : { _sum: { payoutAmount: null } };

    const totalPayouts = totalPayoutsAgg._sum.payoutAmount || 0;

    const providers = await db.cloudProvider.findMany({
      where: { isActive: 1, isDeleted: 0 },
      orderBy: { asn: 'asc' },
      include: { slaTier: true },
    });

    let entities: IodaEntityWithIpCount[] = [];
    try {
      entities = await queryEntities('asn', 'country/TN');
    } catch (innerError) {
      console.warn('Failed to fetch IODA provider entity counts:', innerError);
    }

    const entityMap = new Map<number, number>();
    entities.forEach((entity) => {
      if (entity.asn) entityMap.set(entity.asn, entity.ipCount);
    });

    const enrichedProviders = providers.map((provider) => {
      const asnNumber = Number(provider.asn);
      const ipCount = entityMap.get(asnNumber) ?? 0;
      return {
        id: String(provider.id),
        asn: asnNumber,
        name: provider.organisationName,
        organisationName: provider.organisationName,
        iodaName: provider.iodaName ?? null,
        ipCount,
        slaTier: {
          tierCode: provider.slaTier.tierCode,
          tierName: provider.slaTier.tierName,
          mttrHours: Number(provider.mttrHours || provider.slaTier.mttrHours),
        },
        tags: getProviderTags(provider),
        logo: providerLogoMap[asnNumber],
      };
    });

    const totalIps = enrichedProviders.reduce((sum, provider) => sum + provider.ipCount, 0);
    const averageIps = providerCount > 0 ? Math.round(totalIps / providerCount) : 0;

    return NextResponse.json({
      providerCount,
      unprocessedOutages,
      totalPayouts,
      totalClaims,
      totalIps,
      averageIps,
      providers: enrichedProviders,
    });
  } catch (error) {
    console.error('Homepage summary error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
