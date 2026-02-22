import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-6">
      <SignIn forceRedirectUrl="/" />
    </main>
  );
}
