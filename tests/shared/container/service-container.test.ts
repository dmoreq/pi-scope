import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ServiceContainer } from '../../../shared/container/service-container.js'

describe('ServiceContainer', () => {
  let container: ServiceContainer

  beforeEach(() => {
    container = new ServiceContainer()
  })

  it('should register and resolve services', () => {
    const mockService = { name: 'test' }
    container.register('TestService', () => mockService)

    const resolved = container.resolve('TestService')
    expect(resolved).toBe(mockService)
  })

  it('should throw error for unregistered service', () => {
    expect(() => container.resolve('NonExistent')).toThrow('Service not found: NonExistent')
  })

  it('should support singleton services', () => {
    let counter = 0
    container.registerSingleton('CounterService', () => ({ count: ++counter }))

    const first = container.resolve('CounterService')
    const second = container.resolve('CounterService')

    expect(first).toBe(second)
    expect(first.count).toBe(1)
  })

  it('should support factory services', () => {
    let counter = 0
    container.register('FactoryService', () => ({ count: ++counter }))

    const first = container.resolve('FactoryService')
    const second = container.resolve('FactoryService')

    expect(first).not.toBe(second)
    expect(first.count).toBe(1)
    expect(second.count).toBe(2)
  })

  it('should check service existence with has()', () => {
    expect(container.has('NonExistent')).toBe(false)

    container.register('ExistingService', () => ({}))
    expect(container.has('ExistingService')).toBe(true)
  })

  it('should handle complex service dependencies', () => {
    interface LoggerService { log: (msg: string) => void }
    interface UserService { getUser: (id: string) => { name: string } }

    const mockLogger: LoggerService = { log: vi.fn() }
    const mockUserService: UserService = {
      getUser: vi.fn().mockReturnValue({ name: 'John' })
    }

    container.register('Logger', () => mockLogger)
    container.registerSingleton('UserService', () => mockUserService)

    container.register('OrderService', () => ({
      createOrder: (userId: string) => {
        const logger = container.resolve<LoggerService>('Logger')
        const userService = container.resolve<UserService>('UserService')

        const user = userService.getUser(userId)
        logger.log(`Creating order for ${user.name}`)
        return { orderId: '123', user }
      }
    }))

    const orderService = container.resolve('OrderService')
    const order = orderService.createOrder('1')

    expect(order.orderId).toBe('123')
    expect(order.user.name).toBe('John')
    expect(mockLogger.log).toHaveBeenCalledWith('Creating order for John')
  })

  it('should allow overriding existing registrations', () => {
    container.register('Service', () => ({ version: 1 }))
    container.register('Service', () => ({ version: 2 }))

    const service = container.resolve<{ version: number }>('Service')
    expect(service.version).toBe(2)
  })

  it('should maintain singleton identity after re-registration as singleton', () => {
    container.registerSingleton('SingletonService', () => ({ id: Math.random() }))

    const first = container.resolve('SingletonService')

    // Re-register as singleton with new factory (should keep existing instance)
    container.registerSingleton('SingletonService', () => ({ id: Math.random() }))

    const second = container.resolve('SingletonService')

    // Should still return the same instance (already created)
    expect(first).toBe(second)
  })

  it('should convert singleton to transient when using register()', () => {
    let counter = 0

    // First register as singleton
    container.registerSingleton('ConvertService', () => ({ id: ++counter }))

    const singleton1 = container.resolve('ConvertService')
    const singleton2 = container.resolve('ConvertService')

    expect(singleton1).toBe(singleton2) // Should be same instance
    expect(singleton1.id).toBe(1)

    // Now register as transient (should override singleton behavior)
    container.register('ConvertService', () => ({ id: ++counter }))

    const transient1 = container.resolve('ConvertService')
    const transient2 = container.resolve('ConvertService')

    expect(transient1).not.toBe(transient2) // Should be different instances
    expect(transient1.id).toBe(2)
    expect(transient2.id).toBe(3)
  })

  it('should maintain has() correctness for singleton registrations', () => {
    expect(container.has('SingletonOnly')).toBe(false)

    container.registerSingleton('SingletonOnly', () => ({ test: true }))

    expect(container.has('SingletonOnly')).toBe(true)

    // Should still return true after resolving
    container.resolve('SingletonOnly')
    expect(container.has('SingletonOnly')).toBe(true)
  })

  it('should handle factory exceptions gracefully', () => {
    container.register('FailingService', () => {
      throw new Error('Service creation failed')
    })

    expect(() => container.resolve('FailingService'))
      .toThrow('Service creation failed')
  })

  it('should provide type safety with generic methods', () => {
    interface TestService {
      test(): string
    }

    const mockService: TestService = {
      test: () => 'test result'
    }

    container.register<TestService>('TestService', () => mockService)

    const resolved = container.resolve<TestService>('TestService')
    expect(resolved.test()).toBe('test result')
  })
})
