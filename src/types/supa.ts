export interface UserSettingsRow {
  user_id: string;
  theme_id: string;
  follow_system_theme: boolean;
  custom_theme_vars: Record<string, string> | null;
  onboarding_complete: boolean;
  updated_at: string;
}
