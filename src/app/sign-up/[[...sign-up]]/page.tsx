import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-6">
      <SignUp forceRedirectUrl="/" />
    </main>
  );
}
