import { Request, Response, NextFunction } from 'express';
import config from '../config';

export interface AuthenticatedRequest extends Request {
  isAuthenticated: boolean;
}

export const validateMcpKey = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  const mcpKey = req.headers['x-mcp-key'] as string;

  // Check both Authorization header and x-mcp-key header
  const providedKey = authHeader?.replace('Bearer ', '') || mcpKey;

  if (!providedKey) {
    console.warn(`[AUTH] 401 ${req.method} ${req.path} - Missing MCP service key`);
    res.status(401).json({
      error: 'Unauthorized',
      message: 'MCP service key required. Provide via Authorization header or x-mcp-key header.',
    });
    return;
  }

  if (providedKey !== config.mcp.serviceKey) {
    console.warn(`[AUTH] 403 ${req.method} ${req.path} - Invalid MCP service key`);
    res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid MCP service key',
    });
    return;
  }

  // Mark request as authenticated
  (req as AuthenticatedRequest).isAuthenticated = true;
  next();
};
