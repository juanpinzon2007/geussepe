import { NavigationItem } from '../models/app.models';

export const PRIMARY_NAVIGATION: NavigationItem[] = [
  { label: 'Dashboard', route: '/app/dashboard', icon: 'space_dashboard' },
  {
    label: 'Usuarios y roles',
    route: '/app/entity/security/users',
    icon: 'shield_person',
    permission: 'security.manage',
  },
  {
    label: 'Productos',
    route: '/app/entity/masters/products',
    icon: 'inventory_2',
    permission: 'masters.manage',
  },
  {
    label: 'Terceros',
    route: '/app/entity/masters/third-parties',
    icon: 'group',
    permission: 'masters.manage',
  },
  {
    label: 'Bodegas',
    route: '/app/entity/inventory/warehouses',
    icon: 'warehouse',
    permission: 'inventory.manage',
  },
  {
    label: 'Operaciones inventario',
    route: '/app/inventory/operations',
    icon: 'swap_horiz',
    permission: 'inventory.manage',
  },
  {
    label: 'Compras',
    route: '/app/purchases/operations',
    icon: 'shopping_cart',
    permission: 'purchases.manage',
  },
  {
    label: 'Ventas',
    route: '/app/sales/operations',
    icon: 'point_of_sale',
    permission: 'sales.manage',
  },
  {
    label: 'Cumplimiento',
    route: '/app/compliance/workbench',
    icon: 'fact_check',
    permission: 'compliance.manage',
  },
  {
    label: 'Auditoría',
    route: '/app/audit/workbench',
    icon: 'policy',
    permission: 'audit.read',
  },
  {
    label: 'Analítica',
    route: '/app/analytics',
    icon: 'monitoring',
    permission: 'reports.read',
  },
  {
    label: 'Reportes',
    route: '/app/reports',
    icon: 'assessment',
    permission: 'reports.read',
  },
  {
    label: 'IA operativa',
    route: '/app/ai',
    icon: 'auto_awesome',
    permission: 'ai.manage',
  },
  {
    label: 'Integraciones',
    route: '/app/integrations',
    icon: 'hub',
    permission: 'reports.read',
  },
];
