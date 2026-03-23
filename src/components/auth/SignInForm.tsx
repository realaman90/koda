'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSignIn } from '@clerk/nextjs';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AuthCard,
  AuthFooterLinks,
  AuthHeader,
  AuthPageShell,
  DividerWithLabel,
  GoogleIcon,
  InlineFeedbackArea,
} from '@/components/auth/AuthShell';
import { parseClerkError, type FieldErrors } from '@/components/auth/clerk-error';

const inputBaseClass =
  'h-11 border-border bg-background focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring-strong)] focus-visible:border-[var(--accent-primary)]';

export function SignInForm() {
  const router = useRouter();
  const { isLoaded, signIn, setActive } = useSignIn();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [formError, setFormError] = useState<string>('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const isBusy = isSubmitting || isGoogleSubmitting;
  const canSubmit = isLoaded && !isBusy;

  const emailErrorId = useMemo(() => (fieldErrors.email ? 'sign-in-email-error' : undefined), [fieldErrors.email]);
  const passwordErrorId = useMemo(
    () => (fieldErrors.password ? 'sign-in-password-error' : undefined),
    [fieldErrors.password]
  );

  const validate = () => {
    const nextErrors: FieldErrors = {};
    if (!email.trim()) {
      nextErrors.email = 'Enter your email address.';
    } else if (!/^\S+@\S+\.\S+$/.test(email)) {
      nextErrors.email = 'Enter a valid email address.';
    }

    if (!password) {
      nextErrors.password = 'Enter your password.';
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleGoogle = async () => {
    if (!signIn || !isLoaded || isBusy) return;

    setFormError('');
    setIsGoogleSubmitting(true);

    try {
      await signIn.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: '/sign-in/sso-callback',
        redirectUrlComplete: '/',
      });
    } catch (error) {
      const parsed = parseClerkError(error, 'Could not continue with Google. Please try again.');
      setFormError(parsed.formError);
      setIsGoogleSubmitting(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!signIn || !setActive || !isLoaded || isBusy) return;

    setFormError('');
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const result = await signIn.create({
        identifier: email.trim(),
        password,
      });

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        router.replace('/');
        return;
      }

      setFormError('Additional verification is required to sign in.');
    } catch (error) {
      const parsed = parseClerkError(error, 'Could not sign you in. Please try again.');
      setFormError(parsed.formError);
      setFieldErrors((prev) => ({ ...prev, ...parsed.fieldErrors }));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthPageShell>
      <AuthCard>
        <div className="space-y-4">
          <AuthHeader title="Welcome back" subtitle="Sign in to continue building with Koda." />

          <InlineFeedbackArea message={formError} />

          <Button
            type="button"
            variant="outline"
            className="h-11 w-full border-border bg-card text-foreground hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring-strong)]"
            onClick={handleGoogle}
            disabled={!isLoaded || isBusy}
          >
            {isGoogleSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
            Continue with Google
          </Button>

          <DividerWithLabel label="or continue with email" />

          <form className="space-y-3" onSubmit={handleSubmit} noValidate>
            <div className="space-y-1.5">
              <label htmlFor="sign-in-email" className="text-sm font-medium text-foreground">
                Email
              </label>
              <Input
                id="sign-in-email"
                type="email"
                autoComplete="email"
                className={inputBaseClass}
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
                }}
                onBlur={validate}
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={emailErrorId}
                disabled={!canSubmit}
              />
              {fieldErrors.email ? (
                <p id={emailErrorId} className="text-sm text-[color:var(--danger)]">
                  {fieldErrors.email}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="sign-in-password" className="text-sm font-medium text-foreground">
                Password
              </label>
              <div className="relative">
                <Input
                  id="sign-in-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className={`${inputBaseClass} pr-20`}
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
                  }}
                  onBlur={validate}
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={passwordErrorId}
                  disabled={!canSubmit}
                />
                <button
                  type="button"
                  className="text-muted-foreground absolute right-3 top-1/2 min-h-6 -translate-y-1/2 text-xs font-medium hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              {fieldErrors.password ? (
                <p id={passwordErrorId} className="text-sm text-[color:var(--danger)]">
                  {fieldErrors.password}
                </p>
              ) : null}
            </div>

            <div className="flex justify-end">
              <Link
                href="/sign-in"
                className="text-xs text-[var(--accent-primary)] underline-offset-4 hover:text-[var(--accent-primary-hover)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              >
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              className="h-11 w-full bg-[var(--accent-primary)] text-[var(--accent-primary-fg)] hover:bg-[var(--accent-primary-hover)] active:bg-[var(--accent-primary-active)] focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring-strong)]"
              disabled={!canSubmit}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                'Continue'
              )}
            </Button>
          </form>

          <AuthFooterLinks prompt="Don’t have an account?" href="/sign-up" label="Sign up" />
        </div>
      </AuthCard>
    </AuthPageShell>
  );
}
