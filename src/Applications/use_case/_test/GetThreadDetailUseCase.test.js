const ThreadRepository = require('../../../Domains/threads/ThreadRepository');
const CommentRepository = require('../../../Domains/comments/CommentRepository');
const ReplyRepository = require('../../../Domains/replies/ReplyRepository');
const CommentLikeRepository = require('../../../Domains/commentLikes/CommentLikeRepository');

const GetThreadDetailUseCase = require('../GetThreadDetailUseCase');
const DetailThread = require('../../../Domains/threads/entities/DetailThread');
const DetailComment = require('../../../Domains/comments/entities/DetailComment');

describe('GetThreadDetailUseCase', () => {
  it('should orchestrating get thread detail action correctly with likeCount and replies', async () => {
    // Arrange
    const useCasePayload = {
      threadId: 'thread-123',
    };

    const threadFromRepo = {
      id: 'thread-123',
      title: 'sebuah thread',
      body: 'sebuah body thread',
      date: '2021-08-08T07:19:09.775Z',
      username: 'dicoding',
    };

    const commentsFromRepo = [
      {
        id: 'comment-1',
        username: 'johndoe',
        date: '2021-08-08T07:22:33.555Z',
        content: 'sebuah comment',
        is_delete: false,
      },
      {
        id: 'comment-2',
        username: 'dicoding',
        date: '2021-08-08T07:26:21.338Z',
        content: 'komentar yang dihapus',
        is_delete: true,
      },
    ];

    const repliesFromRepo = [
      {
        id: 'reply-1',
        content: 'balasan pertama',
        date: '2021-08-08T07:26:21.338Z',
        is_delete: false,
        username: 'johndoe',
        commentId: 'comment-1',
      },
      {
        id: 'reply-2',
        content: 'balasan yang dihapus',
        date: '2021-08-08T07:30:21.338Z',
        is_delete: true,
        username: 'dicoding',
        commentId: 'comment-2',
      },
    ];

    const expectedThreadDetail = new DetailThread({
      id: 'thread-123',
      title: 'sebuah thread',
      body: 'sebuah body thread',
      date: '2021-08-08T07:19:09.775Z',
      username: 'dicoding',
      comments: [
        new DetailComment({
          id: 'comment-1',
          username: 'johndoe',
          date: '2021-08-08T07:22:33.555Z',
          content: 'sebuah comment',
          likeCount: 2,
          replies: [
            {
              id: 'reply-1',
              content: 'balasan pertama',
              date: '2021-08-08T07:26:21.338Z',
              username: 'johndoe',
            },
          ],
        }),
        new DetailComment({
          id: 'comment-2',
          username: 'dicoding',
          date: '2021-08-08T07:26:21.338Z',
          content: '**komentar telah dihapus**',
          likeCount: 1,
          replies: [
            {
              id: 'reply-2',
              content: '**balasan telah dihapus**',
              date: '2021-08-08T07:30:21.338Z',
              username: 'dicoding',
            },
          ],
        }),
      ],
    });

    const mockThreadRepository = new ThreadRepository();
    const mockCommentRepository = new CommentRepository();
    const mockReplyRepository = new ReplyRepository();
    const mockCommentLikeRepository = new CommentLikeRepository();

    mockThreadRepository.getThreadById = jest.fn()
      .mockResolvedValue(threadFromRepo);

    mockCommentRepository.getCommentsByThreadId = jest.fn()
      .mockResolvedValue(commentsFromRepo);

    mockReplyRepository.getRepliesByThreadId = jest.fn()
      .mockResolvedValue(repliesFromRepo);

    mockCommentLikeRepository.getLikeCountsByCommentIds = jest.fn()
      .mockResolvedValue({
        'comment-1': 2,
        'comment-2': 1,
      });

    const getThreadDetailUseCase = new GetThreadDetailUseCase({
      threadRepository: mockThreadRepository,
      commentRepository: mockCommentRepository,
      replyRepository: mockReplyRepository,
      commentLikeRepository: mockCommentLikeRepository,
    });

    // Action
    const detailThread = await getThreadDetailUseCase.execute(useCasePayload);

    // Assert
    expect(mockThreadRepository.getThreadById)
      .toBeCalledWith(useCasePayload.threadId);

    expect(mockCommentRepository.getCommentsByThreadId)
      .toBeCalledWith(useCasePayload.threadId);

    expect(mockReplyRepository.getRepliesByThreadId)
      .toBeCalledWith(useCasePayload.threadId);

    expect(mockCommentLikeRepository.getLikeCountsByCommentIds)
      .toHaveBeenCalledWith(['comment-1', 'comment-2']);

    expect(detailThread).toStrictEqual(expectedThreadDetail);
  });

  it('should handle multiple replies on same comment correctly (likeCount default 0)', async () => {
    // Arrange
    const useCasePayload = {
      threadId: 'thread-123',
    };

    const threadFromRepo = {
      id: 'thread-123',
      title: 'sebuah thread',
      body: 'sebuah body thread',
      date: '2021-08-08T07:19:09.775Z',
      username: 'dicoding',
    };

    const commentsFromRepo = [
      {
        id: 'comment-1',
        username: 'johndoe',
        date: '2021-08-08T07:22:33.555Z',
        content: 'sebuah comment',
        is_delete: false,
      },
    ];

    const repliesFromRepo = [
      {
        id: 'reply-1',
        content: 'balasan pertama',
        date: '2021-08-08T07:26:21.338Z',
        is_delete: false,
        username: 'johndoe',
        commentId: 'comment-1',
      },
      {
        id: 'reply-2',
        content: 'balasan kedua',
        date: '2021-08-08T07:30:21.338Z',
        is_delete: false,
        username: 'alice',
        commentId: 'comment-1',
      },
    ];

    const mockThreadRepository = new ThreadRepository();
    const mockCommentRepository = new CommentRepository();
    const mockReplyRepository = new ReplyRepository();
    const mockCommentLikeRepository = new CommentLikeRepository();

    mockThreadRepository.getThreadById = jest.fn()
      .mockResolvedValue(threadFromRepo);

    mockCommentRepository.getCommentsByThreadId = jest.fn()
      .mockResolvedValue(commentsFromRepo);

    mockReplyRepository.getRepliesByThreadId = jest.fn()
      .mockResolvedValue(repliesFromRepo);

    mockCommentLikeRepository.getLikeCountsByCommentIds = jest.fn()
      .mockResolvedValue({});

    const getThreadDetailUseCase = new GetThreadDetailUseCase({
      threadRepository: mockThreadRepository,
      commentRepository: mockCommentRepository,
      replyRepository: mockReplyRepository,
      commentLikeRepository: mockCommentLikeRepository,
    });

    // Action
    const detailThread = await getThreadDetailUseCase.execute(useCasePayload);

    // Assert
    expect(detailThread.comments[0].replies).toHaveLength(2);
    expect(detailThread.comments[0].replies[0].id).toEqual('reply-1');
    expect(detailThread.comments[0].replies[1].id).toEqual('reply-2');
    expect(detailThread.comments[0].likeCount).toEqual(0);
  });
});
