var strs = require('stringstream')

function tagsQueryString (tags, itemid, result) {
  const length = tags.length
  return length === 0
    ? `${result};`
    : tags.shift() &&
        tagsQueryString(
          tags,
          itemid,
          `${result}($${tags.length + 1}, ${itemid})${length === 1 ? '' : ','}`
        )
}

module.exports = function (postgres) {
  return {
    async createUser ({ fullname, email, password }) {
      const newUserInsert = {
        text: 'INSERT INTO users (fullname, email, password) VALUES ($1,$2, $3) RETURNING *',
        values: [fullname, email, password]
      }
      try {
        const user = await postgres.query(newUserInsert)
        return user.rows[0]
      } catch (e) {
        switch (true) {
          case /users_fullname_key/.test(e.message):
            throw 'An account with this username already exists.'
          case /users_email_key/.test(e.message):
            throw 'An account with this email already exists.'
          default:
            throw 'There was a problem creating your account.'
        }
      }
    },
    async getUserAndPasswordForVerification (email) {
      const findUserQuery = {
        text: 'SELECT * FROM users WHERE email = $1',
        values: [email]
      }
      try {
        const user = await postgres.query(findUserQuery)
        if (!user) throw 'User was not found.'
        return user.rows[0]
      } catch (e) {
        throw 'User was not found.'
      }
    },
    async getUserById (id) {
      const findUserQuery = {
        text: 'SELECT * FROM users WHERE id = $1',
        values: [id]
      }
      try {
        const user = await postgres.query(findUserQuery)
        if (!user) throw 'User was not found.'
        const { id, email, fullname, bio } = user.rows[0]
        return { id, email, fullname, bio }
      } catch (e) {
        throw 'User was not found.'
      }
    },
    async getItems (id) {
      try {
        const items = await postgres.query({
          text: `SELECT 
            id, 
            title, 
            imageurl, 
            description, 
            ownerid, 
            borrowerid, 
            created,
            imageid, 
            data 
              FROM items
                LEFT JOIN ( SELECT id AS uploadid, data, mimetype FROM uploads) img 
                ON img.uploadid=items.imageid
                ${id ? `WHERE items.ownerid != $1 AND` : `WHERE`} items.borrowerid IS NULL
                ORDER BY created DESC`,
          values: id ? [id] : []
        })
        return items.rows
      } catch (e) {
        throw e
      }
    },
    async getItemsForUser (id) {
      try {
        const items = await postgres.query({
          text: `SELECT 
            id, 
            title, 
            imageurl, 
            description, 
            ownerid, 
            borrowerid, 
            created,
            imageid, 
            data 
              FROM items 
                LEFT JOIN ( SELECT id AS uploadid, data, mimetype FROM uploads) img 
                ON img.uploadid=items.imageid
                WHERE items.ownerid=$1
                ORDER BY created DESC`,
          values: [id]
        })
        return items.rows
      } catch (e) {
        throw e
      }
    },
    async getBorrowedItemsForUser (id) {
      try {
        const items = await postgres.query({
          text: `SELECT 
            id, 
            title, 
            imageurl, 
            description, 
            ownerid, 
            borrowerid, 
            created,
            imageid, 
            data 
              FROM items 
                LEFT JOIN ( SELECT id AS uploadid, data, mimetype FROM uploads) img 
                ON img.uploadid=items.imageid
                WHERE items.borrowerid=$1
                ORDER BY created DESC`,
          values: [id]
        })
        return items.rows
      } catch (e) {
        throw e
      }
    },
    borrowItem (userid) {
      // TODO: Stretch Goal
    },
    async getTags () {
      try {
        const tags = await postgres.query('SELECT * FROM tags')
        return tags.rows
      } catch (e) {
        throw e
      }
    },
    async getTagsForItem (id) {
      const tagsQuery = {
        text: `
        select * from tags 
            inner join itemtags on itemtags.tagid=tags.id
            where itemtags.itemid=$1`,
        values: [id]
      }
      try {
        const tags = await postgres.query(tagsQuery)
        return tags.rows
      } catch (e) {
        throw e
      }
    },
    async saveNewItem ({ item, image, user }) {
      return new Promise((resolve, reject) => {
        // Begin transaction
        postgres.connect((err, client, done) => {
          try {
            // Begin postgres transaction
            client.query('BEGIN', err => {
              // Convert image (file stream) to Base64
              const imageStream = image.stream.pipe(strs('base64'))

              let base64Str = 'data:image/*;base64, '
              imageStream.on('data', data => {
                base64Str += data
              })

              imageStream.on('end', async () => {
                // Image has been converted, begin saving things
                const { title, description, tags } = item

                const newItemQuery = {
                  text: 'INSERT INTO items (title, description, ownerid) VALUES ($1,$2,$3) RETURNING *',
                  values: [title, description, user.id]
                }

                // Save new item
                const newItem = await client.query(newItemQuery)
                const itemid = newItem.rows[0].id

                const imageUploadQuery = {
                  text: 'INSERT INTO uploads (itemid, filename, mimetype, encoding, data) VALUES ($1, $2, $3, $4, $5) RETURNING *',
                  values: [
                    itemid,
                    image.filename,
                    image.mimetype,
                    'base64',
                    base64Str
                  ]
                }

                // Upload image
                const uploadedImage = await client.query(imageUploadQuery)
                const imageid = uploadedImage.rows[0].id

                const updateItemImageQuery = {
                  text: 'UPDATE items SET imageid = $1 WHERE id = $2',
                  values: [imageid, itemid]
                }

                // Set image relationship
                await client.query(updateItemImageQuery)

                // Generate tag relationships
                const addTagsQuery = {
                  text: `INSERT INTO itemtags (tagid, itemid) VALUES ${tagsQueryString([...tags], itemid, '')}`,
                  values: tags.map(tag => tag.id)
                }

                // Insert tags
                await client.query(addTagsQuery)

                // Commit the entire transaction!
                client.query('COMMIT', err => {
                  if (err) {
                    throw err
                  }
                  // release the client back to the pool
                  done()
                  resolve(newItem.rows[0])
                })
              })
            })
          } catch (e) {
            // Something went wrong
            client.query('ROLLBACK', err => {
              if (err) {
                throw err
              }
              // release the client back to the pool
              done()
            })
            switch (true) {
              case /uploads_itemid_key/.test(e.message):
                throw 'This item already has an image.'
              default:
                throw e
            }
          }
        })
      })
    }
  }
}
