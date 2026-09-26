export type AuthErrorContext = "sign-in" | "link";

export interface AuthErrorContent {
  description: string;
  title: string;
}

const SIGN_IN_TITLE = "Couldn't sign you in";
const LINK_TITLE = "Couldn't link your account";

function titleForContext(context: AuthErrorContext): string {
  return context === "link" ? LINK_TITLE : SIGN_IN_TITLE;
}

/**
 * Maps Better Auth OAuth `error` query values to user-facing copy.
 * Raw `error_description` is intentionally not shown in the UI.
 */
export function getAuthErrorContent(
  error: string | null | undefined,
  context: AuthErrorContext = "sign-in"
): AuthErrorContent {
  const title = titleForContext(context);

  switch (error) {
    case "access_denied": {
      return {
        description:
          context === "link"
            ? "You cancelled linking this provider. You can try again from Security settings."
            : "You cancelled sign-in. Choose a provider below to continue.",
        title,
      };
    }
    case "state_mismatch":
    case "invalid_state": {
      return {
        description:
          "Your sign-in session expired. Please try again — it only takes a moment.",
        title,
      };
    }
    case "no_code": {
      return {
        description:
          "The provider did not complete authorization. Please try again.",
        title,
      };
    }
    case "User_not_authorized": {
      return {
        description:
          "This account isn't allowed to access Sora UI. Contact support if you think this is a mistake.",
        title,
      };
    }
    case "oauth_error": {
      return {
        description:
          "Something went wrong with the provider. Try again or use a different sign-in option.",
        title,
      };
    }
    case "email_not_found": {
      return {
        description:
          "GitHub did not share an email address. In GitHub → Settings → Emails, verify your primary email and allow OAuth apps to read it. If you use a GitHub App, grant “Email addresses: Read-only”.",
        title,
      };
    }
    case "unable_to_create_user": {
      return {
        description:
          "We could not create your account. Sign in with Google if you already use that, then link GitHub from Settings → Security.",
        title,
      };
    }
    case "account_not_linked": {
      return {
        description:
          "An account with this email already exists. Sign in with your original provider (usually Google), then link GitHub from Settings → Security.",
        title,
      };
    }
    case "email_does_not_match": {
      return {
        description:
          "That provider uses a different email than this account. Sign in first, then link it from Settings → Security.",
        title,
      };
    }
    case "account_already_linked_to_different_user": {
      return {
        description:
          "This Google or GitHub login is already connected to another Sora account. Sign in with that provider, or unlink it there first.",
        title,
      };
    }
    default: {
      return {
        description:
          context === "link"
            ? "We couldn't link this provider. Please try again from Security settings."
            : "We couldn't complete sign-in. Please try again.",
        title,
      };
    }
  }
}

export function parseAuthErrorContext(
  value: string | string[] | undefined
): AuthErrorContext {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "link" ? "link" : "sign-in";
}

export function readAuthErrorParam(
  value: string | string[] | undefined
): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.trim() || undefined;
}
