import type { ServiceContainer as IServiceContainer, ServiceFactory } from '../interfaces/container.interface.js'

export class ServiceContainer implements IServiceContainer {
  private factories = new Map<string, ServiceFactory>()
  private singletons = new Map<string, any>()
  private singletonTokens = new Set<string>()

  register<T>(token: string, factory: ServiceFactory<T>): void {
    this.factories.set(token, factory)
  }

  registerSingleton<T>(token: string, factory: ServiceFactory<T>): void {
    this.factories.set(token, factory)
    this.singletonTokens.add(token)
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
