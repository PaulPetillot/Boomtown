const MockApp = require('../../__mocks__/mock-app')
const config = require('../../config/application')
const postgres = require('../../config/postgres')

let app = new MockApp()
config(app)

jest.mock('pg', () => require('../../__mocks__/modules/pg'))

describe('Postgres', () => {
  describe('Postgres configuration', () => {
    test('pg.Pool was called with the correct options', () => {
      const pg = postgres(app)
      expect(pg.options).toMatchObject({
        host: 'localhost',
        user: 'boomtowndemo',
        password: 'boomtowndemo',
        database: 'boomtowndemo',
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000
      })
    })
  })

  describe('Resource (CRUD) methods', () => {
    describe('Read queries:', () => {
      describe('getUserAndPasswordForVerification', () => {
        test('Query string', () => {})
      })
      describe('getUserById', () => {
        test('Query string', () => {})
      })
      describe('getItems', () => {
        test('SQL Query', () => {})
      })
      describe('getItemsForUser', () => {
        test('SQL Query', () => {})
      })
      describe('getBorrowedItemsForUser', () => {
        test('SQL Query', () => {})
      })
      describe('getTags', () => {
        test('SQL Query', () => {})
      })
      describe('getTagsForItem', () => {
        test('SQL Query', () => {})
      })
    })

    describe('Create queries:', () => {
      describe('saveNewItem', () => {
        test('SQL Query', () => {})
      })
      describe('borrowItem', () => {
        test('SQL Query', () => {})
      })
    })
  })
})
