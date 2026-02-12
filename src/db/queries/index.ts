import { db } from '../client';
import { DbUnit, DbLesson, DbActivity, CreateActivityInput } from '../../types';

export const unitQueries = {
  async getAll(filters?: { subject?: string; year?: number; active?: boolean }): Promise<DbUnit[]> {
    let query = 'SELECT * FROM units WHERE 1=1';
    const params: any[] = [];
    let paramCount = 1;

    if (filters?.subject) {
      query += ` AND subject = $${paramCount++}`;
      params.push(filters.subject);
    }

    if (filters?.year !== undefined) {
      query += ` AND year = $${paramCount++}`;
      params.push(filters.year);
    }

    if (filters?.active !== undefined) {
      query += ` AND active = $${paramCount++}`;
      params.push(filters.active);
    } else {
      query += ' AND COALESCE(active, true) = true';
    }

    query += ' ORDER BY subject, title';

    const result = await db.query(query, params);
    return result.rows;
  },

  async getById(unitId: string): Promise<DbUnit | null> {
    const result = await db.query(
      'SELECT * FROM units WHERE unit_id = $1',
      [unitId]
    );
    return result.rows[0] || null;
  },
};

export const lessonQueries = {
  async getAll(filters?: { unit_id?: string; active?: boolean }): Promise<DbLesson[]> {
    let query = 'SELECT * FROM lessons WHERE 1=1';
    const params: any[] = [];
    let paramCount = 1;

    if (filters?.unit_id) {
      query += ` AND unit_id = $${paramCount++}`;
      params.push(filters.unit_id);
    }

    if (filters?.active !== undefined) {
      query += ` AND active = $${paramCount++}`;
      params.push(filters.active);
    } else {
      query += ' AND COALESCE(active, true) = true';
    }

    query += ' ORDER BY unit_id, order_by, title';

    const result = await db.query(query, params);
    return result.rows;
  },

  async getById(lessonId: string): Promise<DbLesson | null> {
    const result = await db.query(
      'SELECT * FROM lessons WHERE lesson_id = $1',
      [lessonId]
    );
    return result.rows[0] || null;
  },

  async findByTitle(title: string, unitId?: string): Promise<DbLesson[]> {
    let query = 'SELECT * FROM lessons WHERE LOWER(title) LIKE LOWER($1)';
    const params: any[] = [`%${title}%`];

    if (unitId) {
      query += ' AND unit_id = $2';
      params.push(unitId);
    }

    query += ' AND COALESCE(active, true) = true ORDER BY order_by, title';

    const result = await db.query(query, params);
    return result.rows;
  },
};

export const activityQueries = {
  async getAll(lessonId: string): Promise<DbActivity[]> {
    const result = await db.query(
      'SELECT * FROM activities WHERE lesson_id = $1 AND COALESCE(active, true) = true ORDER BY order_by, activity_id',
      [lessonId]
    );
    return result.rows;
  },

  async getById(activityId: string): Promise<DbActivity | null> {
    const result = await db.query(
      'SELECT * FROM activities WHERE activity_id = $1',
      [activityId]
    );
    return result.rows[0] || null;
  },

  async create(input: CreateActivityInput): Promise<DbActivity> {
    const result = await db.query(
      `INSERT INTO activities (lesson_id, title, type, body_data, order_by, is_summative, notes, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true)
       RETURNING *`,
      [
        input.lesson_id,
        input.title,
        input.type,
        JSON.stringify(input.body_data),
        input.order_by || null,
        input.is_summative || false,
        input.notes || null,
      ]
    );
    return result.rows[0];
  },

  async bulkCreate(lessonId: string, activities: CreateActivityInput[]): Promise<DbActivity[]> {
    const created: DbActivity[] = [];

    for (const activity of activities) {
      const result = await db.query(
        `INSERT INTO activities (lesson_id, title, type, body_data, order_by, is_summative, notes, active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true)
         RETURNING *`,
        [
          lessonId,
          activity.title,
          activity.type,
          JSON.stringify(activity.body_data),
          activity.order_by || null,
          activity.is_summative || false,
          activity.notes || null,
        ]
      );
      created.push(result.rows[0]);
    }

    return created;
  },

  async update(activityId: string, updates: Partial<CreateActivityInput>): Promise<DbActivity | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (updates.title !== undefined) {
      fields.push(`title = $${paramCount++}`);
      values.push(updates.title);
    }

    if (updates.type !== undefined) {
      fields.push(`type = $${paramCount++}`);
      values.push(updates.type);
    }

    if (updates.body_data !== undefined) {
      fields.push(`body_data = $${paramCount++}`);
      values.push(JSON.stringify(updates.body_data));
    }

    if (updates.order_by !== undefined) {
      fields.push(`order_by = $${paramCount++}`);
      values.push(updates.order_by);
    }

    if (updates.is_summative !== undefined) {
      fields.push(`is_summative = $${paramCount++}`);
      values.push(updates.is_summative);
    }

    if (updates.notes !== undefined) {
      fields.push(`notes = $${paramCount++}`);
      values.push(updates.notes);
    }

    if (fields.length === 0) {
      return await activityQueries.getById(activityId);
    }

    values.push(activityId);
    const query = `UPDATE activities SET ${fields.join(', ')} WHERE activity_id = $${paramCount} RETURNING *`;

    const result = await db.query(query, values);
    return result.rows[0] || null;
  },

  async delete(activityId: string): Promise<boolean> {
    const result = await db.query(
      'UPDATE activities SET active = false WHERE activity_id = $1',
      [activityId]
    );
    return (result.rowCount ?? 0) > 0;
  },

  async getStats(lessonId: string): Promise<{ total: number; by_type: Record<string, number> }> {
    const result = await db.query(
      `SELECT
        COUNT(*) as total,
        type,
        COUNT(*) as count
       FROM activities
       WHERE lesson_id = $1 AND COALESCE(active, true) = true
       GROUP BY type`,
      [lessonId]
    );

    const stats: any = {
      total: 0,
      by_type: {},
    };

    result.rows.forEach((row) => {
      stats.total += parseInt(row.count, 10);
      stats.by_type[row.type] = parseInt(row.count, 10);
    });

    return stats;
  },
};
