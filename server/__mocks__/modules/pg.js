const pg = {}

pg.Pool = class Pool {
  constructor (options) {
    this.options = options
  }
}

pg.query = queryObj => {
  // Omit the queryObj to throw an error in tests
  if (!queryObj) throw 'Error'
  return queryObj
}

module.exports = pg
