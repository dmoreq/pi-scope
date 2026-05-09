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

  it('should maintain singleton identity after re-registration', () => {
    container.registerSingleton('SingletonService', () => ({ id: Math.random() }))

    const first = container.resolve<{ id: number }>('SingletonService')

    container.registerSingleton('SingletonService', () => ({ id: Math.random() }))

    const second = container.resolve<{ id: number }>('SingletonService')

    expect(first).toBe(second)
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
