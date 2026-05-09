/**
 * Configuration port consumed by SessionOrchestrator.
 */
import type { SessionConfig } from '../interfaces/state-manager.interface.js'

export interface ConfigManager {
  loadConfig(projectRoot: string): Promise<SessionConfig>
  getConfig(): unknown
}
