/**
 * Plugin Registry
 *
 * Singleton that manages registration and retrieval of Agent Plugins.
 * Plugins self-register when their modules are imported.
 */

import type { AgentPlugin, PluginCategory, PluginRegistry as IPluginRegistry } from './types';

class PluginRegistryImpl implements IPluginRegistry {
  private plugins: Map<string, AgentPlugin> = new Map();

  /**
   * Register a plugin with the registry
   * @param plugin - The plugin to register
   * @throws Error if a plugin with the same ID already exists
   */
  register(plugin: AgentPlugin): void {
    if (this.plugins.has(plugin.id)) {
      console.warn(`Plugin with ID "${plugin.id}" is already registered. Skipping.`);
      return;
    }
    this.plugins.set(plugin.id, plugin);
  }

  /**
   * Get a plugin by ID
   * @param id - Plugin ID
   * @returns The plugin or undefined if not found
   */
  get(id: string): AgentPlugin | undefined {
    return this.plugins.get(id);
  }

  /**
   * Get all registered plugins
   * @returns Array of all plugins
   */
  getAll(): AgentPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get plugins by category
   * @param category - Plugin category to filter by
   * @returns Array of plugins in the specified category
   */
  getByCategory(category: PluginCategory): AgentPlugin[] {
    return this.getAll().filter((plugin) => plugin.category === category);
  }

  /**
   * Check if a plugin is registered
   * @param id - Plugin ID
   * @returns true if plugin exists
   */
  has(id: string): boolean {
    return this.plugins.has(id);
  }

  /**
   * Get the count of registered plugins
   * @returns Number of registered plugins
   */
  get count(): number {
    return this.plugins.size;
  }

  /**
   * Unregister a plugin (useful for testing)
   * @param id - Plugin ID to remove
   * @returns true if plugin was removed
   */
  unregister(id: string): boolean {
    return this.plugins.delete(id);
  }

  /**
   * Clear all plugins (useful for testing)
   */
  clear(): void {
    this.plugins.clear();
  }
}

// Export singleton instance
export const pluginRegistry = new PluginRegistryImpl();
