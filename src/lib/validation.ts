import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export const signupSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(12, 'Password must be at least 12 characters long'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  mobile: z.string().min(1, 'Mobile phone is required'),
  address: z.string().min(1, 'Address is required'),
  email: z.string().email('Invalid email address').optional(),
  companyName: z.string().min(1, 'Company name is required'),
  sectorId: z.string().optional(),
  businessModelId: z.string().optional(),
  registrationNumber: z.string().optional(),
  taxId: z.string().optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Valid email is required'),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(12, 'Password must be at least 12 characters long'),
    confirmPassword: z.string().min(1, 'Password confirmation is required'),
  })
  .superRefine((data, ctx) => {
    if (data.newPassword !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Passwords do not match',
        path: ['confirmPassword'],
      });
    }
    const strengthRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/;
    if (!strengthRegex.test(data.newPassword)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Password must contain uppercase, lowercase, number, and symbol',
        path: ['newPassword'],
      });
    }
  });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, 'Reset token is required'),
    newPassword: z.string().min(12, 'Password must be at least 12 characters long'),
    confirmPassword: z.string().min(1, 'Password confirmation is required'),
  })
  .superRefine((data, ctx) => {
    if (data.newPassword !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Passwords do not match',
        path: ['confirmPassword'],
      });
    }
    const strengthRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/;
    if (!strengthRegex.test(data.newPassword)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Password must contain uppercase, lowercase, number, and symbol',
        path: ['newPassword'],
      });
    }
  });

export const customerProfileUpdateSchema = z.object({
  firstName: z.string().min(1, 'First name is required').optional(),
  lastName: z.string().min(1, 'Last name is required').optional(),
  email: z.string().email('Invalid email address').optional(),
  companyName: z.string().min(1, 'Company name is required').optional(),
  address: z.string().min(1, 'Address is required').optional(),
  mobile: z.string().optional(),
  registrationNumber: z.string().optional(),
  taxId: z.string().optional(),
  sectorId: z
    .union([z.string().regex(/^[0-9]+$/).transform(Number), z.number().int().positive()])
    .optional(),
  businessModelId: z
    .union([z.string().regex(/^[0-9]+$/).transform(Number), z.number().int().positive()])
    .optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  website: z.string().optional(),
});

export function parseBody<T>(schema: z.ZodSchema<T>, body: unknown): T | null {
  const parseResult = schema.safeParse(body);
  return parseResult.success ? parseResult.data : null;
}

