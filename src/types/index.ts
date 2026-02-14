// Database types - based on existing schema
export interface DbUnit {
  unit_id: string;
  title: string;
  subject: string;
  description: string | null;
  year: number | null;
  active: boolean;
}

export interface DbLesson {
  lesson_id: string;
  unit_id: string;
  title: string;
  active: boolean;
  order_by: number;
}

export interface DbActivity {
  activity_id: string;
  lesson_id: string;
  title: string;
  type: string; // 'multiple-choice-question' | 'short-text-question' | 'text'
  body_data: any; // JSONB
  order_by: number | null;
  active: boolean;
  is_summative: boolean;
  notes: string | null;
}

// MCP Tool types
export interface ToolResult {
  content: Array<{
    type: 'text';
    text: string;
  }>;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// Activity creation input
export interface CreateActivityInput {
  lesson_id: string;
  title: string;
  type: 'multiple-choice-question' | 'short-text-question' | 'text';
  body_data: any;
  order_by?: number;
  is_summative?: boolean;
  notes?: string;
}
