export type ContactSource = 'manual' | 'app_user' | 'google_sync';

export type Contact = {
  id: string;
  owner_id: string;
  linked_user_id: string | null;
  display_name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  source: ContactSource;
  google_resource_name: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};
