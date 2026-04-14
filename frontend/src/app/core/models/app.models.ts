export interface AuthUser {
  id_usuario: string;
  correo_electronico: string;
  nombre_usuario: string;
  roles: string[];
  permissions: string[];
}

export interface AuthResponse {
  access_token: string;
  user: AuthUser;
}

export interface ApiQueryParams {
  [key: string]: string | number | boolean | null | undefined;
}

export type FieldType =
  | 'text'
  | 'email'
  | 'number'
  | 'date'
  | 'textarea'
  | 'checkbox'
  | 'select'
  | 'password';

export interface SelectOptionConfig {
  endpoint: string;
  labelKey: string;
  valueKey: string;
  query?: ApiQueryParams;
}

export interface FieldConfig {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
  hint?: string;
  rows?: number;
  defaultValue?: string | number | boolean | null;
  optionConfig?: SelectOptionConfig;
}

export interface EntityColumn {
  key: string;
  label: string;
  type?: 'text' | 'date' | 'currency' | 'boolean' | 'badge';
}

export interface EntityConfig {
  key: string;
  domain: string;
  title: string;
  subtitle: string;
  endpoint: string;
  idKey: string;
  permission: string;
  badge?: string;
  columns: EntityColumn[];
  formFields?: FieldConfig[];
  createMode?: 'guided' | 'json';
}

export interface NavigationItem {
  label: string;
  route: string;
  icon: string;
  permission?: string;
}

export interface SessionState {
  token: string | null;
  user: AuthUser | null;
  hydrated: boolean;
}

export interface BreadcrumbItem {
  label: string;
  url: string;
}

export interface DashboardMetric {
  label: string;
  value: string | number;
  tone?: 'primary' | 'success' | 'warning' | 'danger';
  helper?: string;
}
