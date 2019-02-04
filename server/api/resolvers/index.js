const { ApolloError } = require('apollo-server');
const jwt = require('jsonwebtoken');

const authMutations = require('./auth');
const { UploadScalar, DateScalar } = require('../custom-types');

module.exports = function(app) {
  return {
    Upload: UploadScalar,
    Date: DateScalar,
    Query: {
      viewer(parent, args, context, info) {
        if (context.token) {
          return jwt.decode(context.token, app.get('JWT_SECRET'));
        }
        return null;
      },
      async user(parent, { id }, { pgResource }, info) {
        try {
          const user = await pgResource.getUserById(id);
          return user;
        } catch (e) {
          return new ApolloError(e);
        }
      },
      async items(parent, { filter }, { pgResource }, info) {
        try {
          const items = await pgResource.getItems(filter);
          return items;
        } catch (e) {
          return new ApolloError(e);
        }
      },
      async tags(parent, args, { pgResource }, info) {
        try {
          const tags = await pgResource.getTags();
          return tags;
        } catch (e) {
          return new ApolloError(e);
        }
      }
    },
    Mutation: {
      ...authMutations(app),
      async addItem(parent, { item, image }, context, info) {
        try {
          image = await image;
          const user = await jwt.decode(context.token, app.get('JWT_SECRET'));
          const newItem = await context.pgResource.saveNewItem({
            item,
            image,
            user
          });
          return newItem;
        } catch (e) {
          return new ApolloError(
            'There was a problem creating the item. Try again.'
          );
        }
      }
    },
    User: {
      async items({ id }, args, { pgResource }, info) {
        try {
          const items = await pgResource.getItemsForUser(id);
          return items;
        } catch (e) {
          return new ApolloError(e);
        }
      },
      async borrowed({ id }, args, { pgResource }, info) {
        try {
          const items = await pgResource.getBorrowedItemsForUser(id);
          return items;
        } catch (e) {
          return new ApolloError(e);
        }
      }
    },
    Item: {
      async tags({ id }, args, { pgResource }, info) {
        try {
          const tags = await pgResource.getTagsForItem(id);
          return tags;
        } catch (e) {
          return new ApolloError(e);
        }
      },
      async imageurl({ imageurl, imageid, mimetype, data }) {
        if (imageurl) return imageurl;
        if (imageid) {
          return `${data}`;
        }
      },
      async itemowner({ ownerid }, args, context, info) {
        try {
          const user = await context.pgResource.getUserById(ownerid);
          if (!user) throw 'User not found.';
          return user;
        } catch (e) {
          return null;
        }
      },
      async borrower({ borrowerid }, args, context, info) {
        if (borrowerid) {
          try {
            const user = await context.pgResource.getUserById(borrowerid);
            if (!user) throw 'User not found.';
            return user;
          } catch (e) {
            return null;
          }
        }
        return null;
      }
    }
  };
};
