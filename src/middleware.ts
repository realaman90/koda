import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import {
  DEV_AUTH_BYPASS_INTERNAL_HEADER,
  isApiDevBypassRequestAllowed,
  isDevAuthBypassEnabled,
  warnDevAuthBypassEnabled,
} from '@/lib/auth/dev-bypass';

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks/clerk',
  '/api/health',
  '/api/config',
]);

const isAuthRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)']);
const isApiRoute = createRouteMatcher(['/api(.*)']);

export default clerkMiddleware(async (auth, req) => {
  const authState = await auth();
  const { userId } = authState;
  const devBypassEnabled = isDevAuthBypassEnabled();

  if (devBypassEnabled) {
    warnDevAuthBypassEnabled('middleware');
  }

  if (isAuthRoute(req) && userId) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  if (!isPublicRoute(req) && !userId) {
    if (devBypassEnabled) {
      if (isApiRoute(req)) {
        if (!isApiDevBypassRequestAllowed(req.headers)) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const requestHeaders = new Headers(req.headers);
        requestHeaders.set(DEV_AUTH_BYPASS_INTERNAL_HEADER, '1');

        return NextResponse.next({
          request: {
            headers: requestHeaders,
          },
        });
      }

      return NextResponse.next();
    }

    if (isApiRoute(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return authState.redirectToSignIn({ returnBackUrl: req.url });
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
