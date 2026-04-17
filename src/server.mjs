import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";

const books = [
  {
    id: "1",
    title: "The Left Hand of Darkness",
    author: "Ursula K. Le Guin",
    genre: "science fiction",
    inStock: true
  },
  {
    id: "2",
    title: "A Wizard of Earthsea",
    author: "Ursula K. Le Guin",
    genre: "fantasy",
    inStock: false
  },
  {
    id: "3",
    title: "Kindred",
    author: "Octavia E. Butler",
    genre: "science fiction",
    inStock: true
  },
  {
    id: "4",
    title: "The Dispossessed",
    author: "Ursula K. Le Guin",
    genre: "science fiction",
    inStock: true
  }
];

const typeDefs = `#graphql
  type Book {
    id: ID!
    title: String!
    author: String!
    genre: String!
    inStock: Boolean!
  }

  type Query {
    books: [Book!]!
    bookById(id: ID!): Book
    booksByGenre(genre: String!): [Book!]!
  }
`;

const resolvers = {
  Query: {
    books: () => books,
    bookById: (_, { id }) => books.find((book) => book.id === id) ?? null,
    booksByGenre: (_, { genre }) =>
      books.filter((book) => book.genre.toLowerCase() === genre.toLowerCase())
  }
};

const server = new ApolloServer({
  typeDefs,
  resolvers
});

const { url } = await startStandaloneServer(server, {
  listen: { port: 4001 }
});

console.log(`GraphQL API ready at ${url}`);
