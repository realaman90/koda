'use client';

import { AuthenticateWithRedirectCallback } from '@clerk/nextjs';

export default function SignInSSOCallbackPage() {
  return <AuthenticateWithRedirectCallback />;
}
