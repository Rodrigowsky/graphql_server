require("dotenv").config();
const jwt = require("jsonwebtoken");
const { ApolloServer, gql } = require("apollo-server");
const { v4: uuidv4 } = require("uuid");
const mongoose = require("mongoose");
const Book = require("./models/books");
const Author = require("./models/authors");
const User = require("./models/user")

// let authors = [
//   {
//     name: "Robert Martin",
//     id: "afa51ab0-344d-11e9-a414-719c6709cf3e",
//     born: 1952,
//   },
//   {
//     name: "Martin Fowler",
//     id: "afa5b6f0-344d-11e9-a414-719c6709cf3e",
//     born: 1963,
//   },
//   {
//     name: "Fyodor Dostoevsky",
//     id: "afa5b6f1-344d-11e9-a414-719c6709cf3e",
//     born: 1821,
//   },
//   {
//     name: "Joshua Kerievsky", // birthyear not known
//     id: "afa5b6f2-344d-11e9-a414-719c6709cf3e",
//   },
//   {
//     name: "Sandi Metz", // birthyear not known
//     id: "afa5b6f3-344d-11e9-a414-719c6709cf3e",
//   },
// ];

// /*
//  * Suomi:
//  * Saattaisi olla järkevämpää assosioida kirja ja sen tekijä tallettamalla kirjan yhteyteen tekijän nimen sijaan tekijän id
//  * Yksinkertaisuuden vuoksi tallennamme kuitenkin kirjan yhteyteen tekijän nimen
//  *
//  * English:
//  * It might make more sense to associate a book with its author by storing the author's id in the context of the book instead of the author's name
//  * However, for simplicity, we will store the author's name in connection with the book
//  */

// let books = [
//   {
//     title: "Clean Code",
//     published: 2008,
//     author: "Robert Martin",
//     id: "afa5b6f4-344d-11e9-a414-719c6709cf3e",
//     genres: ["refactoring"],
//   },
//   {
//     title: "Agile software development",
//     published: 2002,
//     author: "Robert Martin",
//     id: "afa5b6f5-344d-11e9-a414-719c6709cf3e",
//     genres: ["agile", "patterns", "design"],
//   },
//   {
//     title: "Refactoring, edition 2",
//     published: 2018,
//     author: "Martin Fowler",
//     id: "afa5de00-344d-11e9-a414-719c6709cf3e",
//     genres: ["refactoring"],
//   },
//   {
//     title: "Refactoring to patterns",
//     published: 2008,
//     author: "Joshua Kerievsky",
//     id: "afa5de01-344d-11e9-a414-719c6709cf3e",
//     genres: ["refactoring", "patterns"],
//   },
//   {
//     title: "Practical Object-Oriented Design, An Agile Primer Using Ruby",
//     published: 2012,
//     author: "Sandi Metz",
//     id: "afa5de02-344d-11e9-a414-719c6709cf3e",
//     genres: ["refactoring", "design"],
//   },
//   {
//     title: "Crime and punishment",
//     published: 1866,
//     author: "Fyodor Dostoevsky",
//     id: "afa5de03-344d-11e9-a414-719c6709cf3e",
//     genres: ["classic", "crime"],
//   },
//   {
//     title: "The Demon ",
//     published: 1872,
//     author: "Fyodor Dostoevsky",
//     id: "afa5de04-344d-11e9-a414-719c6709cf3e",
//     genres: ["classic", "revolution"],
//   },
// ];

mongoose
  .connect(process.env.TEST_MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("connected to MongoDB");
  })
  .catch((error) => {
    console.log("error connection to MongoDB:", error.message);
  });

const typeDefs = gql`
  type Book {
    title: String!
    published: Int!
    author: String!
    id: ID!
    genres: [String!]!
  }
  type Author {
    author: String
    born: Int
    bookCount: String!
  }
  type User {
    username: String!
    favouriteGenre: String!
    id: ID!
  }
  type Token {
    value: String!
  }
  type Query {
    bookCount: Int!
    authorCount: Int!
    allBooks(author: String, genre: String): [Book!]!
    allAuthors: [Author!]!
    me: User
  }
  type Mutation {
    addBook(
      title: String!
      published: Int!
      author: String!
      genres: [String!]!
    ): Book
    editAuthor(name: String!, year: Int!): Author
    createUser(username: String!, favouriteGenre: String!): User
    login(username: String!, password: String!): Token
  }
`;

const resolvers = {
  Query: {
    bookCount: () => Book.collection.countDocuments(),
    authorCount: async () => {
      const result = await Book.find({});
      return result
        .map((at) => at.author)
        .filter((item, i, ar) => ar.indexOf(item) === i).length;
    },
    allBooks: async (root, args) => {
      if (args.author) {
        let findAuthor = await Author.find({ name: args.author });
        return await Book.find({ author: findAuthor[0]._id }).exec();
      }
      if (args.genre) {
        const result = await Book.find({});
        result.filter((p) => {
          if (p.genres.find((a) => a === args.genre)) {
            console.log(p);
            return p;
          }
        });
      }
      return await Book.find({});
    },
    allAuthors: async () => {
      const result = await Author.find({});
      return result;
    },
    me: (root, args, context) => {
      
      // it just returns the logged -in user it receives in the currentUser field of the third parameter of the resolver, context.It's worth noting that if there is no logged-in user, i.e. there is no valid token in the header attached to the request, the query returns null
      
      return context.currentUser
    }
  },
  Author: {
    author: (root) => root.name,
    born: (root) => root.born,
    bookCount: async (root) => {
      const result = await Book.find({});
      return result.filter((p) => p.author === root.name).length;
    },
  },
  Mutation: {
    addBook: async (root, args, context) => {

      const currentUser = context.currentUser;
      if (!currentUser) {
        throw new AuthenticationError("not authenticated")
      }

      let findAuthor = await Author.find({ name: args.author });
      if (findAuthor.length === 0) {
        auth = new Author({ name: args.author });
        await auth.save();
        findAuthor.push(auth);
      }

      const book = new Book({
        title: args.title,
        published: args.published,
        author: findAuthor[0],
        genres: args.genres,
      });
      return await book.save();
    },
    editAuthor: async (root, args, context) => {

      const currentUser = context.currentUser;
      if (!currentUser) {
        throw new AuthenticationError("not authenticated")
      }

      const filter = { name: args.name };
      const update = { born: args.year };

      return await Author.findOneAndUpdate(filter, update);
    },
    createUser: async (root, args) => {
      const user = new User({ username: args.username });

      return user.save().catch((error) => {
        throw new UserInputError(error.message, {
          invalidArgs: args,
        });
      });
    },
    login: async (root, args) => {
      // the login mutation checks if the username/password(hardcoded) pair is valid. And if it is indeed valid, it returns a jwt token

      const user = await User.findOne({ username: args.username });

      if (!user || args.password !== "secret") {
        throw new UserInputError("wrong credentials");
      }

      const userForToken = {
        username: user.username,
        id: user._id,
      };

      return { value: jwt.sign(userForToken, process.env.JWT_SECRET) };
    },
  },
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: async ({ req }) => {

    // The object returned by context is given to all resolvers as their third parameter. Context is the right place to do things which are shared by multiple resolvers, like user identification.

    const auth = req ? req.headers.authorization : null
    if (auth && auth.toLowerCase().startsWith('bearer ')) {
      const decodedToken = jwt.verify(
        auth.substring(7), process.env.JWT_SECRET
      )
      const currentUser = await User.findById(decodedToken.id)
      return { currentUser }
    }
  }
});

server.listen().then(({ url }) => {
  console.log(`Server ready at ${url}`);
});
