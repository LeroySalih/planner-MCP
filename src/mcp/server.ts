import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { unitQueries, lessonQueries, activityQueries } from '../db/queries';
import config from '../config';
import { CreateActivityInput } from '../types';

// --- body_data validation schemas (per spec) ---

const McqOptionSchema = z.object({
  id: z.string().min(1, 'Option id is required'),
  text: z.string().max(500, 'Option text must be 500 characters or fewer'),
  imageUrl: z.string().nullable().optional(),
});

const McqBodySchema = z.object({
  question: z.string().min(1, 'question is required'),
  imageFile: z.string().min(1).nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  imageAlt: z.string().nullable().optional(),
  options: z
    .array(McqOptionSchema)
    .min(2, 'At least 2 options are required')
    .max(4, 'At most 4 options are allowed'),
  correctOptionId: z.string().min(1, 'correctOptionId is required'),
}).refine(
  (data) => data.options.some((o) => o.id === data.correctOptionId),
  { message: 'correctOptionId must match the id of one of the provided options' },
);

const ShortTextBodySchema = z.object({
  question: z.string().min(1, 'question is required'),
  modelAnswer: z.string().min(1, 'modelAnswer is required'),
}).passthrough();

const TextBodySchema = z.object({
  text: z.string().min(1, 'text is required'),
});

function validateBodyData(
  type: string,
  bodyData: Record<string, unknown>,
): { success: true } | { success: false; error: string } {
  if (type === 'multiple-choice-question') {
    const result = McqBodySchema.safeParse(bodyData);
    if (!result.success) {
      const issues = result.error.issues.map((i) => i.message).join('; ');
      return { success: false, error: `Invalid body_data for multiple-choice-question: ${issues}` };
    }
  } else if (type === 'short-text-question') {
    const result = ShortTextBodySchema.safeParse(bodyData);
    if (!result.success) {
      const issues = result.error.issues.map((i) => i.message).join('; ');
      return { success: false, error: `Invalid body_data for short-text-question: ${issues}` };
    }
  } else if (type === 'text') {
    const result = TextBodySchema.safeParse(bodyData);
    if (!result.success) {
      const issues = result.error.issues.map((i) => i.message).join('; ');
      return { success: false, error: `Invalid body_data for text: ${issues}` };
    }
  }
  return { success: true };
}

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: config.mcp.serverName,
    version: config.mcp.serverVersion,
  });

  server.registerTool('list_units', {
    description: 'List all curriculum units, optionally filtered by subject and/or year',
    inputSchema: {
      subject: z.string().optional(),
      year: z.number().optional(),
    },
  }, async (args) => {
    try {
      const units = await unitQueries.getAll({
        subject: args.subject,
        year: args.year,
      });
      return { content: [{ type: 'text', text: JSON.stringify(units) }] };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error listing units: ${(error as Error).message}` }],
        isError: true,
      };
    }
  });

  server.registerTool('list_lessons_for_unit', {
    description: 'List all lessons belonging to a specific unit',
    inputSchema: {
      unit_id: z.string(),
    },
  }, async (args) => {
    try {
      const lessons = await lessonQueries.getAll({ unit_id: args.unit_id });
      return { content: [{ type: 'text', text: JSON.stringify(lessons) }] };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error listing lessons: ${(error as Error).message}` }],
        isError: true,
      };
    }
  });

  server.registerTool('find_lesson', {
    description: 'Search for lessons by title (case-insensitive partial match), optionally scoped to a unit',
    inputSchema: {
      title: z.string(),
      unit_id: z.string().optional(),
    },
  }, async (args) => {
    try {
      const lessons = await lessonQueries.findByTitle(args.title, args.unit_id);
      return { content: [{ type: 'text', text: JSON.stringify(lessons) }] };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error finding lessons: ${(error as Error).message}` }],
        isError: true,
      };
    }
  });

  server.registerTool('create_activity', {
    description: 'Create a new activity (question) for a lesson',
    inputSchema: {
      lesson_id: z.string(),
      title: z.string(),
      type: z.enum(['multiple-choice-question', 'short-text-question', 'text']),
      body_data: z.record(z.string(), z.unknown()),
      order_by: z.number().optional(),
      is_summative: z.boolean().optional(),
      notes: z.string().optional(),
    },
  }, async (args) => {
    try {
      // text activities are non-scorable — reject is_summative
      if (args.type === 'text' && args.is_summative) {
        return {
          content: [{ type: 'text', text: 'text activities are non-scorable and cannot be summative' }],
          isError: true,
        };
      }

      // Validate body_data against the type-specific schema
      const validation = validateBodyData(args.type, args.body_data);
      if (!validation.success) {
        return {
          content: [{ type: 'text', text: validation.error }],
          isError: true,
        };
      }

      const input: CreateActivityInput = {
        lesson_id: args.lesson_id,
        title: args.title,
        type: args.type,
        body_data: args.body_data,
        order_by: args.order_by,
        is_summative: args.is_summative,
        notes: args.notes,
      };
      const activity = await activityQueries.create(input);
      return { content: [{ type: 'text', text: JSON.stringify(activity) }] };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error creating activity: ${(error as Error).message}` }],
        isError: true,
      };
    }
  });

  server.registerTool('list_activities', {
    description: 'List all active activities for a lesson',
    inputSchema: {
      lesson_id: z.string(),
    },
  }, async (args) => {
    try {
      const activities = await activityQueries.getAll(args.lesson_id);
      return { content: [{ type: 'text', text: JSON.stringify(activities) }] };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error listing activities: ${(error as Error).message}` }],
        isError: true,
      };
    }
  });

  return server;
}
