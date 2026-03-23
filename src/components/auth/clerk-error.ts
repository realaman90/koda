import { isClerkAPIResponseError } from '@clerk/nextjs/errors';

const CODE_MESSAGES: Record<string, string> = {
  form_identifier_not_found: 'No account found for that email. Try signing up.',
  form_password_incorrect: 'Incorrect password. Please try again.',
  form_password_length_too_short: 'Password must be at least 8 characters.',
  form_identifier_exists: 'An account with this email already exists.',
  form_param_format_invalid: 'Enter a valid value and try again.',
  too_many_requests: 'Too many attempts. Please wait a bit and try again.',
};

export type FieldErrors = Partial<Record<'email' | 'password' | 'firstName' | 'lastName' | 'confirmPassword', string>>;

export function parseClerkError(error: unknown, fallback: string): { formError: string; fieldErrors: FieldErrors } {
  if (!isClerkAPIResponseError(error)) {
    return { formError: fallback, fieldErrors: {} };
  }

  const fieldErrors: FieldErrors = {};
  let formError = fallback;

  for (const issue of error.errors) {
    const codeMessage = CODE_MESSAGES[issue.code] ?? issue.longMessage ?? issue.message;

    const param = issue.meta?.paramName;
    if (param === 'identifier' || param === 'emailAddress' || param === 'email_address') {
      fieldErrors.email = codeMessage;
    } else if (param === 'password') {
      fieldErrors.password = codeMessage;
    } else if (param === 'firstName' || param === 'first_name') {
      fieldErrors.firstName = codeMessage;
    } else if (param === 'lastName' || param === 'last_name') {
      fieldErrors.lastName = codeMessage;
    }

    if (!formError || formError === fallback) {
      formError = codeMessage ?? fallback;
    }
  }

  return {
    formError,
    fieldErrors,
  };
}
