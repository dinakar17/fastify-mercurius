export const schema = `
  type User {
    id: ID!
    email: String!
    name: String!
    posts: [Post!]!
    createdAt: String!
  }

  type Post {
    id: ID!
    title: String!
    content: String!
    author: User!
    createdAt: String!
  }

  type Query {
    users: [User!]!
    user(id: ID!): User
    posts: [Post!]!
    post(id: ID!): Post
  }

  type Mutation {
    createUser(email: String!, name: String!): User!
    createPost(title: String!, content: String!, userId: ID!): Post!
  }
`;