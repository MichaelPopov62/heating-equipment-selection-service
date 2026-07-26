/**
 * Назначение: SSOT стилей Clerk (SignIn/SignUp, portals) — только appearance, без CSS-override.
 * Подключение: ClerkProviderWithRouter → appearance={clerkAppearance}.
 * Док.: docs/auth.md § «Clerk appearance (SSOT)».
 */

export const clerkAppearance = {
  variables: {
    colorPrimary: 'var(--accent)',
    colorText: 'var(--text-h)',
    colorTextSecondary: 'var(--text)',
    colorForeground: 'var(--text-h)',
    colorBackground: 'var(--surface-2)',
    colorInputBackground: 'var(--surface-2)',
    colorInputText: 'var(--text-h)',
    colorModalBackdrop: 'transparent',
    borderRadius: '10px',
    fontFamily: 'var(--sans)',
  },
  elements: {
    modalBackdrop: {
      background: 'transparent',
      display: 'none',
      pointerEvents: 'none',
      opacity: 0,
    },
    rootBox: { width: '100%', background: 'var(--surface-2)' },
    card: {
      width: '100%',
      maxWidth: '440px',
      boxShadow: 'none',
      border: 'none',
      background: 'var(--surface-2)',
    },
    cardBox: {
      width: '100%',
      boxShadow: 'none',
      background: 'var(--surface-2)',
    },
    main: { background: 'var(--surface-2)' },
    scrollBox: { background: 'var(--surface-2)' },
    pageScrollBox: { background: 'var(--surface-2)' },
    footer: { background: 'var(--surface-2)' },
    header: { background: 'var(--surface-2)' },
    headerTitle: { fontFamily: 'var(--heading)' },
    headerSubtitle: { color: 'var(--text)' },
    formButtonPrimary: {
      fontWeight: '600',
      borderRadius: '10px',
    },
    form: {
      alignItems: 'stretch',
      width: '100%',
    },
    formField: {
      alignItems: 'stretch',
      width: '100%',
    },
    formFieldLabelRow: {
      display: 'flex',
      justifyContent: 'center',
      width: '100%',
    },
    formFieldLabel: {
      textAlign: 'center',
      width: '100%',
      display: 'block',
    },
    formFieldLabel__emailAddress: {
      textAlign: 'center',
      width: '100%',
      display: 'block',
    },
    formFieldLabel__password: {
      textAlign: 'center',
      width: '100%',
      display: 'block',
    },
    formFieldInput: {
      borderRadius: '10px',
      border: '1px solid var(--border)',
      transition: 'border-color 0.15s ease',
      textAlign: 'left',
      direction: 'ltr',
      padding: '10px 12px 10px 3ch',
      '&::placeholder': {
        color: 'var(--text)',
        opacity: 0.55,
        fontWeight: 500,
      },
      '&:hover': {
        borderColor: 'color-mix(in srgb, var(--accent) 40%, var(--border))',
      },
      '&:focus': {
        borderColor: 'color-mix(in srgb, var(--accent) 55%, var(--border))',
        outline: 'none',
      },
    },
    formFieldInput__emailAddress: {
      textAlign: 'left',
      direction: 'ltr',
      padding: '10px 12px 10px 3ch',
    },
    formFieldInput__password: {
      textAlign: 'left',
      direction: 'ltr',
      padding: '10px 2.5rem 10px 3ch',
      border: 'none',
      boxShadow: 'none',
      flex: '1 1 auto',
      minWidth: 0,
      background: 'transparent',
      '&:hover': {
        borderColor: 'transparent',
      },
      '&:focus': {
        borderColor: 'transparent',
        outline: 'none',
      },
    },
    formFieldInputShowPasswordButton: {
      position: 'absolute',
      insetInlineEnd: '0.375rem',
      insetBlock: '0.375rem',
      color: 'var(--text)',
      zIndex: 1,
    },
    formFieldInputGroup: {
      position: 'relative',
      display: 'flex',
      alignItems: 'stretch',
      width: '100%',
      borderRadius: '10px',
      border: '1px solid var(--border)',
      background: 'var(--surface-2)',
      transition: 'border-color 0.15s ease',
      '&:hover': {
        borderColor: 'color-mix(in srgb, var(--accent) 40%, var(--border))',
      },
      '&:focus-within': {
        borderColor: 'color-mix(in srgb, var(--accent) 55%, var(--border))',
      },
    },
    lastAuthenticationStrategyBadge: {
      display: 'none',
      visibility: 'hidden',
      height: '0',
      overflow: 'hidden',
      margin: '0',
      padding: '0',
      pointerEvents: 'none',
    },
    formFieldErrorText: { minHeight: '1.25rem' },
    alertText: { minHeight: '1.25rem' },
    identityPreview: { marginBottom: '0.5rem' },
    socialButtonsBlockButton: {
      border: '1px solid var(--border)',
      background: 'var(--surface-2)',
      color: 'var(--text-h)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.5rem',
    },
    socialButtonsBlockButtonText: {
      color: 'var(--text-h)',
      fontWeight: '600',
      lineHeight: 1,
    },
    /** Mask-icon GitHub (block OAuth): Emotion inline — лише element key + light-dark (= --text-h) */
    socialButtonsProviderIcon__github: {
      '--cl-icon-fill': 'light-dark(#08060d, #f3f4f6)',
      backgroundColor: 'light-dark(#08060d, #f3f4f6)',
    },
    spinner: {
      width: '2rem',
      height: '2rem',
      borderWidth: '3px',
      borderColor: 'var(--border)',
      borderTopColor: 'var(--accent)',
      opacity: '1',
    },
  },
};
