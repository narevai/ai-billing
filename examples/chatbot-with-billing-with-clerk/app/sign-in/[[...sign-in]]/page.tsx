import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="flex h-dvh w-screen items-center justify-center bg-sidebar">
      <SignIn />
    </div>
  );
}
