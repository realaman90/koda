'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSignUp } from '@clerk/nextjs';
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

export function SignUpForm() {
  const router = useRouter();
  const { isLoaded, signUp, setActive } = useSignUp();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isAwaitingVerification, setIsAwaitingVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const isEmailFormActive = Boolean(email || firstName || lastName || password || confirmPassword);

  const isBusy = isSubmitting || isGoogleSubmitting || isVerifying;
  const canSubmit = isLoaded && !isBusy;

  const emailErrorId = useMemo(() => (fieldErrors.email ? 'sign-up-email-error' : undefined), [fieldErrors.email]);
  const passwordErrorId = useMemo(
    () => (fieldErrors.password ? 'sign-up-password-error' : undefined),
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
      nextErrors.password = 'Create a password.';
    } else if (password.length < 8) {
      nextErrors.password = 'Password must be at least 8 characters.';
    }

    if (confirmPassword !== password) {
      nextErrors.confirmPassword = 'Passwords do not match.';
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleGoogle = async () => {
    if (!signUp || !isLoaded || isBusy) return;

    setFormError('');
    setIsGoogleSubmitting(true);

    try {
      await signUp.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: '/sign-up/sso-callback',
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

    if (!signUp || !setActive || !isLoaded || isBusy) return;

    setFormError('');
    if (!validate()) return;

    setIsSubmitting(true);

    try {
      const result = await signUp.create({
        emailAddress: email.trim(),
        password,
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
      });

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        router.replace('/');
        return;
      }

      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setIsAwaitingVerification(true);
      setFormError('We sent a verification code to your email.');
    } catch (error) {
      const parsed = parseClerkError(error, 'Could not create your account. Please try again.');
      setFormError(parsed.formError);
      setFieldErrors((prev) => ({ ...prev, ...parsed.fieldErrors }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerify = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!signUp || !setActive || !isLoaded || isBusy) return;

    if (!verificationCode.trim()) {
      setFormError('Enter the verification code from your email.');
      return;
    }

    setFormError('');
    setIsVerifying(true);

    try {
      const result = await signUp.attemptEmailAddressVerification({
        code: verificationCode.trim(),
      });

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        router.replace('/');
        return;
      }

      setFormError('Verification is not complete yet. Please try again.');
    } catch (error) {
      const parsed = parseClerkError(error, 'Invalid code. Please try again.');
      setFormError(parsed.formError);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <AuthPageShell>
      <AuthCard>
        <div className="space-y-4">
          <AuthHeader title="Create your account" subtitle="Start building with Koda in seconds." />

          <InlineFeedbackArea message={formError} />

          {!isAwaitingVerification ? (
            <>
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

              {!isEmailFormActive && <div id="clerk-captcha" className="flex justify-center" />}

              <DividerWithLabel label="or continue with email" />

              <form className="space-y-3" onSubmit={handleSubmit} noValidate>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label htmlFor="sign-up-first-name" className="text-sm font-medium text-foreground">
                      First name
                    </label>
                    <Input
                      id="sign-up-first-name"
                      autoComplete="given-name"
                      className={inputBaseClass}
                      value={firstName}
                      onChange={(event) => setFirstName(event.target.value)}
                      onBlur={validate}
                      aria-invalid={Boolean(fieldErrors.firstName)}
                      disabled={!canSubmit}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="sign-up-last-name" className="text-sm font-medium text-foreground">
                      Last name
                    </label>
                    <Input
                      id="sign-up-last-name"
                      autoComplete="family-name"
                      className={inputBaseClass}
                      value={lastName}
                      onChange={(event) => setLastName(event.target.value)}
                      onBlur={validate}
                      aria-invalid={Boolean(fieldErrors.lastName)}
                      disabled={!canSubmit}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="sign-up-email" className="text-sm font-medium text-foreground">
                    Email
                  </label>
                  <Input
                    id="sign-up-email"
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
                  <label htmlFor="sign-up-password" className="text-sm font-medium text-foreground">
                    Password
                  </label>
                  <div className="relative">
                    <Input
                      id="sign-up-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
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

                <div className="space-y-1.5">
                  <label htmlFor="sign-up-confirm-password" className="text-sm font-medium text-foreground">
                    Confirm password
                  </label>
                  <div className="relative">
                    <Input
                      id="sign-up-confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      className={`${inputBaseClass} pr-20`}
                      value={confirmPassword}
                      onChange={(event) => {
                        setConfirmPassword(event.target.value);
                        if (fieldErrors.confirmPassword) {
                          setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                        }
                      }}
                      onBlur={validate}
                      aria-invalid={Boolean(fieldErrors.confirmPassword)}
                      aria-describedby={fieldErrors.confirmPassword ? 'sign-up-confirm-password-error' : undefined}
                      disabled={!canSubmit}
                    />
                    <button
                      type="button"
                      className="text-muted-foreground absolute right-3 top-1/2 min-h-6 -translate-y-1/2 text-xs font-medium hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  {fieldErrors.confirmPassword ? (
                    <p id="sign-up-confirm-password-error" className="text-sm text-[color:var(--danger)]">
                      {fieldErrors.confirmPassword}
                    </p>
                  ) : null}
                </div>

                {isEmailFormActive && <div id="clerk-captcha" className="flex justify-center" />}

                <Button
                  type="submit"
                  className="h-11 w-full bg-[var(--accent-primary)] text-[var(--accent-primary-fg)] hover:bg-[var(--accent-primary-hover)] active:bg-[var(--accent-primary-active)] focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring-strong)]"
                  disabled={!canSubmit}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating account…
                    </>
                  ) : (
                    'Create account'
                  )}
                </Button>
              </form>

            </>
          ) : (
            <form className="space-y-3" onSubmit={handleVerify} noValidate>
              <p className="text-sm text-muted-foreground">
                Enter the 6-digit code we sent to <span className="text-foreground">{email}</span>.
              </p>
              <div className="space-y-1.5">
                <label htmlFor="sign-up-verification-code" className="text-sm font-medium text-foreground">
                  Verification code
                </label>
                <Input
                  id="sign-up-verification-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className={inputBaseClass}
                  value={verificationCode}
                  onChange={(event) => setVerificationCode(event.target.value.replace(/\s+/g, ''))}
                  disabled={!canSubmit}
                />
              </div>

              <Button
                type="submit"
                className="h-11 w-full bg-[var(--accent-primary)] text-[var(--accent-primary-fg)] hover:bg-[var(--accent-primary-hover)] active:bg-[var(--accent-primary-active)] focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring-strong)]"
                disabled={!canSubmit}
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Verifying…
                  </>
                ) : (
                  'Verify email'
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="h-11 w-full"
                onClick={() => {
                  setIsAwaitingVerification(false);
                  setVerificationCode('');
                  setFormError('');
                }}
                disabled={isBusy}
              >
                Use a different email
              </Button>
            </form>
          )}

          <AuthFooterLinks prompt="Already have an account?" href="/sign-in" label="Sign in" />
        </div>
      </AuthCard>
    </AuthPageShell>
  );
}
