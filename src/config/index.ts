import dotenv from 'dotenv';

dotenv.config();

interface Config {
  database: {
    connectionString: string;
  };
  server: {
    port: number;
    nodeEnv: string;
  };
  mcp: {
    serverName: string;
    serverVersion: string;
    serviceKey: string;
  };
}

const config: Config = {
  database: {
    connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/postgres',
  },
  server: {
    port: parseInt(process.env.PORT || '3001', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  mcp: {
    serverName: process.env.MCP_SERVER_NAME || 'planner-mcp',
    serverVersion: process.env.MCP_SERVER_VERSION || '1.0.0',
    serviceKey: process.env.MCP_SERVICE_KEY || '',
  },
};

// Validate required config
if (!config.mcp.serviceKey) {
  console.error('ERROR: MCP_SERVICE_KEY is required in .env file');
  process.exit(1);
}

export default config;
