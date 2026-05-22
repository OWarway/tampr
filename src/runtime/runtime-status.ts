export type RuntimeSkipReason =
  | 'disabled'
  | 'host-access'
  | 'invalid-matches'
  | 'no-code';

export type RuntimeSkip = {
  snippetId: string;
  reason: RuntimeSkipReason;
};

export type RuntimeRegistrationError = {
  registrationId: string;
  message: string;
};

export type RuntimeStatus = {
  state: 'ready' | 'user-scripts-unavailable' | 'sync-error';
  registrations: number;
  skipped: RuntimeSkip[];
  errors: RuntimeRegistrationError[];
};
