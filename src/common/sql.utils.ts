export interface EntityConfig {
  route: string;
  table: string;
  idColumn: string;
  allowedColumns: string[];
  filterColumns?: string[];
  searchableColumns?: string[];
  defaultOrderBy?: string;
}

export interface ListQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  filters?: Record<string, unknown>;
}

export function quoteIdentifier(identifier: string): string {
  return identifier
    .split(".")
    .map((part) => `"${part.replace(/"/g, "\"\"")}"`)
    .join(".");
}

export function pickAllowedValues(
  payload: Record<string, unknown>,
  allowedColumns: string[],
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(payload).filter(
      ([key, value]) =>
        allowedColumns.includes(key) &&
        value !== undefined &&
        !(typeof value === "string" && value.trim() === ""),
    ),
  );
}

export function buildInsertQuery(
  table: string,
  payload: Record<string, unknown>,
  idColumn: string,
): { text: string; values: unknown[] } {
  const keys = Object.keys(payload);
  const values = Object.values(payload);
  const columns = keys.map((key) => quoteIdentifier(key)).join(", ");
  const placeholders = keys.map((_, index) => `$${index + 1}`).join(", ");

  return {
    text: `INSERT INTO ${quoteIdentifier(table)} (${columns}) VALUES (${placeholders}) RETURNING *`,
    values,
  };
}

export function buildUpdateQuery(
  table: string,
  payload: Record<string, unknown>,
  idColumn: string,
  id: string,
): { text: string; values: unknown[] } {
  const keys = Object.keys(payload);
  const values = Object.values(payload);
  const setClause = keys
    .map((key, index) => `${quoteIdentifier(key)} = $${index + 1}`)
    .join(", ");

  return {
    text: `
      UPDATE ${quoteIdentifier(table)}
      SET ${setClause}
      WHERE ${quoteIdentifier(idColumn)} = $${keys.length + 1}
      RETURNING *
    `,
    values: [...values, id],
  };
}

export function buildListQuery(
  config: EntityConfig,
  params: ListQueryParams,
): { text: string; values: unknown[] } {
  const filters = params.filters ?? {};
  const values: unknown[] = [];
  const where: string[] = [];

  for (const [key, value] of Object.entries(filters)) {
    if (
      value === undefined ||
      value === null ||
      value === "" ||
      !config.filterColumns?.includes(key)
    ) {
      continue;
    }

    values.push(value);
    where.push(`${quoteIdentifier(key)} = $${values.length}`);
  }

  if (params.search && config.searchableColumns?.length) {
    values.push(`%${params.search.toLowerCase()}%`);
    const searchClauses = config.searchableColumns.map(
      (column) => `LOWER(COALESCE(${quoteIdentifier(column)}::text, '')) LIKE $${values.length}`,
    );
    where.push(`(${searchClauses.join(" OR ")})`);
  }

  const orderBy = config.defaultOrderBy ?? config.idColumn;
  const page = Math.max(1, Number(params.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(params.limit ?? 20)));
  const offset = (page - 1) * limit;
  values.push(limit, offset);

  return {
    text: `
      SELECT *
      FROM ${quoteIdentifier(config.table)}
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY ${quoteIdentifier(orderBy)}
      LIMIT $${values.length - 1}
      OFFSET $${values.length}
    `,
    values,
  };
}
