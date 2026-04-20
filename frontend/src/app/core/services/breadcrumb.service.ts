import { Injectable, inject, signal } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  NavigationEnd,
  Router,
} from '@angular/router';
import { filter } from 'rxjs';
import { BreadcrumbItem } from '../models/app.models';

@Injectable({ providedIn: 'root' })
export class BreadcrumbService {
  private readonly router = inject(Router);
  readonly breadcrumbs = signal<BreadcrumbItem[]>([]);

  constructor() {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        this.breadcrumbs.set(this.build(this.router.routerState.snapshot.root));
      });
  }

  private build(
    route: ActivatedRouteSnapshot,
    url = '',
    breadcrumbs: BreadcrumbItem[] = [],
  ): BreadcrumbItem[] {
    const routeUrl = route.url.map((segment) => segment.path).join('/');
    const nextUrl = routeUrl ? `${url}/${routeUrl}` : url;
    const label = route.data['breadcrumb'] as string | undefined;

    if (label) {
      breadcrumbs.push({ label, url: nextUrl || '/' });
    }

    if (!route.firstChild) {
      return breadcrumbs;
    }

    return this.build(route.firstChild, nextUrl, breadcrumbs);
  }
}
