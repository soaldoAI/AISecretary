import fs from "fs";
import path from "path";

export interface AgentManifest {
  name: string;
  role: string;
  description: string;
}

export function loadAgents(): AgentManifest[] {
  const agentsDir = path.join(process.cwd(), "agents");

  if (!fs.existsSync(agentsDir)) {
    return [];
  }

  const folders = fs
    .readdirSync(agentsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory());

  return folders.flatMap((folder) => {
    const manifestPath = path.join(
      agentsDir,
      folder.name,
      "agent.json"
    );

    if (!fs.existsSync(manifestPath)) {
      return [];
    }

    try {
      const content = fs.readFileSync(manifestPath, "utf-8");
      const agent = JSON.parse(content) as AgentManifest;

      if (!agent.name || !agent.role || !agent.description) {
        return [];
      }

      return [agent];
    } catch {
      return [];
    }
  });
}