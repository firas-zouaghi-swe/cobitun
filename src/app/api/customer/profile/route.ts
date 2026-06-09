import { NextRequest, NextResponse } from 'next/server';
import { randomBytes, createHash } from 'crypto';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/services/authorization';
import { sendVerificationEmail } from '@/lib/services/email-service';
import { customerProfileUpdateSchema } from '@/lib/validation';

export async function GET(request: NextRequest) {
  const authOrResp = await requireAuth(request);
  if ((authOrResp as any).status) return authOrResp as NextResponse;

  const auth = authOrResp as { userIdNum: number };
  const user = await db.user.findUnique({
    where: { id: auth.userIdNum },
    include: {
      customer: {
        include: {
          sector: true,
          businessModel: true,
        },
      },
    },
  });

  if (!user || !user.customer) {
    return NextResponse.json({ error: 'Customer profile not found' }, { status: 404 });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      emailVerified: Boolean(user.emailVerified),
    },
    customer: {
      id: user.customer.id,
      companyName: user.customer.companyName,
      address: user.customer.address,
      city: user.customer.city,
      postalCode: user.customer.postalCode,
      country: user.customer.country,
      mobile: user.customer.mobile,
      phone: user.customer.phone,
      website: user.customer.website,
      registrationNumber: user.customer.registrationNumber,
      taxId: user.customer.taxId,
      sector: user.customer.sector
        ? { id: user.customer.sector.id, name: user.customer.sector.sectorName, code: user.customer.sector.sectorCode }
        : null,
      businessModel: user.customer.businessModel
        ? { id: user.customer.businessModel.id, name: user.customer.businessModel.modelName, code: user.customer.businessModel.modelCode }
        : null,
    },
  });
}

export async function PUT(request: NextRequest) {
  const authOrResp = await requireAuth(request);
  if ((authOrResp as any).status) return authOrResp as NextResponse;

  const auth = authOrResp as { userIdNum: number };
  const body = await request.json();
  const parsed = customerProfileUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid profile update payload' }, { status: 400 });
  }

  const { firstName, lastName, email, companyName, address, mobile, registrationNumber, taxId, sectorId, businessModelId, city, postalCode, country, website } = parsed.data;

  const user = await db.user.findUnique({
    where: { id: auth.userIdNum },
    include: { customer: true },
  });

  if (!user || !user.customer) {
    return NextResponse.json({ error: 'Customer profile not found' }, { status: 404 });
  }

  const userUpdateData: Record<string, unknown> = {};
  const customerUpdateData: Record<string, unknown> = {};
  let emailChanged = false;

  if (firstName) userUpdateData.firstName = firstName;
  if (lastName) userUpdateData.lastName = lastName;
  if (email && email !== user.email) {
    userUpdateData.email = email;
    userUpdateData.emailVerified = 0;
    userUpdateData.emailVerifiedAt = null;
    emailChanged = true;
  }

  if (companyName) customerUpdateData.companyName = companyName;
  if (address) customerUpdateData.address = address;
  if (mobile) customerUpdateData.mobile = mobile;
  if (registrationNumber) customerUpdateData.registrationNumber = registrationNumber;
  if (taxId) customerUpdateData.taxId = taxId;
  if (typeof sectorId === 'number') customerUpdateData.sectorId = sectorId;
  if (typeof businessModelId === 'number') customerUpdateData.businessModelId = businessModelId;
  if (city) customerUpdateData.city = city;
  if (postalCode) customerUpdateData.postalCode = postalCode;
  if (country) customerUpdateData.country = country;
  if (website) customerUpdateData.website = website;

  const updatedUser = await db.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: user.id },
      data: userUpdateData,
    });

    await tx.customer.update({
      where: { userId: user.id },
      data: customerUpdateData,
    });

    return updated;
  });

  if (emailChanged && typeof updatedUser.email === 'string') {
    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    await db.emailVerificationToken.create({
      data: {
        userId: updatedUser.id,
        tokenHash,
        expiresAt,
      },
    });

    await sendVerificationEmail(updatedUser.email, token).catch((error) => {
      console.error('Failed to send email verification after profile update', error);
    });
  }

  return NextResponse.json({ message: 'Customer profile updated successfully' });
}

