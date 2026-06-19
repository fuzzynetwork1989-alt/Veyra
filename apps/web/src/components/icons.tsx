import { cn } from "@veyra/ui";

type IconProps = { className?: string };

const defaults = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.5 };

export function IconHome({ className }: IconProps) {
  return (
    <svg className={cn("h-5 w-5", className)} {...defaults}>
      <path d="M4 10.2 12 4l8 6.2V19a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-.8z" strokeLinejoin="round" />
    </svg>
  );
}

export function IconChat({ className }: IconProps) {
  return (
    <svg className={cn("h-5 w-5", className)} {...defaults}>
      <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v7A2.5 2.5 0 0 1 16.5 16H10L6 19v-3H7.5A2.5 2.5 0 0 1 5 13.5z" strokeLinejoin="round" />
      <path d="M8 9.5h8M8 12.5h5" strokeLinecap="round" />
    </svg>
  );
}

export function IconTasks({ className }: IconProps) {
  return (
    <svg className={cn("h-5 w-5", className)} {...defaults}>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M8.5 12.5 11 15l4.5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconSettings({ className }: IconProps) {
  return (
    <svg className={cn("h-5 w-5", className)} {...defaults}>
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" />
      <path
        d="M19.4 13.5a7.4 7.4 0 0 0 .1-3l2-1.1-2-3.5-2.3.7a7.6 7.6 0 0 0-2.6-1.5L14 3.5h-4l-.6 2.6a7.6 7.6 0 0 0-2.6 1.5l-2.3-.7-2 3.5 2 1.1a7.4 7.4 0 0 0 0 3l-2 1.1 2 3.5 2.3-.7a7.6 7.6 0 0 0 2.6 1.5L10 20.5h4l.6-2.6a7.6 7.6 0 0 0 2.6-1.5l2.3.7 2-3.5z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconSpark({ className }: IconProps) {
  return (
    <svg className={cn("h-5 w-5", className)} {...defaults}>
      <path d="m12 2 2.2 6.8L21 11l-6.8 2.2L12 20l-2.2-6.8L3 11l6.8-2.2z" strokeLinejoin="round" />
      <circle cx="18.5" cy="18.5" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconBrain({ className }: IconProps) {
  return (
    <svg className={cn("h-5 w-5", className)} {...defaults}>
      <path d="M9 5.5A2.5 2.5 0 0 0 6.5 8v1.5A2.5 2.5 0 0 0 9 12M15 5.5A2.5 2.5 0 0 1 17.5 8v1.5A2.5 2.5 0 0 1 15 12" strokeLinecap="round" />
      <path d="M9 12a3.5 3.5 0 0 0 6 0M12 3v1.5M12 18.5V21" strokeLinecap="round" />
    </svg>
  );
}

export function IconSend({ className }: IconProps) {
  return (
    <svg className={cn("h-5 w-5", className)} {...defaults}>
      <path d="M4 12 20 5l-7 15-2-6z" strokeLinejoin="round" />
    </svg>
  );
}

export function IconPlus({ className }: IconProps) {
  return (
    <svg className={cn("h-5 w-5", className)} {...defaults}>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

export function IconUser({ className }: IconProps) {
  return (
    <svg className={cn("h-5 w-5", className)} {...defaults}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5.5 19.5c1.8-3 4-4.5 6.5-4.5s4.7 1.5 6.5 4.5" strokeLinecap="round" />
    </svg>
  );
}

export function IconMail({ className }: IconProps) {
  return (
    <svg className={cn("h-5 w-5", className)} {...defaults}>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="m4 7 8 6 8-6M4 17l6.5-5M20 17l-6.5-5" strokeLinejoin="round" />
    </svg>
  );
}

export function IconLock({ className }: IconProps) {
  return (
    <svg className={cn("h-5 w-5", className)} {...defaults}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8.5a4 4 0 1 1 8 0V11" strokeLinecap="round" />
      <circle cx="12" cy="16" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconGoogle({ className }: IconProps) {
  return (
    <svg className={cn("h-5 w-5", className)} viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

export function IconGithub({ className }: IconProps) {
  return (
    <svg className={cn("h-5 w-5", className)} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.58 2 12.26c0 4.52 2.87 8.36 6.84 9.72.5.1.68-.22.68-.49 0-.24-.01-.87-.01-1.7-2.78.62-3.37-1.37-3.37-1.37-.45-1.17-1.12-1.48-1.12-1.48-.92-.64.07-.63.07-.63 1.02.07 1.55 1.07 1.55 1.07.9 1.57 2.36 1.12 2.94.85.09-.67.35-1.12.63-1.38-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.7 0 0 .84-.27 2.75 1.02A9.3 9.3 0 0 1 12 6.84c.85.004 1.71.12 2.51.35 1.91-1.29 2.75-1.02 2.75-1.02.55 1.4.2 2.44.1 2.7.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.81-4.57 5.07.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.8 0 .27.18.59.69.49A10.03 10.03 0 0 0 22 12.26C22 6.58 17.52 2 12 2z" />
    </svg>
  );
}