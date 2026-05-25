const pool = require('../../database/postgres/pool');
const createServer = require('../../http/createServer');

const UsersTableTestHelper = require('../../../../tests/UsersTableTestHelper');
const ThreadsTableTestHelper = require('../../../../tests/ThreadsTableTestHelper');
const CommentsTableTestHelper = require('../../../../tests/CommentsTableTestHelper');
const CommentLikesTableTestHelper = require('../../../../tests/CommentLikesTableTestHelper');

const container = require('../../container');

describe('/threads/{threadId}/comments/{commentId}/likes endpoint', () => {
  let accessToken;
  let userId;
  let threadId;
  let commentId;
  let server;

  beforeAll(async () => {
    server = await createServer(container);

    // Register user
    const registerResponse = await server.inject({
      method: 'POST',
      url: '/users',
      payload: {
        username: 'dicoding',
        password: 'secret',
        fullname: 'Dicoding Indonesia',
      },
    });

    const registerJson = JSON.parse(registerResponse.payload);
    userId = registerJson.data.addedUser.id;

    // Login
    const loginResponse = await server.inject({
      method: 'POST',
      url: '/authentications',
      payload: {
        username: 'dicoding',
        password: 'secret',
      },
    });

    const loginJson = JSON.parse(loginResponse.payload);
    accessToken = loginJson.data.accessToken;
  });

  beforeEach(async () => {
    await CommentLikesTableTestHelper.cleanTable();
    await CommentsTableTestHelper.cleanTable();
    await ThreadsTableTestHelper.cleanTable();

    // Create thread
    const threadResponse = await server.inject({
      method: 'POST',
      url: '/threads',
      payload: {
        title: 'Test Thread',
        body: 'Test Body',
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const threadJson = JSON.parse(threadResponse.payload);
    threadId = threadJson.data.addedThread.id;

    // Create comment
    const commentResponse = await server.inject({
      method: 'POST',
      url: `/threads/${threadId}/comments`,
      payload: {
        content: 'Test Comment',
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const commentJson = JSON.parse(commentResponse.payload);
    commentId = commentJson.data.addedComment.id;
  });

  afterAll(async () => {
    await CommentLikesTableTestHelper.cleanTable();
    await CommentsTableTestHelper.cleanTable();
    await ThreadsTableTestHelper.cleanTable();
    await UsersTableTestHelper.cleanTable();
    await pool.end();
  });

  it('should respond 200 when like comment', async () => {
    const response = await server.inject({
      method: 'PUT',
      url: `/threads/${threadId}/comments/${commentId}/likes`,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const responseJson = JSON.parse(response.payload);

    expect(response.statusCode).toEqual(200);
    expect(responseJson.status).toEqual('success');

    const likes = await CommentLikesTableTestHelper
      .findLikeByCommentIdAndOwner(commentId, userId);
    expect(likes).toHaveLength(1);
  });

  it('should toggle unlike when already liked', async () => {
    // like pertama
    await server.inject({
      method: 'PUT',
      url: `/threads/${threadId}/comments/${commentId}/likes`,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    // like kedua -> jadi unlike
    const response = await server.inject({
      method: 'PUT',
      url: `/threads/${threadId}/comments/${commentId}/likes`,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const responseJson = JSON.parse(response.payload);
    expect(response.statusCode).toEqual(200);
    expect(responseJson.status).toEqual('success');

    const likes = await CommentLikesTableTestHelper
      .findLikeByCommentIdAndOwner(commentId, userId);
    expect(likes).toHaveLength(0);
  });

  it('should respond 401 when no access token', async () => {
    const response = await server.inject({
      method: 'PUT',
      url: `/threads/${threadId}/comments/${commentId}/likes`,
    });

    expect(response.statusCode).toEqual(401);
  });

  it('should respond 404 when thread not found', async () => {
    const response = await server.inject({
      method: 'PUT',
      url: `/threads/thread-not-found/comments/${commentId}/likes`,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const responseJson = JSON.parse(response.payload);
    expect(response.statusCode).toEqual(404);
    expect(responseJson.status).toEqual('fail');
  });

  it('should respond 404 when comment not found', async () => {
    const response = await server.inject({
      method: 'PUT',
      url: `/threads/${threadId}/comments/comment-not-found/likes`,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const responseJson = JSON.parse(response.payload);
    expect(response.statusCode).toEqual(404);
    expect(responseJson.status).toEqual('fail');
  });

  it('should respond 500 when unexpected server error occurs', async () => {
    // Create a spy on pool.query to simulate database error
    const originalQuery = pool.query;
    pool.query = jest.fn().mockRejectedValue(new Error('Database connection failed'));

    try {
      const response = await server.inject({
        method: 'PUT',
        url: `/threads/${threadId}/comments/${commentId}/likes`,
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toEqual(500);
      const responseJson = JSON.parse(response.payload);
      expect(responseJson.status).toEqual('error');
      expect(responseJson.message).toEqual('terjadi kegagalan pada server kami');
    } finally {
      pool.query = originalQuery;
    }
  });
});
