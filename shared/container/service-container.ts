import type { ServiceContainer as IServiceContainer, ServiceFactory } from '../interfaces/container.interface.js'

export class ServiceContainer implements IServiceContainer {
  private factories = new Map<string, ServiceFactory>()
  private singletons = new Map<string, any>()
  private singletonTokens = new Set<string>()

  register<T>(token: string, factory: ServiceFactory<T>): void {
    this.factories.set(token, factory)
    // Clear singleton state when registering as transient
    if (this.singletonTokens.has(token)) {
      this.singletonTokens.delete(token)
      this.singletons.delete(token)
    }
  }

  registerSingleton<T>(token: string, factory: ServiceFactory<T>): void {
    this.factories.set(token, factory)
    this.singletonTokens.add(token)
    // Note: Keep existing singleton instance if already cached
    // This maintains singleton identity as expected by tests
  }

  resolve<T>(token: string): T {
    const factory = this.factories.get(token)
    if (!factory) {
      throw new Error(`Service not found: ${token}`)
    }

    if (this.singletonTokens.has(token)) {
      if (!this.singletons.has(token)) {
        this.singletons.set(token, factory())
      }
      return this.singletons.get(token) as T
    }

    return factory() as T
  }

  has(token: string): boolean {
    return this.factories.has(token)
  }
}
