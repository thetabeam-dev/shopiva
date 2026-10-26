import type { Pool } from "pg";

/**
 * Card title per order / return: the first product's name, plus
 * "+N more" when there are several products.
 */
export async function productLabelsByParent(
    pool: Pool,
    table: "order_items" | "return_items",
    parentColumn: "order_id" | "return_id",
    parentIds: number[]
): Promise<Map<number, string>> {
    const ids = parentIds.filter((id) => Number.isFinite(id) && id > 0);
    const labels = new Map<number, string>();
    if (!ids.length) return labels;

    const { rows } = await pool.query<{ parent_id: number; name: string | null }>(
        `SELECT i.${parentColumn} AS parent_id, p.name
         FROM ${table} i
         LEFT JOIN products p ON p.id::text = i.item_id
         WHERE i.${parentColumn} = ANY($1::int[])
         ORDER BY i.id`,
        [ids]
    );

    const names = new Map<number, string[]>();
    for (const row of rows) {
        const list = names.get(Number(row.parent_id)) ?? [];
        const name = String(row.name ?? "").trim();
        if (name) list.push(name);
        names.set(Number(row.parent_id), list);
    }
    for (const [id, list] of names) {
        if (!list.length) continue;
        labels.set(id, list.length > 1 ? `${list[0]} +${list.length - 1} more` : list[0]!);
    }
    return labels;
}
